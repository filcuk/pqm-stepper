/**
 * Shared resolve / verify helpers for framework lock + manifest.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { DERIVED_FILES, renderFrameworkCssIndex } from "./framework-catalogue.mjs";

/**
 * @param {string} posixPath
 */
export function toPosix(posixPath) {
  return posixPath.split(path.sep).join("/");
}

/**
 * @param {string} root
 * @param {string} relativePosix
 */
export function resolveUnder(root, relativePosix) {
  return path.join(root, ...relativePosix.split("/"));
}

/**
 * Canonical LF text so hashes match across Windows (CRLF) and Unix checkouts.
 * @param {Buffer | string} data
 */
export function canonicalizeNewlines(data) {
  const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * @param {Buffer | string} data
 */
export function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * @param {string} root
 * @param {string} relativePosix
 */
export function hashFileUnder(root, relativePosix) {
  return sha256Hex(canonicalizeNewlines(fs.readFileSync(resolveUnder(root, relativePosix))));
}

/**
 * @param {string} relativePosix
 * @param {string[]} patterns
 */
export function isAppOwnedPath(relativePosix, patterns) {
  const p = toPosix(relativePosix);
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) {
      return p === pattern.slice(0, -1) || p.startsWith(pattern);
    }
    return p === pattern;
  });
}

/**
 * Template-owned Cursor agent paths (skills + rules).
 * @param {string} relativePosix
 */
export function isAgentPath(relativePosix) {
  const p = toPosix(relativePosix);
  return p.startsWith(".cursor/skills/") || p.startsWith(".cursor/rules/");
}

/**
 * @param {object} lock
 * @param {object} manifest
 * @returns {string[]}
 */
export function resolveSelectedComponentIds(lock, manifest) {
  const requested = lock.components;
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new Error("framework.lock.json must include a non-empty components array");
  }

  const allIds = Object.keys(manifest.components);
  const cssOnlyIds = Object.keys(manifest.cssOnly || {});
  const selected = new Set();

  if (requested.includes("*")) {
    for (const id of allIds) selected.add(id);
    for (const id of cssOnlyIds) selected.add(id);
  } else {
    for (const id of requested) {
      if (!(id in manifest.components) && !(id in (manifest.cssOnly || {}))) {
        throw new Error(`Unknown component in lock: ${id}`);
      }
      selected.add(id);
    }
  }

  // Always-on catalogue components
  for (const [id, def] of Object.entries(manifest.components)) {
    if (def.always) selected.add(id);
  }
  for (const [id, def] of Object.entries(manifest.cssOnly || {})) {
    if (def.always) selected.add(id);
  }

  return [...selected].sort();
}

/**
 * Resolve lock `skills` (`*` / explicit ids / `-id` exclusions).
 * Omitted `skills` defaults to `["*"]` when the manifest has an agent section.
 * Schema v1 manifests without `agent` yield an empty selection.
 * @param {object} lock
 * @param {object} manifest
 * @returns {string[]}
 */
export function resolveSelectedSkillIds(lock, manifest) {
  const skillsMap = manifest.agent?.skills || {};
  const allIds = Object.keys(skillsMap);
  if (allIds.length === 0) return [];

  const requested =
    Array.isArray(lock.skills) && lock.skills.length > 0 ? lock.skills : ["*"];

  /** @type {string[]} */
  const positives = [];
  /** @type {string[]} */
  const exclusions = [];
  for (const entry of requested) {
    if (entry === "*") continue;
    if (entry.startsWith("-") && entry.length > 1) {
      exclusions.push(entry.slice(1));
      continue;
    }
    if (manifest.retired?.[entry]) {
      throw new Error(`Skill "${entry}" is retired and cannot be selected`);
    }
    if (!(entry in skillsMap)) {
      throw new Error(`Unknown skill in lock: ${entry}`);
    }
    positives.push(entry);
  }

  const star = requested.includes("*") || positives.length === 0;
  const selected = new Set();

  if (star) {
    for (const id of allIds) selected.add(id);
  } else {
    for (const id of positives) selected.add(id);
  }

  for (const id of exclusions) {
    selected.delete(id);
  }

  // Always-on skills (e.g. `_shared`) return after exclusions when anything remains
  // or when the selection is non-empty / star was used with only exclusions.
  const keepAlways = selected.size > 0 || star || positives.length > 0;
  if (keepAlways) {
    for (const [id, def] of Object.entries(skillsMap)) {
      if (def.always) selected.add(id);
    }
  }

  return [...selected].sort();
}

/**
 * @param {object} manifest
 * @param {string[]} selectedIds
 * @returns {string[]}
 */
export function resolveCssIndex(manifest, selectedIds) {
  const needed = new Set(manifest.core?.css || []);

  for (const id of selectedIds) {
    const comp = manifest.components[id];
    if (comp) {
      for (const css of comp.css || []) needed.add(css);
    }
    const cssOnly = manifest.cssOnly?.[id];
    if (cssOnly) {
      for (const css of cssOnly.css || []) needed.add(css);
    }
  }

  const order = manifest.cssIndexOrder || [];
  return order.filter((name) => needed.has(name));
}

/**
 * Paths eligible for `sync --prune` (live `previousFiles` + retired).
 * @param {object} manifest
 * @param {{ components: string[], skills: string[] }} selection
 * @returns {string[]}
 */
export function collectPrunePaths(manifest, selection) {
  /** @type {Set<string>} */
  const paths = new Set();

  for (const id of selection.components || []) {
    for (const rel of manifest.components?.[id]?.previousFiles || []) {
      paths.add(rel);
    }
  }
  for (const id of selection.skills || []) {
    for (const rel of manifest.agent?.skills?.[id]?.previousFiles || []) {
      paths.add(rel);
    }
  }
  for (const def of Object.values(manifest.retired || {})) {
    for (const rel of def.previousFiles || []) {
      paths.add(rel);
    }
  }

  return [...paths].sort();
}

/**
 * True when an app-owned text file still mentions the path (or its basename).
 * Used as a soft safety gate before prune deletes a retired/moved file.
 * @param {string} root
 * @param {string} relativePosix
 * @param {string[]} appOwned
 */
export function isPathReferencedInAppOwned(root, relativePosix, appOwned) {
  const rel = toPosix(relativePosix);
  const base = rel.split("/").pop() || rel;
  const baseNoExt = base.replace(/\.m?js$/, "");

  /** @type {string[]} */
  const needles = [rel, base];
  if (baseNoExt && baseNoExt !== base) needles.push(baseNoExt);

  for (const pattern of appOwned || []) {
    if (pattern.endsWith("/")) continue;
    const abs = resolveUnder(root, pattern);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const needle of needles) {
      if (needle && text.includes(needle)) return true;
    }
  }
  return false;
}

/**
 * Concrete framework-owned paths required for the lock selection.
 * @param {object} lock
 * @param {object} manifest
 * @returns {{ components: string[], skills: string[], files: string[], agentFiles: string[], css: string[] }}
 */
export function resolveSelection(lock, manifest) {
  const components = resolveSelectedComponentIds(lock, manifest);
  const skills = resolveSelectedSkillIds(lock, manifest);
  /** @type {Set<string>} */
  const files = new Set(manifest.core?.files || []);
  /** @type {Set<string>} */
  const agentFiles = new Set();

  for (const id of components) {
    const comp = manifest.components[id];
    if (comp) {
      for (const file of comp.files || []) files.add(file);
      for (const file of comp.vendorFiles || []) files.add(file);
      for (const infraId of comp.infra || []) {
        for (const file of manifest.infra?.[infraId] || []) {
          // config.js is app-owned; skip copying even if listed as infra
          if (!isAppOwnedPath(file, manifest.appOwned || [])) {
            files.add(file);
          }
        }
      }
    }
  }

  const css = resolveCssIndex(manifest, components);
  for (const basename of css) {
    files.add(`app/css/${basename}`);
  }

  for (const id of skills) {
    const def = manifest.agent?.skills?.[id];
    for (const file of def?.files || []) {
      files.add(file);
      agentFiles.add(file);
    }
  }
  if (skills.length > 0) {
    for (const file of manifest.agent?.rules || []) {
      files.add(file);
      agentFiles.add(file);
    }
  }

  // Manifest itself is part of a synced tree so verify can run offline
  files.add("framework-manifest.json");

  return {
    components,
    skills,
    files: [...files].sort(),
    agentFiles: [...agentFiles].sort(),
    css,
  };
}

/**
 * Preserve APP_VERSION while updating FRAMEWORK_VERSION.
 * @param {string} existingSource
 * @param {string} upstreamSource
 */
export function mergeVersionJs(existingSource, upstreamSource) {
  const appMatch = /export const APP_VERSION = "([^"]+)"/.exec(existingSource);
  const frameworkMatch = /export const FRAMEWORK_VERSION = "([^"]+)"/.exec(upstreamSource);
  if (!frameworkMatch) {
    throw new Error("Upstream version.js missing FRAMEWORK_VERSION");
  }

  let next = upstreamSource;
  if (appMatch) {
    if (/export const APP_VERSION = "[^"]*"/.test(next)) {
      next = next.replace(
        /export const APP_VERSION = "[^"]*"/,
        `export const APP_VERSION = "${appMatch[1]}"`
      );
    }
  }
  return next;
}

/**
 * @param {string} root
 * @param {object} lock
 * @param {object} manifest
 */
export function verifyFrameworkTree(root, lock, manifest) {
  const selection = resolveSelection(lock, manifest);
  const appOwned = manifest.appOwned || [];
  const agentFileSet = new Set(selection.agentFiles || []);

  /** @type {{ path: string, status: string, expected?: string, actual?: string }[]} */
  const results = [];
  /** @type {string[]} */
  const warnings = [];

  for (const id of selection.components) {
    if (manifest.deprecated?.[id] || manifest.components?.[id]?.deprecated) {
      const replacedBy =
        manifest.deprecated?.[id]?.replacedBy ||
        manifest.components?.[id]?.replacedBy;
      warnings.push(
        `Deprecated component "${id}" is still selected` +
          (replacedBy ? ` (replacedBy: ${replacedBy})` : "")
      );
    }
  }
  for (const id of selection.skills || []) {
    if (manifest.deprecated?.[id] || manifest.agent?.skills?.[id]?.deprecated) {
      const replacedBy =
        manifest.deprecated?.[id]?.replacedBy ||
        manifest.agent?.skills?.[id]?.replacedBy;
      warnings.push(
        `Deprecated skill "${id}" is still selected` +
          (replacedBy ? ` (replacedBy: ${replacedBy})` : "")
      );
    }
  }

  const prunePaths = collectPrunePaths(manifest, selection);
  for (const rel of prunePaths) {
    if (fs.existsSync(resolveUnder(root, rel))) {
      warnings.push(
        `Prune candidate still on disk: ${rel} (run sync with --prune)`
      );
    }
  }

  for (const rel of selection.files) {
    const soft = agentFileSet.has(rel);

    if (rel === "framework-manifest.json") {
      const abs = resolveUnder(root, rel);
      if (!fs.existsSync(abs)) {
        results.push({ path: rel, status: "missing" });
      } else {
        results.push({ path: rel, status: "identical" });
      }
      continue;
    }

    if (isAppOwnedPath(rel, appOwned)) continue;

    // version.js: only FRAMEWORK_VERSION must match; APP_VERSION is fork-owned
    if (rel === "app/version.js") {
      const abs = resolveUnder(root, rel);
      if (!fs.existsSync(abs)) {
        results.push({ path: rel, status: "missing" });
        continue;
      }
      const src = fs.readFileSync(abs, "utf8");
      const match = /export const FRAMEWORK_VERSION = "([^"]+)"/.exec(src);
      if (match?.[1] === manifest.frameworkVersion) {
        results.push({ path: rel, status: "identical" });
      } else {
        results.push({
          path: rel,
          status: "modified",
          expected: manifest.frameworkVersion,
          actual: match?.[1],
        });
      }
      continue;
    }

    const meta = manifest.files[rel];
    const abs = resolveUnder(root, rel);
    if (!meta) {
      // Expected path not hashed upstream (should not happen for catalogue files)
      if (!fs.existsSync(abs)) {
        results.push({ path: rel, status: soft ? "agentMissing" : "missing" });
      } else {
        results.push({ path: rel, status: "identical" });
      }
      continue;
    }

    if (!fs.existsSync(abs)) {
      results.push({
        path: rel,
        status: soft ? "agentMissing" : "missing",
        expected: meta.sha256,
      });
      continue;
    }

    const actual = hashFileUnder(root, rel);
    if (actual === meta.sha256) {
      results.push({ path: rel, status: "identical", expected: meta.sha256, actual });
    } else {
      results.push({
        path: rel,
        status: soft ? "agentModified" : "modified",
        expected: meta.sha256,
        actual,
      });
    }
  }

  // Derived framework.css
  const expectedCss = renderFrameworkCssIndex(selection.css);
  const derivedPath = "app/css/framework.css";
  const derivedAbs = resolveUnder(root, derivedPath);
  if (!fs.existsSync(derivedAbs)) {
    results.push({ path: derivedPath, status: "missing" });
  } else {
    const disk = fs.readFileSync(derivedAbs, "utf8").replace(/\r\n/g, "\n");
    if (disk === expectedCss) {
      results.push({
        path: derivedPath,
        status: "identical",
        expected: sha256Hex(expectedCss),
        actual: sha256Hex(disk),
      });
    } else {
      results.push({
        path: derivedPath,
        status: "modified",
        expected: sha256Hex(expectedCss),
        actual: sha256Hex(disk),
      });
    }
  }

  // Unexpected: known framework files present but not selected (app catalogue only)
  const expectedSet = new Set(selection.files);
  expectedSet.add(derivedPath);
  for (const rel of Object.keys(manifest.files)) {
    if (expectedSet.has(rel)) continue;
    if (isAppOwnedPath(rel, appOwned)) continue;
    if (DERIVED_FILES.includes(rel)) continue;
    if (isAgentPath(rel)) continue;
    const abs = resolveUnder(root, rel);
    if (fs.existsSync(abs)) {
      results.push({ path: rel, status: "unexpected" });
    }
  }

  const summary = {
    identical: results.filter((r) => r.status === "identical").length,
    modified: results.filter((r) => r.status === "modified").length,
    missing: results.filter((r) => r.status === "missing").length,
    unexpected: results.filter((r) => r.status === "unexpected").length,
    agentModified: results.filter((r) => r.status === "agentModified").length,
    agentMissing: results.filter((r) => r.status === "agentMissing").length,
  };

  const ok =
    summary.modified === 0 && summary.missing === 0 && summary.unexpected === 0;

  return {
    ok,
    frameworkVersion: lock.frameworkVersion,
    components: selection.components,
    skills: selection.skills,
    css: selection.css,
    summary,
    results,
    warnings,
    expectedCss,
  };
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

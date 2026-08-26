/**
 * Generate `framework-manifest.json` from the live tree + catalogue.
 *
 * Usage: node scripts/generate-framework-manifest.mjs
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AGENT_RULES,
  AGENT_SKILLS,
  APP_OWNED,
  APP_OWNED_FIELDS,
  COMPONENTS,
  CORE,
  CSS_INDEX_ORDER,
  CSS_ONLY,
  CSS_PARTIAL_FEATURES,
  DEFAULT_SOURCE,
  DEPRECATED,
  DERIVED_FILES,
  INFRA,
  RETIRED,
  collectLivePaths,
  renderFrameworkCssIndex,
  validateLifecycleCatalogue,
} from "./lib/framework-catalogue.mjs";
import { canonicalizeNewlines } from "./lib/framework-resolve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "framework-manifest.json");
const VERSION_PATH = path.join(ROOT, "app", "version.js");

/**
 * @param {string} posixPath
 */
export function toPosix(posixPath) {
  return posixPath.split(path.sep).join("/");
}

/**
 * @param {string} relativePosix
 */
export function resolveRepoPath(relativePosix) {
  return path.join(ROOT, ...relativePosix.split("/"));
}

/**
 * @param {Buffer | string} data
 */
export function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * @param {string} relativePosix
 */
export function hashFile(relativePosix) {
  const abs = resolveRepoPath(relativePosix);
  return sha256Hex(canonicalizeNewlines(fs.readFileSync(abs)));
}

/**
 * @param {string} relativePosix
 * @param {string[]} patterns
 */
export function isAppOwnedPath(relativePosix, patterns = APP_OWNED) {
  const p = toPosix(relativePosix);
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) {
      return p === pattern.slice(0, -1) || p.startsWith(pattern);
    }
    return p === pattern;
  });
}

/**
 * @param {string} dirPosix
 * @returns {string[]}
 */
export function listFilesRecursive(dirPosix) {
  const abs = resolveRepoPath(dirPosix);
  if (!fs.existsSync(abs)) return [];
  /** @type {string[]} */
  const out = [];
  const walk = (dirAbs) => {
    for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
      const childAbs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        walk(childAbs);
      } else if (entry.isFile()) {
        out.push(toPosix(path.relative(ROOT, childAbs)));
      }
    }
  };
  walk(abs);
  return out.sort();
}

/**
 * Expand a path or directory prefix into concrete file paths.
 * @param {string} entry
 */
export function expandPathEntry(entry) {
  if (entry.endsWith("/")) {
    return listFilesRecursive(entry.slice(0, -1));
  }
  return [entry];
}

/**
 * @returns {string}
 */
export function readFrameworkVersion() {
  const src = fs.readFileSync(VERSION_PATH, "utf8");
  const match = /export const FRAMEWORK_VERSION = "([^"]+)"/.exec(src);
  if (!match) {
    throw new Error("Could not parse FRAMEWORK_VERSION from app/version.js");
  }
  return match[1];
}

/**
 * @returns {string[]}
 */
export function listAppFiles() {
  return listFilesRecursive("app");
}

/**
 * Concrete agent file paths listed in the catalogue.
 * @returns {string[]}
 */
export function listAgentCatalogueFiles() {
  /** @type {Set<string>} */
  const paths = new Set(AGENT_RULES);
  for (const def of Object.values(AGENT_SKILLS)) {
    for (const rel of def.files || []) paths.add(rel);
  }
  return [...paths].sort();
}

/**
 * Serialize a deprecate/retire map entry for the manifest.
 * @param {object} def
 */
function serializeLifecycleEntry(def) {
  return {
    kind: def.kind,
    ...(def.replacedBy ? { replacedBy: def.replacedBy } : {}),
    ...(Array.isArray(def.previousFiles) && def.previousFiles.length > 0
      ? { previousFiles: [...def.previousFiles] }
      : {}),
    ...(def.deprecatedIn ? { deprecatedIn: def.deprecatedIn } : {}),
    ...(def.retiredIn ? { retiredIn: def.retiredIn } : {}),
    ...(def.notes ? { notes: def.notes } : {}),
  };
}

export { renderFrameworkCssIndex };

/**
 * @returns {object}
 */
export function buildManifest() {
  const frameworkVersion = readFrameworkVersion();

  // Expand vendor dirs so path-reuse checks see concrete files too
  /** @type {Set<string>} */
  const livePaths = collectLivePaths();
  for (const def of Object.values(COMPONENTS)) {
    for (const entry of def.vendor || []) {
      for (const rel of expandPathEntry(entry)) livePaths.add(rel);
    }
  }
  validateLifecycleCatalogue({ livePaths });

  const appFiles = listAppFiles();
  const agentFiles = listAgentCatalogueFiles();

  /** @type {Record<string, { sha256: string }>} */
  const files = {};
  for (const rel of appFiles) {
    if (isAppOwnedPath(rel)) continue;
    if (DERIVED_FILES.includes(rel)) continue;
    files[rel] = { sha256: hashFile(rel) };
  }
  for (const rel of agentFiles) {
    if (!fs.existsSync(resolveRepoPath(rel))) {
      throw new Error(`Agent catalogue path missing on disk: ${rel}`);
    }
    files[rel] = { sha256: hashFile(rel) };
  }

  /** @type {Record<string, { generator: string, sha256: string }>} */
  const derived = {};
  for (const rel of DERIVED_FILES) {
    if (!fs.existsSync(resolveRepoPath(rel))) continue;
    derived[rel] = {
      generator: "css-index",
      sha256: hashFile(rel),
    };
  }

  /** @type {Record<string, object>} */
  const components = {};
  for (const [id, def] of Object.entries(COMPONENTS)) {
    const expandedVendor = def.vendor.flatMap((entry) => expandPathEntry(entry));
    const deprecatedMeta = DEPRECATED[id];
    components[id] = {
      files: [...def.files],
      css: [...def.css],
      vendor: [...def.vendor],
      vendorFiles: expandedVendor,
      icons: [...def.icons],
      infra: [...def.infra],
      ...(def.always ? { always: true } : {}),
      ...(def.notes ? { notes: def.notes } : {}),
      ...(Array.isArray(def.previousFiles) && def.previousFiles.length > 0
        ? { previousFiles: [...def.previousFiles] }
        : {}),
      ...(deprecatedMeta
        ? {
            deprecated: true,
            deprecatedIn: deprecatedMeta.deprecatedIn,
            ...(deprecatedMeta.replacedBy
              ? { replacedBy: deprecatedMeta.replacedBy }
              : {}),
          }
        : {}),
    };
  }

  /** @type {Record<string, object>} */
  const agentSkills = {};
  for (const [id, def] of Object.entries(AGENT_SKILLS)) {
    const deprecatedMeta = DEPRECATED[id];
    agentSkills[id] = {
      files: [...def.files],
      ...(def.always ? { always: true } : {}),
      ...(def.forkFacing === false ? { forkFacing: false } : { forkFacing: true }),
      ...(Array.isArray(def.previousFiles) && def.previousFiles.length > 0
        ? { previousFiles: [...def.previousFiles] }
        : {}),
      ...(deprecatedMeta
        ? {
            deprecated: true,
            deprecatedIn: deprecatedMeta.deprecatedIn,
            ...(deprecatedMeta.replacedBy
              ? { replacedBy: deprecatedMeta.replacedBy }
              : {}),
          }
        : {}),
    };
  }

  /** @type {Record<string, object>} */
  const deprecated = {};
  for (const [id, def] of Object.entries(DEPRECATED)) {
    deprecated[id] = serializeLifecycleEntry(def);
  }

  /** @type {Record<string, object>} */
  const retired = {};
  for (const [id, def] of Object.entries(RETIRED)) {
    retired[id] = serializeLifecycleEntry(def);
  }

  return {
    schemaVersion: 2,
    frameworkVersion,
    generatedAt: new Date().toISOString(),
    source: DEFAULT_SOURCE,
    appOwned: [...APP_OWNED],
    appOwnedFields: { ...APP_OWNED_FIELDS },
    derived,
    files,
    core: {
      files: [...CORE.files],
      css: [...CORE.css],
      icons: [...CORE.icons],
    },
    infra: { ...INFRA },
    components,
    agent: {
      skills: agentSkills,
      rules: [...AGENT_RULES],
    },
    deprecated,
    retired,
    cssOnly: { ...CSS_ONLY },
    cssPartialFeatures: { ...CSS_PARTIAL_FEATURES },
    cssIndexOrder: [...CSS_INDEX_ORDER],
  };
}

/**
 * @param {string} [outPath]
 */
export function writeManifest(outPath = MANIFEST_PATH) {
  const manifest = buildManifest();
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const manifest = writeManifest();
  const fileCount = Object.keys(manifest.files).length;
  const derivedCount = Object.keys(manifest.derived).length;
  const agentSkillCount = Object.keys(manifest.agent?.skills || {}).length;
  const agentRuleCount = (manifest.agent?.rules || []).length;
  console.log(
    `Wrote ${toPosix(path.relative(ROOT, MANIFEST_PATH))} ` +
      `(${manifest.frameworkVersion}, schema v${manifest.schemaVersion}, ` +
      `${fileCount} files, ${derivedCount} derived, ` +
      `${agentSkillCount} skills, ${agentRuleCount} rules)`
  );
}

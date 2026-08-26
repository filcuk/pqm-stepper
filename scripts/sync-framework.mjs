/**
 * Sync framework-owned files from an upstream revision into this app tree.
 *
 * Usage:
 *   node scripts/sync-framework.mjs --from ../sma1-framework
 *   node scripts/sync-framework.mjs --version 0.9.0
 *   node scripts/sync-framework.mjs --from . --dry-run
 *   node scripts/sync-framework.mjs --from . --prune
 *
 * Reads `framework.lock.json` for version + component/skill selection. Never
 * overwrites app-owned paths. Regenerates `app/css/framework.css`. Merges
 * `APP_VERSION` when updating `app/version.js`. With `--prune`, deletes
 * `previousFiles` / retired paths when safe.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderFrameworkCssIndex } from "./lib/framework-catalogue.mjs";
import {
  collectPrunePaths,
  isAppOwnedPath,
  isPathReferencedInAppOwned,
  mergeVersionJs,
  parseArgs,
  resolveSelection,
  resolveUnder,
  toPosix,
} from "./lib/framework-resolve.mjs";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} root
 * @param {string} relative
 */
function readJson(root, relative) {
  const abs = resolveUnder(root, relative);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing ${relative}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

/**
 * @param {string} absPath
 * @param {unknown} value
 */
function writeJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * Preserve fork lock fields while refreshing version / source / defaults.
 * @param {object} lock
 * @param {object} manifest
 * @param {string} source
 */
export function buildUpdatedLock(lock, manifest, source) {
  const schemaVersion = Math.max(
    Number(lock.schemaVersion) || 1,
    Number(manifest.schemaVersion) || 1
  );

  /** @type {Record<string, unknown>} */
  const next = {
    ...lock,
    schemaVersion,
    frameworkVersion: lock.frameworkVersion,
    source,
    components: lock.components,
  };

  if (manifest.agent) {
    if (!Array.isArray(next.skills) || next.skills.length === 0) {
      next.skills = ["*"];
    }
  }

  return next;
}

/**
 * @param {string} source owner/repo
 * @param {string} version X.Y.Z
 * @param {string} destDir
 */
async function fetchTaggedTree(source, version, destDir) {
  const tag = version.startsWith("v") ? version : `v${version}`;
  const url = `https://github.com/${source}/archive/refs/tags/${tag}.tar.gz`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const archivePath = path.join(destDir, "upstream.tar.gz");
  fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));

  const extractDir = path.join(destDir, "extract");
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync("tar", ["-xzf", archivePath, "-C", extractDir], { stdio: "pipe" });

  const entries = fs.readdirSync(extractDir).filter((name) => {
    return fs.statSync(path.join(extractDir, name)).isDirectory();
  });
  if (entries.length !== 1) {
    throw new Error(`Expected one top-level directory in archive, found: ${entries.join(", ")}`);
  }
  return path.join(extractDir, entries[0]);
}

/**
 * @param {string} fromRoot
 * @param {string} toRoot
 * @param {string} relativePosix
 * @param {{ dryRun?: boolean }} [options]
 */
function copyFileRelative(fromRoot, toRoot, relativePosix, { dryRun = false } = {}) {
  const from = resolveUnder(fromRoot, relativePosix);
  const to = resolveUnder(toRoot, relativePosix);
  if (!fs.existsSync(from)) {
    throw new Error(`Upstream missing file: ${relativePosix}`);
  }
  if (dryRun) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/**
 * @param {string} root
 * @param {object} manifest
 * @param {{ components: string[], skills: string[] }} selection
 * @param {{ dryRun?: boolean }} [options]
 */
export function pruneRetiredPaths(root, manifest, selection, { dryRun = false } = {}) {
  const appOwned = manifest.appOwned || [];
  /** @type {string[]} */
  const pruned = [];
  /** @type {string[]} */
  const skipped = [];

  for (const rel of collectPrunePaths(manifest, selection)) {
    if (isAppOwnedPath(rel, appOwned)) {
      skipped.push(rel);
      console.warn(`  prune skip (app-owned path): ${rel}`);
      continue;
    }

    const abs = resolveUnder(root, rel);
    if (!fs.existsSync(abs)) continue;

    if (isPathReferencedInAppOwned(root, rel, appOwned)) {
      skipped.push(rel);
      console.warn(`  prune skip (still referenced from app-owned files): ${rel}`);
      continue;
    }

    if (!dryRun) {
      fs.rmSync(abs, { force: true });
    }
    pruned.push(rel);
  }

  return { pruned, skipped };
}

/**
 * @param {string[]} argv
 */
export async function runSync(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const root = path.resolve(args.root || DEFAULT_ROOT);
  const dryRun = args["dry-run"] === "true";
  const prune = args.prune === "true";
  const lockPath = args.lock || "framework.lock.json";

  /** @type {object} */
  let lock = readJson(root, lockPath);
  if (args.version) {
    lock = { ...lock, frameworkVersion: args.version.replace(/^v/, "") };
  }

  const source = lock.source || "filcuk/sma1-framework";
  let upstreamRoot;
  /** @type {string | null} */
  let tempDir = null;

  try {
    if (args.from) {
      upstreamRoot = path.resolve(args.from);
    } else {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sma1-framework-sync-"));
      console.log(`Fetching ${source}@v${lock.frameworkVersion}…`);
      upstreamRoot = await fetchTaggedTree(source, lock.frameworkVersion, tempDir);
    }

    const manifestPath = resolveUnder(upstreamRoot, "framework-manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `Upstream tree has no framework-manifest.json (${toPosix(upstreamRoot)}). ` +
          `Use a framework revision that includes the manifest, or pass --from a local checkout.`
      );
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const selection = resolveSelection(lock, manifest);
    const appOwned = manifest.appOwned || lock.appOwned || [];

    /** @type {string[]} */
    const copied = [];
    /** @type {string[]} */
    const skipped = [];

    for (const rel of selection.files) {
      if (isAppOwnedPath(rel, appOwned)) {
        skipped.push(rel);
        continue;
      }

      if (rel === "app/version.js") {
        const upstream = fs.readFileSync(resolveUnder(upstreamRoot, rel), "utf8");
        const localAbs = resolveUnder(root, rel);
        const local = fs.existsSync(localAbs) ? fs.readFileSync(localAbs, "utf8") : upstream;
        const merged = mergeVersionJs(local, upstream);
        if (!dryRun) {
          fs.mkdirSync(path.dirname(localAbs), { recursive: true });
          fs.writeFileSync(localAbs, merged, "utf8");
        }
        copied.push(rel);
        continue;
      }

      if (rel === "framework-manifest.json") {
        copyFileRelative(upstreamRoot, root, rel, { dryRun });
        copied.push(rel);
        continue;
      }

      copyFileRelative(upstreamRoot, root, rel, { dryRun });
      copied.push(rel);
    }

    const cssBody = renderFrameworkCssIndex(selection.css);
    const cssAbs = resolveUnder(root, "app/css/framework.css");
    if (!dryRun) {
      fs.mkdirSync(path.dirname(cssAbs), { recursive: true });
      fs.writeFileSync(cssAbs, cssBody, "utf8");
    }

    /** @type {{ pruned: string[], skipped: string[] }} */
    let pruneResult = { pruned: [], skipped: [] };
    if (prune) {
      pruneResult = pruneRetiredPaths(root, manifest, selection, { dryRun });
    }

    if (!dryRun) {
      writeJson(resolveUnder(root, lockPath), buildUpdatedLock(lock, manifest, source));
    }

    console.log(
      `Framework sync ${dryRun ? "(dry-run) " : ""}` +
        `v${lock.frameworkVersion}: ${copied.length} files, ` +
        `${selection.css.length} css partials, skipped app-owned=${skipped.length}` +
        (prune
          ? `, pruned=${pruneResult.pruned.length}, prune-skipped=${pruneResult.skipped.length}`
          : "")
    );
    console.log(`  components: ${selection.components.join(", ")}`);
    if (selection.skills.length > 0) {
      console.log(`  skills: ${selection.skills.join(", ")}`);
    }

    return {
      ok: true,
      dryRun,
      prune,
      frameworkVersion: lock.frameworkVersion,
      copied,
      skipped,
      pruned: pruneResult.pruned,
      pruneSkipped: pruneResult.skipped,
      selection,
    };
  } finally {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runSync().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

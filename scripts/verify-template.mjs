/**
 * Verify the working tree against template.lock.json + template-manifest.json.
 *
 * Usage:
 *   node scripts/verify-template.mjs
 *   node scripts/verify-template.mjs --root . --json
 *
 * Exit 0 when every selected catalogue file is identical and no unexpected
 * catalogue files remain. Agent skill/rule drift is reported softly and does
 * not fail the run.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseArgs,
  resolveUnder,
  verifyTemplateTree,
} from "./lib/template-resolve.mjs";

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
 * @param {string[]} argv
 */
export function runVerify(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const root = path.resolve(args.root || DEFAULT_ROOT);
  const lockPath = args.lock || "template.lock.json";
  const manifestPath = args.manifest || "template-manifest.json";

  const lock = readJson(root, lockPath);
  const manifest = readJson(root, manifestPath);

  if (lock.templateVersion && manifest.templateVersion && lock.templateVersion !== manifest.templateVersion) {
    console.warn(
      `Warning: lock templateVersion ${lock.templateVersion} != manifest ${manifest.templateVersion}`
    );
  }

  const report = verifyTemplateTree(root, lock, manifest);

  if (args.json === "true") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const skillCount = report.skills?.length || 0;
    console.log(
      `Template verify ${report.ok ? "OK" : "FAILED"} ` +
        `(v${report.templateVersion}, ${report.components.length} components` +
        (skillCount ? `, ${skillCount} skills` : "") +
        `)`
    );
    console.log(
      `  identical=${report.summary.identical} modified=${report.summary.modified} ` +
        `missing=${report.summary.missing} unexpected=${report.summary.unexpected}` +
        ` agentModified=${report.summary.agentModified || 0}` +
        ` agentMissing=${report.summary.agentMissing || 0}`
    );
    for (const warning of report.warnings || []) {
      console.warn(`  warning    ${warning}`);
    }
    for (const row of report.results) {
      if (row.status === "identical") continue;
      console.log(`  ${row.status.padEnd(13)} ${row.path}`);
    }
  }

  return report;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const report = runVerify();
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

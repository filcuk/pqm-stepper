#!/usr/bin/env node
/**
 * Fetch an icon body from the Iconify API (powers icones.js.org).
 * Prints JSON with exact markup, collection name, viewBox, and attribution key.
 *
 * Usage:
 *   node fetch-icon.mjs <icon-id>
 *   node fetch-icon.mjs <prefix:name>
 *   node fetch-icon.mjs <icon-id> --collection material-symbols
 *
 * Resolution (when collection not forced):
 *   1. ic (Material Icons Round) — framework core
 *   2. material-symbols (Rounded) — fallback
 *   3. Fail with hints (other collections need an explicit prefix)
 */

const ICONIFY = "https://api.iconify.design";

/** @type {Record<string, { attributionKey: string, label: string }>} */
const COLLECTIONS = {
  ic: {
    attributionKey: "materialIcons",
    label: "Google Material Icons (Round)",
  },
  "material-symbols": {
    attributionKey: "materialSymbols",
    label: "Material Symbols (Rounded)",
  },
};

function usage(exitCode = 1) {
  console.error(`Usage:
  node fetch-icon.mjs <icon-id>
  node fetch-icon.mjs <prefix:name>
  node fetch-icon.mjs <icon-id> --collection <prefix>

Examples:
  node fetch-icon.mjs round-keyboard-arrow-down
  node fetch-icon.mjs keyboard-arrow-down-rounded
  node fetch-icon.mjs mdi:chevron-down
  node fetch-icon.mjs info --collection ic`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  /** @type {{ query?: string, collection?: string }} */
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") usage(0);
    if (a === "--collection" || a === "-c") {
      out.collection = args[++i];
      continue;
    }
    if (a.startsWith("-")) {
      console.error(`Unknown flag: ${a}`);
      usage(1);
    }
    if (out.query) {
      console.error("Unexpected extra argument:", a);
      usage(1);
    }
    out.query = a;
  }
  if (!out.query) usage(1);
  return out;
}

/**
 * @param {string} query
 * @param {string | undefined} forcedCollection
 */
function buildCandidates(query, forcedCollection) {
  if (query.includes(":")) {
    const [prefix, name] = query.split(":");
    if (!prefix || !name) {
      throw new Error(`Invalid prefix:name "${query}"`);
    }
    return [{ prefix, name }];
  }

  if (forcedCollection) {
    return [{ prefix: forcedCollection, name: query }];
  }

  const name = query;
  /** @type {{ prefix: string, name: string }[]} */
  const candidates = [];

  // Explicit Round Material Icons id
  if (name.startsWith("round-")) {
    candidates.push({ prefix: "ic", name });
    const base = name.slice("round-".length);
    candidates.push({ prefix: "material-symbols", name: `${base}-rounded` });
    candidates.push({ prefix: "material-symbols", name: base });
    return candidates;
  }

  // Explicit Material Symbols rounded id
  if (name.endsWith("-rounded")) {
    candidates.push({ prefix: "material-symbols", name });
    const base = name.slice(0, -"-rounded".length);
    candidates.push({ prefix: "ic", name: `round-${base}` });
    candidates.push({ prefix: "material-symbols", name: base });
    return candidates;
  }

  // Bare / other id — prefer ic round, then symbols rounded
  candidates.push({ prefix: "ic", name: `round-${name}` });
  candidates.push({ prefix: "ic", name });
  candidates.push({ prefix: "material-symbols", name: `${name}-rounded` });
  candidates.push({ prefix: "material-symbols", name });
  return candidates;
}

/**
 * @param {string} prefix
 * @param {string} name
 */
async function fetchIcon(prefix, name) {
  const url = `${ICONIFY}/${prefix}.json?icons=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Iconify ${prefix} HTTP ${res.status}`);
  }
  const data = await res.json();
  let icon = data.icons?.[name];
  if (!icon && data.aliases?.[name]) {
    const parent = data.aliases[name].parent;
    icon = data.icons?.[parent];
  }
  if (!icon?.body) return null;

  const width = icon.width ?? data.width ?? 24;
  const height = icon.height ?? data.height ?? 24;
  return {
    prefix,
    name,
    body: icon.body,
    width,
    height,
  };
}

/**
 * @param {string} prefix
 */
async function fetchCollectionMeta(prefix) {
  const res = await fetch(`${ICONIFY}/collection?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * @param {string} prefix
 * @param {string} body
 * @param {string} name
 */
function assertExactBody(prefix, name, body) {
  // Re-fetch once and compare — guarantees what we emit matches the API.
  return fetchIcon(prefix, name).then((again) => {
    if (!again || again.body !== body) {
      throw new Error(`Exact-match check failed for ${prefix}:${name}`);
    }
  });
}

const { query, collection } = parseArgs(process.argv);
const candidates = buildCandidates(query, collection);

let resolved = null;
const tried = [];
for (const c of candidates) {
  tried.push(`${c.prefix}:${c.name}`);
  try {
    // eslint-disable-next-line no-await-in-loop
    const icon = await fetchIcon(c.prefix, c.name);
    if (icon) {
      resolved = icon;
      break;
    }
  } catch (err) {
    console.error(String(err));
  }
}

if (!resolved) {
  console.error(`Icon not found for "${query}". Tried:\n  - ${tried.join("\n  - ")}`);
  console.error(
    "Pass an explicit prefix (e.g. mdi:chevron-down) or --collection material-symbols.",
  );
  process.exit(2);
}

await assertExactBody(resolved.prefix, resolved.name, resolved.body);

const known = COLLECTIONS[resolved.prefix];
let attributionKey = known?.attributionKey ?? null;
let attributionHint = known?.label ?? null;

if (!known) {
  const meta = await fetchCollectionMeta(resolved.prefix);
  attributionHint =
    meta?.title ||
    meta?.name ||
    `Iconify collection "${resolved.prefix}" — add ICON_ATTRIBUTIONS entry if needed`;
}

const result = {
  collection: resolved.prefix,
  name: resolved.name,
  viewBox: `0 0 ${resolved.width} ${resolved.height}`,
  markup: resolved.body,
  attributionKey,
  attributionHint,
  iconesUrl: `https://icones.js.org/collection/${resolved.prefix}?s=${encodeURIComponent(resolved.name)}`,
  tried,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

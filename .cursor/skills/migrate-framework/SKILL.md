---
name: migrate-framework
description: >-
  Upgrade a microapp fork to a newer SMA1 Framework version with partial
  (used components only) or full catalogue upgrade. Use when migrating,
  upgrading the framework, syncing from upstream, or bumping FRAMEWORK_VERSION.
  During migration, ask whether to check new changelog additions against local
  app workarounds and offer each match individually to switch onto the
  framework API.
---

# Migrate framework

Bring a fork onto a newer framework revision without clobbering app-specific work.

Prefer `npm run sync:framework` + `npm run verify:framework` over hand-merging framework files. Read [../_shared/invariants.md](../_shared/invariants.md) and [../_shared/component-map.md](../_shared/component-map.md). Prefer upstream `CHANGELOG.md` for the version range when it exists. For the full lock/manifest model, see **Framework lock, manifest, and upgrades** in [`USAGE.md`](../../../USAGE.md).

## 1. Required ask — upgrade style

Before changing files, ask:

- **Partial** — upgrade shell/infra/tokens **and** only components the app already uses (or the user lists). Prefer for production forks.
- **Full** — upgrade the entire framework surface (`components: ["*"]`). Prefer when the fork still tracks the full catalogue.

Do not proceed until the user picks one.

## 2. Establish versions and source

1. Read fork `FRAMEWORK_VERSION` and `APP_VERSION` from `app/version.js`.
2. Identify upstream (default `filcuk/sma1-framework`, or user-specified remote/path).
3. Resolve target **tag** `vX.Y.Z` (required for fetch-based sync). Local `--from` is allowed for unreleased checkouts.
4. Read upstream `CHANGELOG.md` for entries between fork version and target (if present).
5. Note any **deprecated** / **retired** entries in upstream `framework-manifest.json` (`replacedBy`, `previousFiles`).

## 3. Required ask — local workarounds for new additions

Ask if it should also check for any new additions, and check whether similar additions were implemented locally in the app. If so, they should offer individually to migrate those to the framework features in order to reduce code spread.

Do this **after** reading the changelog (step 2) so the ask can name the app-facing additions, and **before** changing files. Do not start the local scan until **after** sync (step 5) so the new APIs exist in the tree.

1. From the changelog range, list **Added** items and API-facing **Changed** items an app might have polyfilled (`initShell` options, `data-*` attributes, new `initX` APIs, new CSS hooks). Skip bug fixes, demo-only, and docs-only lines. If the range has none, skip this ask.
2. Ask whether to check the app for local equivalents. Record yes or no; the scan itself runs after sync.

## 4. Protect app-owned files

Sync already refuses to overwrite these (see `framework-manifest.json` → `appOwned`):

- `index.html` / `demo.html`
- `app/main.js`, `app/demo.js`
- `app/config.js`
- `app/styles.css`, `app/css/app.css`
- `app/utils/icons-app.js`
- `app/res/`
- `APP_VERSION` inside `app/version.js` (merged; `FRAMEWORK_VERSION` updates)

Fork-local skills under `.cursor/skills/<other-id>/` are never copied (only catalogue skill ids are). Still merge carefully by hand when boot/chrome HTML in entry pages needs upstream fixes — sync does not rewrite entry HTML.

## 5. Apply upgrade via lock + sync

### Path moves (legacy forks)

If the fork still uses flat `app/dialog.js`-style paths, map them with component-map “Legacy path aliases” **before** or immediately after the first sync so imports resolve. Prefer upstream `replacedBy` / `previousFiles` when present.

### Partial

1. Trace used features (same discovery as `finalize-app`).
2. Set `framework.lock.json`:

```json
{
  "schemaVersion": 2,
  "frameworkVersion": "X.Y.Z",
  "source": "filcuk/sma1-framework",
  "components": ["dialog", "combobox"],
  "skills": ["*"]
}
```

Always-on shell pieces (`tooltip`, `banner`, core CSS, etc.) are included automatically by sync. Omitted `skills` defaults to `["*"]` on schema v2 manifests.

3. Run:

```bash
npm run sync:framework -- --version X.Y.Z
# or: npm run sync:framework -- --from /path/to/sma1-framework
npm run verify:framework
```

4. Reconcile **hard** verify drift (`modified` / `missing` / `unexpected`) on catalogue `app/` files. Agent skill/rule drift (`agentModified` / `agentMissing`) is soft — report it, do not “fix” docs to appease the hash unless the fork intends to track upstream skills.

### Full

Same as partial, but `"components": ["*"]`.

### Agent skills after sync

- Sync refreshes listed framework skills and `.cursor/rules/*`.
- To customise a framework skill: **fork it** — copy to a new folder id, change frontmatter `name` and `description`, then exclude the original:

```json
"skills": ["*", "-init-app"]
```

- Review `git diff .cursor/` after sync.
- If verify warns about prune candidates (retired / `previousFiles` still on disk), ask before running:

```bash
npm run sync:framework -- --from /path/to/upstream --prune
```

(or `--version X.Y.Z --prune`). Prune skips paths still referenced from app-owned files.

### Deprecated / retired ids

- **Deprecated** (still shipped): warn the user; plan migration via `replacedBy` when set.
- **Retired**: rewrite app imports to `replacedBy` (or drop the feature), then `--prune` to remove `previousFiles`.

### After sync

- Re-wire broken app imports if the fork still referenced old paths.
- Preserve `__MICROAPP__` / theme key renames the fork already made.
- Do **not** bump `APP_VERSION` unless the user asks.
- Missing icon artwork → **`handle-assets`** (`icons-app.js` only).
- If the user opted in at step 3, fold local workarounds now (below). If they declined or the changelog range had nothing to check, skip.

### Fold local workarounds

Only when the user opted in at step 3:

1. Scan **app-owned** paths (`index.html`, `demo.html`, `app/main.js`, `app/demo.js`, `app/config.js`, `app/styles.css`, `app/css/app.css`, `app/utils/icons-app.js`, `app/res/`) plus other fork-local files under `app/` that are not in the framework catalogue.
2. Look for the same UX implemented outside the new API: duplicate modules, CSS that hides or restyles the new framework UI, similar `data-*` / option names, custom copy of a shell helper, or comments that the framework lacked the feature.
3. Present each candidate **individually** (framework API, local files, proposed deletion/switch). Wait for a yes/no on that item before changing it. Do not batch-apply. If unsure it is a match, ask. If the local behaviour is richer than the new API, say so and only migrate when the user accepts the gap.
4. Apply accepted items only in app-owned / fork-local files. Do not patch hashed catalogue files to preserve a workaround.

Example: changelog adds `initShell({ headingLinks: false })` / `data-no-heading-links`. Local CSS hiding `.heading-link-btn`, a patched `heading-link.js`, or a custom copy-link control is a candidate — switch to the framework opt-out and remove the local code.

## 6. Finish

1. Confirm `FRAMEWORK_VERSION` matches the target (sync merges this into `app/version.js`).
2. Summarize what changed, agent-file drift, remaining manual conflicts, and which local workarounds were folded or declined.
3. Run **`health-check`**.

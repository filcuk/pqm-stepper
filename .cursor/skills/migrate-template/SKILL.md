---
name: migrate-template
description: >-
  Upgrade a microapp fork to a newer SMA1 Framework version with partial
  (used components only) or full catalogue upgrade. Use when migrating,
  upgrading the template, syncing from upstream, or bumping TEMPLATE_VERSION.
---

# Migrate template

Bring a fork onto a newer template revision without clobbering app-specific work.

Prefer `npm run sync:template` + `npm run verify:template` over hand-merging template files. Read [../_shared/invariants.md](../_shared/invariants.md) and [../_shared/component-map.md](../_shared/component-map.md). Prefer upstream `CHANGELOG.md` for the version range when it exists. For the full lock/manifest model, see **Template lock, manifest, and upgrades** in [`USAGE.md`](../../../USAGE.md).

## 1. Required ask — upgrade style

Before changing files, ask:

- **Partial** — upgrade shell/infra/tokens **and** only components the app already uses (or the user lists). Prefer for production forks.
- **Full** — upgrade the entire template surface (`components: ["*"]`). Prefer when the fork still tracks the full catalogue.

Do not proceed until the user picks one.

## 2. Establish versions and source

1. Read fork `TEMPLATE_VERSION` and `APP_VERSION` from `app/version.js`.
2. Identify upstream (default `filcuk/sma1-framework`, or user-specified remote/path).
3. Resolve target **tag** `vX.Y.Z` (required for fetch-based sync). Local `--from` is allowed for unreleased checkouts.
4. Read upstream `CHANGELOG.md` for entries between fork version and target (if present).
5. Note any **deprecated** / **retired** entries in upstream `template-manifest.json` (`replacedBy`, `previousFiles`).

## 3. Protect app-owned files

Sync already refuses to overwrite these (see `template-manifest.json` → `appOwned`):

- `index.html` / `demo.html`
- `app/main.js`, `app/demo.js`
- `app/config.js`
- `app/styles.css`, `app/css/app.css`
- `app/utils/icons-app.js`
- `app/res/`
- `APP_VERSION` inside `app/version.js` (merged; `TEMPLATE_VERSION` updates)

Fork-local skills under `.cursor/skills/<other-id>/` are never copied (only catalogue skill ids are). Still merge carefully by hand when boot/chrome HTML in entry pages needs upstream fixes — sync does not rewrite entry HTML.

## 4. Apply upgrade via lock + sync

### Path moves (legacy forks)

If the fork still uses flat `app/dialog.js`-style paths, map them with component-map “Legacy path aliases” **before** or immediately after the first sync so imports resolve. Prefer upstream `replacedBy` / `previousFiles` when present.

### Partial

1. Trace used features (same discovery as `finalize-app`).
2. Set `template.lock.json`:

```json
{
  "schemaVersion": 2,
  "templateVersion": "X.Y.Z",
  "source": "filcuk/sma1-framework",
  "components": ["dialog", "combobox"],
  "skills": ["*"]
}
```

Always-on shell pieces (`tooltip`, `banner`, core CSS, etc.) are included automatically by sync. Omitted `skills` defaults to `["*"]` on schema v2 manifests.

3. Run:

```bash
npm run sync:template -- --version X.Y.Z
# or: npm run sync:template -- --from /path/to/sma1-framework
npm run verify:template
```

4. Reconcile **hard** verify drift (`modified` / `missing` / `unexpected`) on catalogue `app/` files. Agent skill/rule drift (`agentModified` / `agentMissing`) is soft — report it, do not “fix” docs to appease the hash unless the fork intends to track upstream skills.

### Full

Same as partial, but `"components": ["*"]`.

### Agent skills after sync

- Sync refreshes listed template skills and `.cursor/rules/*`.
- To customise a template skill: **fork it** — copy to a new folder id, change frontmatter `name` and `description`, then exclude the original:

```json
"skills": ["*", "-init-app"]
```

- Review `git diff .cursor/` after sync.
- If verify warns about prune candidates (retired / `previousFiles` still on disk), ask before running:

```bash
npm run sync:template -- --from /path/to/upstream --prune
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

## 5. Finish

1. Confirm `TEMPLATE_VERSION` matches the target (sync merges this into `app/version.js`).
2. Summarize what changed, agent-file drift, and any remaining manual conflicts for the user.
3. Run **`health-check`**.

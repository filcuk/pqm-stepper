---
name: migrate-template
description: >-
  Upgrade a microapp fork to a newer microapp-template version with partial
  (used components only) or full catalogue upgrade. Use when migrating,
  upgrading the template, syncing from upstream, or bumping TEMPLATE_VERSION.
---

# Migrate template

Bring a fork onto a newer template revision without clobbering app-specific work.

Prefer `npm run sync:template` + `npm run verify:template` over hand-merging template files. Read [../_shared/invariants.md](../_shared/invariants.md) and [../_shared/component-map.md](../_shared/component-map.md). Prefer upstream `CHANGELOG.md` for the version range when it exists.

## 1. Required ask — upgrade style

Before changing files, ask:

- **Partial** — upgrade shell/infra/tokens **and** only components the app already uses (or the user lists). Prefer for production forks.
- **Full** — upgrade the entire template surface (`components: ["*"]`). Prefer when the fork still tracks the full catalogue.

Do not proceed until the user picks one.

## 2. Establish versions and source

1. Read fork `TEMPLATE_VERSION` and `APP_VERSION` from `app/version.js`.
2. Identify upstream (default `filcuk/microapp-template`, or user-specified remote/path).
3. Resolve target **tag** `vX.Y.Z` (required for fetch-based sync). Local `--from` is allowed for unreleased checkouts.
4. Read upstream `CHANGELOG.md` for entries between fork version and target (if present).

## 3. Protect app-owned files

Sync already refuses to overwrite these (see `template-manifest.json` → `appOwned`):

- `index.html` / `demo.html`
- `app/main.js`, `app/demo.js`
- `app/config.js`
- `app/styles.css`, `app/css/app.css`
- `app/utils/icons-app.js`
- `app/res/`
- `APP_VERSION` inside `app/version.js` (merged; `TEMPLATE_VERSION` updates)

Still merge carefully by hand when boot/chrome HTML in entry pages needs upstream fixes — sync does not rewrite entry HTML.

## 4. Apply upgrade via lock + sync

### Path moves (legacy forks)

If the fork still uses flat `app/dialog.js`-style paths, map them with component-map “Legacy path aliases” **before** or immediately after the first sync so imports resolve.

### Partial

1. Trace used features (same discovery as `finalize-app`).
2. Set `template.lock.json`:

```json
{
  "schemaVersion": 1,
  "templateVersion": "X.Y.Z",
  "source": "filcuk/microapp-template",
  "components": ["dialog", "combobox"]
}
```

Always-on shell pieces (`tooltip`, `banner`, core CSS, etc.) are included automatically by sync.

3. Run:

```bash
npm run sync:template -- --version X.Y.Z
# or: npm run sync:template -- --from /path/to/microapp-template
npm run verify:template
```

4. Reconcile verify drift (`modified` / `missing` / `unexpected`). Do not hand-edit hashed template files to “make verify pass” unless the drift is an intentional fork patch you will carry forward.

### Full

Same as partial, but `"components": ["*"]`.

### After sync

- Re-wire broken app imports if the fork still referenced old paths.
- Preserve `__MICROAPP__` / theme key renames the fork already made.
- Do **not** bump `APP_VERSION` unless the user asks.
- Missing icon artwork → **`handle-assets`** (`icons-app.js` only).

## 5. Finish

1. Confirm `TEMPLATE_VERSION` matches the target (sync merges this into `app/version.js`).
2. Summarize what changed and any remaining manual conflicts for the user.
3. Run **`health-check`**.

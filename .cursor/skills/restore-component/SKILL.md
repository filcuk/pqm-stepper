---
name: restore-component
description: >-
  Copy trimmed SMA1 Framework components back into a fork (JS, CSS imports,
  vendor, icons via handle-assets, init wiring, markup). Use when adding back
  a component, restoring dropdown/dialog/table/etc., or expanding a trimmed app.
---

# Restore component

Add one or more catalogue features back into a fork that previously trimmed them.

Prefer the sync script over hand-copying. Read [../_shared/component-map.md](../_shared/component-map.md) and [../_shared/invariants.md](../_shared/invariants.md).

## 1. Choose features

Ask which component-map / catalogue `id`(s) to restore (e.g. `dialog`, `code-block`, `tabular-input`). Confirm source:

- Prefer upstream **tag matching** this fork’s `TEMPLATE_VERSION` (`vX.Y.Z`).
- If mid-migrate to a newer template, use that newer revision (or run `migrate-template` first).

Default upstream: `filcuk/sma1-framework` (or the remote / local path the user specifies).

## 2. Update the lock and sync

1. Edit `template.lock.json`:
   - Set `templateVersion` / `source` if needed.
   - Add the restored id(s) to `components` (replace `"*"` only when the fork intentionally tracks the full catalogue).
2. Run sync (never invent files by hand when the script can copy them):

```bash
npm run sync:template -- --version <X.Y.Z>
# or, with a local checkout of the template:
npm run sync:template -- --from /path/to/sma1-framework
```

Sync copies JS/CSS/vendor for the lock selection, regenerates `app/css/template.css`, refreshes `template-manifest.json`, and **does not** overwrite app-owned paths (`main.js`, `config.js`, `styles.css`, `css/app.css`, `icons-app.js`, `res/`, entry HTML).

3. Run verify and reconcile any `modified` / `missing` / `unexpected` report:

```bash
npm run verify:template
```

## 3. Icons

Required icon ids: reuse template catalogue entries (`icons-template.js` is synced). Missing **app-specific** artwork → **`handle-assets`** (stub in `icons-app.js` + request; never invent paths).

## 4. Wire the app

1. `import` + `initX` / `initXs` in the relevant page module (after `initShell()`).
2. Add minimal markup from `USAGE.md` / `demo.html` for that feature (adapt to the app’s UI).
3. Load vendor `<script>` tags on the page when required (Prism, Toast UI — see USAGE).

## 5. Finish

Run **`health-check`** (includes `verify:template` when the lock/manifest exist). Note any pending icon stubs awaiting the user.

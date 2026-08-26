---
name: author-component
description: >-
  Author a new reusable component in SMA1 Framework itself: scaffold
  initX/initXs JS, CSS partial, demo, USAGE/AGENTS docs, and component-map.
  Use when adding a new framework component, not when restoring one into a fork.
---

# Author component

For **framework maintainers** adding a new reusable feature. Forks restoring an existing feature should use `restore-component` instead.

Follow [../_shared/invariants.md](../_shared/invariants.md) and `.cursor/rules/usage-docs.mdc`. Confirm with the user before adding npm packages, CDN libraries, or a build step.

## 1. Design

Agree with the user:

- Feature id / public API (`initX` and/or `initXs(root)`)
- Markup classes and `data-*` attributes
- Which `app/css/` partial (existing vs new + `framework.css` `@import`)
- Selection highlight style when the control has a selected / pressed item state — **standard** (accent border + tinted background; contiguous selected neighbours join under one outer border) or **light** (lighter background only). Default to **standard** for lists/menus; **light** only for low-emphasis chrome (see [`DESIGN.md`](../../../DESIGN.md) — Selection highlights). Match an existing control’s CSS; do not invent a third look
- Icons needed → **`add-icon`** for Icônes pulls, or **`handle-assets`** for brand/custom stubs (never invent SVG)
- Whether demo section is required (default: yes for user-facing controls)

## 2. Scaffold

1. Add `app/components/<name>.js` (or a small folder if multi-file, like `date-picker/`).
2. Match existing patterns: `parseBooleanAttr` / `setHidden` from `dom.js`; shared Escape/click-outside via `document-listeners.js`; menus via `menu.js`.
3. Styles in the correct partial under `app/css/`; new partial only when no existing file fits — then `@import` it from `app/css/framework.css`.
4. Wire demo: section in `demo.html` + init in `app/demo.js`.
5. Docs same change:
   - `USAGE.md` — **Available features** row + **Using components** (markup + import)
   - `AGENTS.md` — module conventions table if a new `initX` pattern
6. Update [../_shared/component-map.md](../_shared/component-map.md) **and** [`scripts/lib/framework-catalogue.mjs`](../../../scripts/lib/framework-catalogue.mjs) (JS, CSS, vendor, icons, infra).
   - Vendor: put upstream files under `app/vendor/` only; the component owns access (UMD global or relative ESM). Do **not** add a per-vendor seam under `app/components/` for a single consumer — see [../../rules/vendor.mdc](../../rules/vendor.mdc).
7. Regenerate the manifest: `npm run manifest:framework` (and keep `framework.lock.json` on `"*"` for this repo).
8. Note a CHANGELOG bullet for the next `release-framework` (do not bump `FRAMEWORK_VERSION` here unless the user is releasing now).

## 3. Finish

```bash
npm run verify:framework
```

Run **`health-check`**. Leave `APP_VERSION` at `0.0.0` on the framework repo.

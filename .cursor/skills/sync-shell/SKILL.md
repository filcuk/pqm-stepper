---
name: sync-shell
description: >-
  Light-sync shell, theme, tokens, and shared infra from upstream SMA1 Framework
  without touching optional app components or main.js logic. Use when pulling
  shell-only updates, theme/token fixes, or chrome changes without a full migrate.
---

# Sync shell

Lighter alternative to `migrate-framework` when only chrome/infra should move.

Read [../_shared/invariants.md](../_shared/invariants.md). For component upgrades, use `migrate-framework` or `restore-component` instead.

## Scope (in)

Pull these from upstream (tag matching fork `FRAMEWORK_VERSION`, or a newer revision the user names):

| Area | Paths |
| ---- | ----- |
| Shell | `app/shell/**` |
| Theme boot | `app/theme-init.js` |
| Tokens / chrome CSS | `app/tokens.css`, `app/css/layout.css`, `app/css/controls-buttons.css`; refresh `app/css/framework.css` imports for those partials — never overwrite `app/styles.css` or `app/css/app.css` |
| Overlays used by shell | `app/css/overlays.css` if tooltip/banner styles changed; `app/components/tooltip.js`, `banner.js` when shell depends on them |
| Infra | `app/utils/dom.js`, `document-listeners.js`, `brand-icon.js` |
| Icons | `app/utils/icons-framework.js` (replace from upstream); `icons.js` merge helpers if changed; **never** overwrite `icons-app.js` |

Also update `FRAMEWORK_VERSION` in `app/version.js` when the sync intentionally tracks a newer framework release (ask if unclear). Do not change `APP_VERSION`. Prefer full-catalogue upgrades via `migrate-framework` (`sync:framework`) when more than shell/tokens changed.

## Scope (out)

Do **not** replace unless the user explicitly expands scope:

- Optional `app/components/*` (except tooltip/banner as above)
- `app/vendor/**`, Prism / Toast UI CSS
- `demo.html`, `app/demo.js`
- `app/main.js` / app page logic
- `app/config.js` fork settings
- Custom `app/res/` artwork
- **Cursor agent skills/rules** (`.cursor/skills/`, `.cursor/rules/`) — owned by `migrate-framework` / `npm run sync:framework`, not this light shell sync

## Icons merge

1. Replace `icons-framework.js` from upstream (and `icons.js` if the merge API changed).
2. **Keep** `icons-app.js` entirely; fork icons live only there.
3. Never invent path markup; missing needed icons → **`handle-assets`**.

## Workflow

1. Confirm upstream source and target revision.
2. Diff in-scope paths; apply updates without clobbering out-of-scope files.
3. Smoke-check boot still matches invariants (`theme-init` → styles → `initShell()`).
4. Run **`health-check`**.

If the user also needs component API fixes, stop and offer **`migrate-framework`** (partial).

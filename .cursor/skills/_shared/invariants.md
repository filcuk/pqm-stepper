# Framework invariants

Rules that lifecycle skills must not violate. Read alongside [component-map.md](component-map.md).

## Vanilla stack

- Plain HTML, CSS, and JavaScript ES modules.
- No new npm runtime deps, bundlers, or parallel styling systems unless the user explicitly approves.
- Dev-only: `npm ci` → `npm run lint` / `npm test` (ESLint).

## Page boot

Every HTML entry point:

1. Optional `window.__MICROAPP__` bridge **before** theme-init (theme key, app icons).
2. Blocking `app/theme-init.js` in `<head>`.
3. `app/styles.css` (fork entry: `tokens.css` → `css/framework.css` → `css/app.css` — edit partials / `app.css`, not a monolith).
4. Page module calls `initShell()` from `app/shell/shell.js` **first**, then app-specific inits.

Do not duplicate footer, theme toggle, or `#page-nav` markup in HTML — `renderPageShell()` owns that chrome.

## Visibility and listeners

- Show/hide with `setHidden()` from `app/utils/dom.js` (class **and** `hidden` attribute).
- Use `app/utils/document-listeners.js` for click-outside and Escape — do not add per-instance `document` listeners for those. Escape priorities: tutorials `110`, dialogs `100`, expandable surfaces `90`, menus / popovers `50`.

## Icons and brand assets

- Inline UI icons: framework catalogue in `app/utils/icons-framework.js`, fork additions in `app/utils/icons-app.js`, merged API in `app/utils/icons.js` (`data-icon` / `createIcon()`).
- **Never invent or generate** SVG path data or image bytes. Use existing ids, `{ ref: "…" }` aliases, [`add-icon`](../add-icon/SKILL.md) for Icônes / Iconify pulls (prefer `ic` Round; Material Symbols fallback), or blank stubs via [`handle-assets`](../handle-assets/SKILL.md).
- Brand rasters/SVGs live under `app/res/`. Same rule: wire paths; do not invent artwork.
- Sourced UI icons must keep `name` + `attribution` aligned with the collection id and `ICON_ATTRIBUTIONS`.

## Design system

- Tokens from `app/tokens.css` (`--bg`, `--surface`, `--input-bg`, `--accent`, `--accent-hover`, `--accent-fg`, …).
- Fork brand accent overrides belong in `app/css/app.css` (see **manage-color**).
- Existing classes: `.btn`, `.btn-primary`, `.modal`, `.banner`, `.callout`, `.section-panel`, `.code-block`, `.theme-toggle`, etc.
- **Selection highlights** (see [`DESIGN.md`](../../../DESIGN.md)): **standard** = accent border + tinted background, contiguous selected neighbours joined under one outer border (default for controls/lists); **light** = lighter background only (theme switch). Do not invent a third selection look.
- Respect `prefers-reduced-motion` (tokens + `prefersReducedMotion()` in JS).
- **Demo isolation:** showcase-only helpers may use `demo-*` in `demo.html` / `app/demo.js`. Shared shell, utils, and layout APIs must use generic class names (e.g. `.content-section`, `.content-tier`) — never hardcode `demo-*` selectors. See [`.cursor/rules/demo-isolation.mdc`](../../rules/demo-isolation.mdc).

## Language (technical vs docs)

- **American English** for technical identifiers: file names, CSS classes/custom properties, JS APIs, `data-*` attributes, form `name` values (align with web platform APIs — e.g. `color`, not `colour`).
- **British English** is fine in prose docs (`USAGE.md`, `README.md`, `CHANGELOG.md`, `DESIGN.md`) and user-visible copy.

## Versions

| Constant | File | Who bumps |
| -------- | ---- | --------- |
| `FRAMEWORK_VERSION` | `app/version.js` | Framework maintainers / migrate skill after upstream sync |
| `APP_VERSION` | `app/version.js` | App authors on the fork |

Do not bump the other constant unless the user asks.

Forks pin `framework.lock.json` (`frameworkVersion` + `components` + optional `skills`) and use `npm run sync:framework` / `npm run verify:framework`. Framework releases **must** create git tag `vX.Y.Z` so fetch-based sync can resolve the revision. See **Framework lock, manifest, and upgrades** in [`USAGE.md`](../../../USAGE.md).

## Agent skills and rules

- Framework-owned Cursor playbooks live under `.cursor/skills/<id>/` and rules under `.cursor/rules/`. They are hashed in `framework-manifest.json` and synced with the lock’s `skills` selection (`*` / `-id`).
- Fork-local skills must use a **distinct id** (folder + frontmatter `name`). Do not edit a framework skill in place — copy/rename it, customise `description`, and exclude the original with `"skills": ["*", "-original-id"]`.
- Shared maps (`_shared`) stay framework-owned; forks should not fork `_shared` unless they also stop selecting framework skills that depend on it.

## Deprecate, retire, and path moves

- Stable **ids** (component / skill) are the unit of selection and lifecycle; file paths may change.
- Same-id moves: update live `files` and list old paths in `previousFiles`.
- Id removal uses two stages: **deprecated** (still shipped) then **retired** (`previousFiles` prunable via `sync --prune`).
- **Never reuse** a retired / `previousFiles` path for a new live file — manifest generation rejects overlaps.

## GitHub Pages

- Entry HTML at repo root; shared assets under `app/`.
- `.github/workflows/pages.yml` `cp` list must match published HTML (`index.html`, optional `demo.html`).
- No backend-only APIs.

## Docs when changing the framework catalogue

- Reusable feature added/changed → update `USAGE.md` (and `AGENTS.md` / `demo.html` as needed) per `.cursor/rules/usage-docs.mdc`.
- Update [component-map.md](component-map.md) and `scripts/lib/framework-catalogue.mjs` in the same change; run `npm run manifest:framework`.
- Fork app-only logic in `main.js` does not require USAGE updates.

## Confirm before complexity

Ask the user before adding external dependencies, build tools, or non-trivial architecture (routers, state managers, SSR).

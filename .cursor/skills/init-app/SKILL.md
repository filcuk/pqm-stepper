---
name: init-app
description: >-
  Initialize a new app from SMA1 Framework: collect fork details, configure
  config/version/HTML, choose keep-all or selective components, wire branding
  via handle-assets and manage-color, and trim demo/Pages. Use when forking,
  scaffolding, or creating a new app from this framework.
---

# Init app

Turn a fresh framework clone/fork into a named app. Follow [../_shared/invariants.md](../_shared/invariants.md). Use [../_shared/component-map.md](../_shared/component-map.md) for selective trim.

## 1. Collect (block until known)

Ask for anything missing:

| Input | Where it lands |
| ----- | -------------- |
| App name / title / tagline | `index.html` (`<title>`, `<h1>`, `.tagline`, logo `alt`) |
| `repoUrl`, `appUrl` | `app/config.js` (and/or `initShell` overrides) |
| Initial `APP_VERSION` | `app/version.js` only — **do not** change `FRAMEWORK_VERSION` |
| Theme storage key | Default `microapp-theme`, or rename in `config.js` + `__MICROAPP__` |
| Also-see | Real links, remote `alsoSeeUrl`, topics whitelist, or `false` / `[]` to hide |
| Logo mode | Pair (`app-light` / `app-dark`) or single (`app.svg`) — assets via `handle-assets` |
| Primary accent | Light + dark `--accent` hex, or keep framework defaults — via **`manage-color`** into `app/css/app.css` |
| Keep demo? | Keep `demo.html` + `app/demo.js`, or delete and fix `pages.yml` |
| Component strategy | **Keep all** (default) or **Selective** (list feature ids) |

## 2. Component strategy

- **Keep all** — leave the full catalogue; keep `framework.lock.json` with `"components": ["*"]`; tell the user to run `finalize-app` before shipping.
- **Selective** — user lists needed [component-map](../_shared/component-map.md) ids; set `framework.lock.json` `components` to that list, then either delete unused files (same rules as `finalize-app`) or run `npm run sync:framework -- --from <framework>` after trimming the lock so the tree matches. Never delete Always keep / shell-required icons.

## 3. Apply config and chrome

1. Update `index.html`: title, brand text, replace `<main>` with app UI (or a minimal placeholder the user will flesh out).
2. Set `app/config.js` URLs and brand; remove framework example `alsoSee` entries unless the user supplied replacements.
3. Set `APP_VERSION` in `app/version.js` (leave `FRAMEWORK_VERSION` as shipped). Ensure `framework.lock.json` exists with matching `frameworkVersion` and the chosen `components` list.
4. Ensure boot: `__MICROAPP__` (if needed) → `theme-init.js` → `styles.css` → `app/main.js` with `initShell()` first.
5. Demo: keep, or delete `demo.html` + `app/demo.js` and drop `demo.html` from `.github/workflows/pages.yml`.
6. Brand / new UI icons → follow **`handle-assets`** (wire only; request files; do not invent artwork).
7. Primary accent → if the user supplied custom light/dark colours, follow **`manage-color`**; skip when keeping framework defaults.

## 4. Deploy checklist

- [ ] Title, heading, tagline, main content updated
- [ ] `APP_VERSION` set; `framework.lock.json` present
- [ ] `app/main.js` is more than a bare `initShell()` when the app has UI logic
- [ ] Demo decision reflected in files + `pages.yml`
- [ ] Branding assets supplied or explicitly pending via `handle-assets`
- [ ] Accent colour: framework defaults kept, or `manage-color` applied to `app/css/app.css`
- [ ] Remind user: GitHub **Settings → Pages → Source** = **GitHub Actions**

## 5. Finish

Run **`health-check`**. Report remaining TODOs (pending assets, selective trim deferred, etc.).

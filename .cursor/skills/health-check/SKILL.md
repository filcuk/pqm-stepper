---
name: health-check
description: >-
  Verify an SMA1 Framework app or fork against boot conventions, Pages
  deploy config, versions, icons/assets hygiene, framework lock/verify, and
  optional lint/test. Use after init, migrate, sync, restore, finalize, or
  when the user asks to health-check / verify / sanity-check the framework or app.
---

# Health check

Run after any lifecycle skill, or when the user asks to verify the app/framework.

Read [../_shared/invariants.md](../_shared/invariants.md) and [../_shared/component-map.md](../_shared/component-map.md) as needed.

## Workflow

Copy and fill:

```
Health check:
- [ ] Boot (HTML + initShell)
- [ ] pages.yml vs HTML
- [ ] Demo refs
- [ ] config / version
- [ ] Assets / icons
- [ ] Accent colour (if app.css overrides --accent)
- [ ] Framework lock / verify
- [ ] Lint / test (if node_modules)
- [ ] Unused scan (optional)
```

Report each item as **pass**, **fail**, or **skip** with a one-line reason. Fix only what the user asked for; otherwise list failures and stop.

### 1. Boot

For every root `*.html` entry:

- [ ] `app/theme-init.js` in `<head>` (blocking)
- [ ] `app/styles.css` linked (fork entry → tokens → `css/framework.css` → `css/app.css`)
- [ ] Page module is `type="module"`
- [ ] If theme/icon keys differ from defaults: `__MICROAPP__` bridge **before** theme-init
- [ ] Page module calls `initShell()` first (before other inits)

Fail if footer / theme toggle / `#page-nav` are hand-duplicated in HTML instead of coming from `renderPageShell()`.

### 2. Pages workflow

Read `.github/workflows/pages.yml`:

- [ ] `cp` list matches published HTML (`index.html`; `demo.html` only if the file exists)
- [ ] `app/` is copied into `_site`

### 3. Demo refs

- [ ] If `demo.html` is gone: no links to it from `index.html` / README; `pages.yml` does not copy it
- [ ] If demo kept: `app/demo.js` exists and is wired

### 4. Config / version

- [ ] `app/config.js`: `repoUrl`, `appUrl` look intentional (not leftover framework placeholders on a shipping fork, unless user kept them)
- [ ] `app/version.js`: valid SemVer for `APP_VERSION` and `FRAMEWORK_VERSION`
- [ ] Theme storage key in `config.js` matches `__MICROAPP__.themeStorageKey` when overridden

### 5. Assets / icons

- [ ] No invented SVG paths added in this session (paths only in `icons-framework.js` / `icons-app.js`)
- [ ] Shell-required icon ids present (see component-map)
- [ ] Brand files referenced by HTML / `APP_ICON_SRC` / `__MICROAPP__` exist under `app/res/`
- [ ] Blank `APP_ICONS` / `FRAMEWORK_ICONS` stubs (`markup: \`\``) or missing brand files are listed as **fail** or explicit **TODO** agreed with the user — not silent

If assets are incomplete, point at the `handle-assets` skill.

### 6. Accent colour

When `app/css/app.css` overrides `--accent` (light and/or dark):

- [ ] Matching `--accent-fg` (or token default for that theme) yields WCAG AA ≥ 4.5:1 against `--accent`
- [ ] Brand colour was not patched into synced `tokens.css` on a fork

```bash
node .cursor/skills/manage-color/scripts/contrast.mjs <accent-hex> [fg-hex]
```

**Fail** if contrast fails or accent was edited only in `tokens.css` on a fork. Point at **`manage-color`**. Skip when `app.css` does not set `--accent`.

### 7. Framework lock / verify (hard gate when present)

When `framework.lock.json` and `framework-manifest.json` exist (framework repo and modern forks):

```bash
npm run verify:framework
```

- [ ] Command exits 0
- [ ] `lock.frameworkVersion` matches `FRAMEWORK_VERSION` in `app/version.js` (warn if not)
- [ ] No unresolved `modified` / `missing` / `unexpected` files the user did not accept as intentional drift

**Fail** the health check if verify exits non-zero, unless the user explicitly waived drift. Prefer `migrate-framework` / `restore-component` (sync) to repair rather than hand-editing hashed files.

Skip with reason only on pre-manifest forks that have not adopted the lock yet — then recommend adding `framework.lock.json` via migrate.

### 8. Lint / test

If `node_modules` exists (or after `npm ci` if the user wants a full check):

```bash
npm run lint
npm test
```

Skip with reason if deps are not installed and the user did not ask to install.

### 9. Optional unused scan

When finalizing or on request: compare entry import graphs + markup hooks to [component-map.md](../_shared/component-map.md) (and/or `framework.lock.json` components). Report unused catalogue ids / CSS partials / vendor — do not delete unless the user asked (`finalize-app`).

## Output format

```markdown
## Health check result

| Check | Status | Notes |
| ----- | ------ | ----- |
| Boot | pass / fail / skip | … |
| Framework verify | pass / fail / skip | … |
| … | … | … |

**Blockers:** …
**Warnings:** …
```

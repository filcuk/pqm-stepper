---
name: handle-assets
description: >-
  Wire brand logos, favicons, app/res files, and ICONS stubs
  without inventing artwork. Use when adding or replacing assets, logos, icons,
  favicons, or when init/restore/author needs user-supplied SVG or image files.
---

# Handle assets

Prepare paths and placeholders only. **Never create visual assets.**

Aligns with `.cursor/rules/icons.mdc` and [../_shared/invariants.md](../_shared/invariants.md).

## Hard rules

- **Never** generate, invent, or paste SVG path/`d` data, `<svg>` markup as artwork, or image bytes.
- **Never** invent “placeholder” graphics that look like final logos or icons.
- **Never** download copyrighted media without explicit user approval and attribution.
- **May** reuse existing `ICONS` ids or `{ ref: "existing-id" }`.
- **May** add a blank `ICONS` stub (empty `markup`, correct `viewBox`) when the user agrees to supply the icon.
- **May** wire HTML / `__MICROAPP__` / `brand-icon.js` paths to files the user will add.
- **UI icons from Icônes / Iconify:** use [`add-icon`](../add-icon/SKILL.md) (exact fetch) — do not invent paths or ask the user to paste when a collection id is known.
- Other lifecycle skills **must** use this skill (or `add-icon` for catalogue pulls) for missing artwork instead of inventing it.

## Asset kinds

| Kind | Typical paths | Config |
| ---- | ------------- | ------ |
| Brand pair (default) | `app/res/app-light.svg`, `app/res/app-dark.svg` | `APP_ICON_SRC.light` / `.dark`; header two `<img class="brand-icon--light\|dark">`; `__MICROAPP__.appIconLight` / `appIconDark` |
| Brand single | `app/res/app.svg` | `APP_ICON_SRC.icon`; clear light/dark; one `<img>` without `brand-icon--*` |
| Favicon | same as brand resolve | `<link rel="icon" … data-brand-icon>` + `__MICROAPP__` before theme-init |
| Inline UI icon | `app/utils/icons-app.js` `APP_ICONS` (forks) or `icons-framework.js` `FRAMEWORK_ICONS` (catalogue) | `data-icon="id"` or `createIcon("id")` via merged `icons.js` |
| Other res | `app/res/…` | Reference from HTML/CSS/JS only after file exists or user commits to add it |

Prefer [`add-icon`](../add-icon/SKILL.md) to pull UI icons from [Icônes — Material Icons Round](https://icones.js.org/collection/ic?s=info&variant=Round) (`viewBox: "0 0 24 24"`). Use this skill’s stub flow only when the user will supply custom artwork or a blank placeholder is enough for wiring.

## Workflow

### 1. Identify

List each missing or replacement asset: kind, target path or `ICONS` id, pair vs single, whether it blocks current work.

### 2. Prepare structure (no artwork)

- **Brand / res:** update paths in `index.html` (and other entries), `APP_ICON_SRC`, and `__MICROAPP__` as needed. Do not write SVG file contents.
- **UI icon:** if an existing id or `{ ref }` works, use it. Otherwise, only with user agreement, add:

```javascript
// In app/utils/icons-app.js → APP_ICONS:
"your-icon-id": {
  viewBox: "0 0 24 24",
  markup: ``,
  // name: "round-…",           // set when user sources from Icônes
  // attribution: ICON_ATTRIBUTIONS.materialIcons,
},
```

Update the `Available:` comment at the top of `icons-app.js` or `icons-framework.js` when adding an id.

- Wire `data-icon` / imports so the app builds around the stub.

### 3. Stop and request

Ask the user clearly. Use this shape:

```markdown
## Assets needed

| File or ICONS id | Kind | Notes |
| ---------------- | ---- | ----- |
| `app/res/app-light.svg` | Brand pair | Light theme logo |
| `app/res/app-dark.svg` | Brand pair | Dark theme logo |
| `APP_ICONS["my-icon"]` | UI icon | Paste path markup into `icons-app.js`; viewBox 0 0 24 24; source: Icônes Material Round |

Add the files (or paste icon markup into the stub), then tell me to continue.
```

Do not pretend the asset is done. If branding is on the critical path, wait. Non-asset work may continue only when the missing asset is not required for that work.

### 4. After the user supplies assets

- [ ] Files exist at the wired paths (or stub `markup` is non-empty)
- [ ] Pair vs single header markup matches config (pair: two imgs + `brand-icon--*`; single: one img)
- [ ] Favicon `href` / `__MICROAPP__` matches mode
- [ ] Sourced UI icons have `name` + `attribution` when required
- [ ] Pair-mode logos: meaningful `alt` on the visible variant; `aria-hidden="true"` on the duplicate

Then continue the calling skill. Optionally run `health-check`.

## What not to do

- Do not call image generation tools for logos or icons.
- Do not copy SVG paths from memory or the web into `ICONS` unless the **user** provided them for this task.
- Do not leave blank stubs without telling the user they still need to fill them.

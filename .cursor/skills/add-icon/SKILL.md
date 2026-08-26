---
name: add-icon
description: >-
  Pull inline SVG icons from Icônes / Iconify into icons-framework.js or
  icons-app.js with exact markup, matching name, and correct attribution.
  Defaults to Google Material Icons Round (ic); falls back to Material Symbols
  Rounded. Use when adding, replacing, or sourcing a UI icon from Icônes,
  Iconify, material icons, material symbols, or when the user names a collection
  icon id such as round-keyboard-arrow-down.
---

# Add icon

Fetch icons from [Icônes](https://icones.js.org) (Iconify API) into the framework catalogue or fork app icons. **Never invent or approximate path data** — only insert bodies returned by the fetch script.

Aligns with [`.cursor/rules/icons.mdc`](../../rules/icons.mdc) and [../_shared/invariants.md](../_shared/invariants.md). For brand rasters / blank stubs / path wiring without a catalogue pull, use [`handle-assets`](../handle-assets/SKILL.md).

## Collection preference

| Priority | Iconify prefix | Variant | `attribution` |
| -------- | -------------- | ------- | ------------- |
| 1 — framework core | `ic` | Round (`round-*`) | `ICON_ATTRIBUTIONS.materialIcons` |
| 2 — fallback | `material-symbols` | Rounded (`*-rounded`) | `ICON_ATTRIBUTIONS.materialSymbols` |
| 3 — other | explicit `prefix:name` (e.g. `mdi:…`) | as published | existing `ICON_ATTRIBUTIONS` key, or add one with user approval |

Do not prefer Material Symbols when an `ic` Round match exists, unless the user asks for Symbols (or another set) explicitly.

## Inputs

| Input | Required? | Meaning |
| ----- | --------- | ------- |
| Collection icon id | Yes | e.g. `round-keyboard-arrow-down`, `keyboard-arrow-down-rounded`, or `mdi:chevron-down` |
| App id | If not given, **ask** | Key in `FRAMEWORK_ICONS` / `APP_ICONS` (e.g. `chevron-down`) — used as `data-icon` |
| Place | If not given, **ask** | `framework` → `app/utils/icons-framework.js` · `app` → `app/utils/icons-app.js` |

### Example conversation

1. User: add `round-keyboard-arrow-down`
2. Agent: asks for **app id** and **place** (framework catalogue vs app) if missing
3. User: framework catalogue, name `chevron-down`
4. Agent: fetches, inserts, done

If the user already provides all three (`round-keyboard-arrow-down` as framework catalogue `chevron-down`), skip the questions.

## Workflow

Copy and track:

```
Add-icon progress:
- [ ] 1. Resolve inputs (collection id, app id, place)
- [ ] 2. Fetch via script (exact body)
- [ ] 3. Insert into icons-framework.js or icons-app.js
- [ ] 4. Update Available: header comment
- [ ] 5. Confirm name + attribution + markup match fetch output
```

### 1. Resolve inputs

- Parse collection id (allow `prefix:name`).
- If **app id** or **place** is missing, ask before fetching.
- If app id already exists in the target file (or the other file / merged set), ask before overwrite; offer `{ ref: "existing-id" }` when aliasing is enough.
- Prefer reuse / `{ ref }` over a duplicate pull when an existing icon is close enough — confirm with the user.

### 2. Fetch (mandatory)

From the repo root:

```bash
node .cursor/skills/add-icon/scripts/fetch-icon.mjs <icon-id>
```

Examples:

```bash
node .cursor/skills/add-icon/scripts/fetch-icon.mjs round-keyboard-arrow-down
node .cursor/skills/add-icon/scripts/fetch-icon.mjs keyboard-arrow-down-rounded
node .cursor/skills/add-icon/scripts/fetch-icon.mjs mdi:chevron-down
node .cursor/skills/add-icon/scripts/fetch-icon.mjs info --collection ic
```

The script:

1. Tries **`ic` Round first**, then **`material-symbols` Rounded**, unless the user forced a collection / `prefix:name`
2. Re-fetches once to assert an **exact** body match
3. Prints JSON: `collection`, `name`, `viewBox`, `markup`, `attributionKey`, `iconesUrl`

**Do not** paste paths from memory, chat, or a browser scrape. If the script exits non-zero, stop and report tried candidates.

For unknown collections (`attributionKey: null`), show `attributionHint` and ask before adding a new `ICON_ATTRIBUTIONS` entry in `icons-framework.js`.

### 3. Insert

Target:

- **framework catalogue** → `FRAMEWORK_ICONS` in `app/utils/icons-framework.js` (import `ICON_ATTRIBUTIONS` already in-file)
- **app** → `APP_ICONS` in `app/utils/icons-app.js` (import `ICON_ATTRIBUTIONS` from `./icons.js` or `./icons-framework.js` if needed)

Entry shape:

```javascript
"chevron-down": {
  viewBox: "0 0 24 24", // from fetch JSON
  markup: `<path fill="currentColor" d="…"/>`, // JSON.markup verbatim
  attribution: ICON_ATTRIBUTIONS.materialIcons, // JSON.attributionKey
  name: "round-keyboard-arrow-down", // JSON.name — collection id, not the app id
},
```

Rules:

- `markup` must equal fetch `markup` character-for-character (aside from surrounding backticks)
- `name` must equal fetch `name` (Iconify / Icônes id)
- `attribution` must use the `ICON_ATTRIBUTIONS` key from fetch (`materialIcons` / `materialSymbols` / approved new key)
- `viewBox` from fetch (Material sets are `0 0 24 24`)
- Do not invent SVG; do not “fix up” or pretty-print path `d` data

### 4. Header comment

Update the `Available:` list in the file you edited (`icons-framework.js` or `icons-app.js`).

### 5. Verify

- [ ] App id key is what the user chose
- [ ] `name` === fetch `name`
- [ ] `attribution` matches collection via `ICON_ATTRIBUTIONS`
- [ ] `markup` === fetch `markup`
- [ ] No duplicate path data outside the icons modules
- [ ] Optional: wire `data-icon="…"` / `createIcon("…")` if the calling task needs it

## Replacing an existing icon

Same workflow: fetch the collection id, confirm overwrite of the app id, replace `viewBox` / `markup` / `attribution` / `name` from the JSON. Keep the app id unless the user renames it.

## What not to do

- Do not invent, redraw, or AI-generate path data
- Do not copy SVG from memory or a stale local string when a fetch is possible
- Do not set `name` to the app id (app id is the object key; `name` is the collection id)
- Do not use Material Symbols when `ic` Round resolved successfully, unless the user asked for Symbols
- Do not put fork-specific icons in `icons-framework.js` or framework catalogue icons in `icons-app.js` unless the user overrides place

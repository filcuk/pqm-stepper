---
name: manage-color
description: >-
  Set or validate a microapp fork’s primary accent colours (light and dark
  --accent), pick --accent-fg for WCAG AA contrast on accent fills, and write
  overrides to fork-owned app/css/app.css. Use when changing primary/brand/
  accent colour, checking accent fill contrast, or when init-app collects a
  custom primary.
---

# Manage color

Configure fork brand accents without editing synced [`app/tokens.css`](../../../app/tokens.css). Aligns with [../_shared/invariants.md](../_shared/invariants.md).

## Token contract

| Token | Role | Who sets it |
| ----- | ---- | ----------- |
| `--accent` | Primary fill / links / focus | Fork (light + dark) |
| `--accent-hover` | Hover / pressed | Derived in `tokens.css` via `color-mix` — do not write unless the user insists on a custom hover |
| `--accent-fg` | Text and icons on accent fills | Auto-picked for AA, or user override |

Framework defaults (GitHub blues) already pass AA. Candidates for `--accent-fg`: `#ffffff` and `#0d1117` only (match the design system).

**Never** put brand colour overrides in `tokens.css` on a fork — sync/migrate can overwrite it. Write to [`app/css/app.css`](../../../app/css/app.css).

## Inputs

| Input | Required? |
| ----- | --------- |
| Light `--accent` hex | Yes (or “keep framework default”) |
| Dark `--accent` hex | Yes (or “keep framework default”) |
| Explicit `--accent-fg` per theme | Optional — otherwise pick via contrast |

If either theme keeps the framework default, skip writing that theme’s block (leave tokens as shipped).

## Workflow

```
Manage-color progress:
- [ ] 1. Collect light + dark accent (or keep defaults)
- [ ] 2. Resolve --accent-fg (contrast ≥ 4.5:1)
- [ ] 3. Write app/css/app.css overrides
- [ ] 4. Report ratios (accent + mixed hover vs fg)
```

### 1. Collect

Ask for missing light/dark hex values. Accept `#rgb` / `#rrggbb` (normalise to `#rrggbb`).

### 2. Resolve `--accent-fg`

For each accent that will be written:

```bash
node .cursor/skills/manage-color/scripts/contrast.mjs <accent-hex>
```

- Prefer the candidate with the higher ratio that is **≥ 4.5:1**.
- If the user supplied `--accent-fg`, verify it passes; if not, stop and ask for a different accent or fg.
- If **neither** `#ffffff` nor `#0d1117` reaches 4.5:1, **stop** — ask for a different accent shade. Do **not** invent a nearby colour without confirmation.

Light-theme default fg is `#ffffff`; dark-theme default is `#0d1117`. Omit `--accent-fg` from `app.css` when the chosen value matches that theme’s token default.

### 3. Write `app/css/app.css`

Merge into the existing file; preserve unrelated rules. Typical result:

```css
/**
 * Fork-owned styles. Never overwritten by framework sync.
 * Add app-specific rules here (or pull in additional local sheets).
 */

:root {
  --accent: #0969da;
}

:root[data-theme="dark"] {
  --accent: #58a6ff;
  /* --accent-fg only when not the dark default #0d1117 */
}
```

Do **not** write `--accent-hover` unless the user explicitly requests a custom hover hex (then set it in the same blocks).

### 4. Report

Print for each theme:

- Accent vs chosen fg ratio
- Derived hover note: `color-mix(in srgb, accent 80%, black|white)` vs fg (use `contrast.mjs --hover light|dark <accent-hex> [fg-hex]` when helpful)

## Hard rules

- Do not edit `tokens.css` for fork brand colour.
- Do not change `--banner-*`, danger, or other semantic colours here.
- Do not invent accent shades to “fix” contrast — ask the user.

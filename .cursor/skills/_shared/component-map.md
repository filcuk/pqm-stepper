# Component dependency map

Authoritative inventory for lifecycle skills (`init-app`, `finalize-app`, `restore-component`, `migrate-template`, etc.). Paths are relative to the repo root. Prefer this file over stale flat-path examples in USAGE.md (`app/dialog.js` → `app/components/dialog.js`).

Machine-readable twin: [`scripts/lib/template-catalogue.mjs`](../../scripts/lib/template-catalogue.mjs) → generated [`template-manifest.json`](../../template-manifest.json) via `npm run manifest:template`. When this map changes, update the catalogue module and regenerate the manifest.

When trimming: delete a feature’s JS only if unused; remove a **shared** CSS partial only when **no** remaining feature in that partial’s group needs it; never delete [invariants](invariants.md).

## Always keep (with `initShell`)

| Area | Paths |
| ---- | ----- |
| Entry | `app/theme-init.js`, `app/config.js`, `app/version.js`, `app/main.js` (or other page modules), `app/styles.css` (fork entry), `app/css/template.css` (generated index), `app/css/app.css` (fork-owned) |
| Shell | `app/shell/shell.js`, `render-shell.js`, `theme.js`, `page-nav.js`, `sticky.js`, `heading-link.js`, `external-link.js`, `also-see.js`, `title-numbering.js` |
| Infra | `app/utils/dom.js`, `document-listeners.js`, `icons.js`, `icons-template.js`, `icons-app.js`, `brand-icon.js` |
| Shell-pulled components | `app/components/tooltip.js`, `app/components/banner.js` (imported by `shell.js`) |
| Core CSS | `app/tokens.css`, `app/css/layout.css`, `app/css/controls-buttons.css`, `app/css/overlays.css` (tooltips + banners + modals styles) |
| Brand | `app/res/` logos as wired in HTML / `__MICROAPP__` |

Keep `app/utils/menu.js` if any popup menu remains (combo, dropdown, dropdown-toggle, tabular-input type menu).

## CSS partial → features

| Partial (`app/css/`) | Features that need it |
| -------------------- | --------------------- |
| `layout.css` | Shell, section layout, page nav, footer, theme toggle, sticky, title numbering |
| `controls-buttons.css` | Buttons, toolbar (always with shell) |
| `overlays.css` | tooltip, banner, dialog, callout |
| `code-block.css` | code-block, expandable-surface |
| `controls-badges.css` | badge |
| `controls-chips.css` | chip |
| `controls-fields.css` | field/input (CSS-only), combobox, date-picker, time-picker, duration-input |
| `controls-widgets.css` | toggle, checkbox, segmented-control, pagination, progress-bar, spinner, slider, stepper, color-input |
| `controls-section-panel.css` | section-panel (CSS-only pattern) |
| `controls-menus.css` | combo, dropdown, dropdown-toggle |
| `controls-disclosure.css` | expand, accordion, tabs, progress-indicator |
| `controls-file.css` | file-dropzone, file-download |
| `rich-text-editor.css` | rich-text-editor (+ `app/toastui-editor.css`) |
| `table.css` | table |
| `controls-tabular-input.css` | tabular-input |

Also wired from `app/css/template.css`: every partial above is `@import`ed there (and pulled in via `app/styles.css`). When removing the last consumer of a partial, drop its `@import` from `template.css` (sync regenerates this index from the lock/manifest).

## Feature catalogue

Icons listed are **required by the component JS or typical markup**. Banner/status icons used only in demo markup are optional unless the app uses those variants.

| id | JS | CSS | Vendor / extra | Icons | Infra | Notes |
| -- | -- | --- | -------------- | ----- | ----- | ----- |
| tooltip | `app/components/tooltip.js` | `overlays.css` | — | — | — | Always via `initShell` |
| banner | `app/components/banner.js` | `overlays.css` | — | Markup: `note`, `info`, `success`, `important`, `warning`, `error` as used | `dom` | Always via `initShell` (error banner) |
| dialog | `app/components/dialog.js` | `overlays.css` | — | — | `dom`, `document-listeners` | |
| about-dialog | `app/components/about-dialog.js` | `overlays.css`, `layout.css` (`.tagline-link`) | — | — | `dom`; wraps `dialog` | Tagline “What?” + progressive Huh? stages |
| badge | `app/components/badge.js` | `controls-badges.css` | — | — | `dom` | |
| chip | `app/components/chip.js` | `controls-chips.css` | — | — | `dom` | |
| combobox | `app/components/combobox.js` | `controls-fields.css`; multi also `controls-badges.css` | — | — | `dom`, `document-listeners`; multi: badge | Multi via `data-combobox-multi` |
| date-picker | `app/components/date-picker/` (`index.js`, `calendar.js`, `parse.js`) | `controls-fields.css` | — | Markup: `calendar` | `dom`, `document-listeners` | |
| time-picker | `app/components/time-picker.js` | `controls-fields.css` | — | — | `dom` | Native `type="time"` |
| duration-input | `app/components/duration-input.js` | `controls-fields.css` | — | — | `dom` | Hours:minutes; optional seconds |
| color-input | `app/components/color-input.js` | `controls-widgets.css` | — | — | `dom` | Hex field + swatch; optional alpha; not a spectrum picker |
| toggle | `app/components/toggle.js` | `controls-widgets.css` | — | Markup: `check`; tristate also `remove` | `dom`, `icons` | |
| checkbox | `app/components/checkbox.js` | `controls-fields.css` | — | JS face: `check`, `minus` | `dom`, `icons` | Tri-state checkbox; faces via `initIcons` / `ensureCheckboxFace` |
| segmented-control | `app/components/segmented-control.js` | `controls-widgets.css` | — | — | `dom` | |
| pagination | `app/components/pagination.js` | `controls-widgets.css` | — | `chevron-left`, `chevron-right` | `dom` | |
| progress-bar | `app/components/progress-bar.js` | `controls-widgets.css` | — | — | `dom` | |
| spinner | `app/components/spinner.js` | `controls-widgets.css` | — | — | `dom` | |
| slider | `app/components/slider.js` | `controls-widgets.css` | — | — | `dom` | |
| stepper | `app/components/stepper.js` | `controls-widgets.css` | — | — | `dom` | |
| combo | `app/components/combo.js` | `controls-menus.css` | — | — (CSS chevron) | `menu` | |
| dropdown | `app/components/dropdown.js` | `controls-menus.css` | — | — (CSS chevron) | `menu` | |
| dropdown-toggle | `app/components/dropdown-toggle.js` | `controls-menus.css` | — | — | `menu`, badge | |
| expand | `app/components/expand.js` | `controls-disclosure.css` | — | `chevron-right` | `dom`, `icons` | |
| accordion | `app/components/accordion.js` | `controls-disclosure.css` | — | `chevron-right` | `dom`, `icons` | |
| tabs | `app/components/tabs.js` | `controls-disclosure.css` | — | — | `dom` | |
| progress-indicator | `app/components/progress-indicator.js` | `controls-disclosure.css` | — | — | `dom` | |
| file-dropzone | `app/components/file-dropzone.js` | `controls-file.css` | — | Markup: `upload`; JS: `error` | `dom`, `icons` | |
| file-download | `app/components/file-download.js` | `controls-file.css` | — | `download` | `icons` | |
| code-block | `app/components/code-block.js` | `code-block.css` | `app/vendor/prism/`, `app/prism.css` | `clear`, `copy`, `paste`, `lines`, `highlight`, `fullscreen` | `dom`, `clipboard`, `icons` | Load Prism scripts on the page |
| expandable-surface | `app/components/expandable-surface.js` | `code-block.css` | — | `fullscreen`, `fullscreen-exit` | `dom`, `document-listeners`, `icons`; closes `tooltip` | Code-block floating maximise respects `data-code-surface-actions` |
| table | `app/components/table.js` | `table.css` | — | `chevron-up` (sort) | `dom`, `icons` | |
| tabular-input | `app/components/tabular-input.js` | `controls-tabular-input.css` | — | `copy`, `paste`, `paste-special`, `plus`, `delete`, `remove`, `chevron-up`, `chevron-down` | `dom`, `document-listeners`, `menu`, `icons`, `clipboard`; closes `tooltip` | |
| rich-text-editor | `app/components/rich-text-editor.js`, `toastui-editor.js`, `segmented-control.js` | `rich-text-editor.css`; mode switch also `controls-widgets.css` | `app/vendor/toastui-editor/`, `app/vendor/toastui-editor-plugin-table-merged-cell/`, `app/toastui-editor.css` | — | `config`, `dom`; mode switch: segmented-control | Large vendor bundle; Markdown/WYSIWYG uses segmented control |

## CSS-only / shell patterns (no dedicated component module)

| id | Markup / CSS | Notes |
| -- | ------------ | ----- |
| buttons | `.btn*`, `controls-buttons.css` | Always keep with shell |
| toolbar | `.toolbar` | Layout helper; no JS module |
| fields | `.field`, `.input`, `.textarea`, … | Base field styles in `controls-fields.css` |
| section-panel | `.section-panel`, `controls-section-panel.css` | Demo pattern; drop partial if unused |
| callout | `.callout`, `overlays.css` | CSS-only tip card; keep `overlays.css` if banners/tooltips/dialogs remain |
| page-nav | `app/shell/page-nav.js`, `layout.css` | Via `initShell` |
| heading-link | `app/shell/heading-link.js` | Icon: `link` |
| external-link | `app/shell/external-link.js` | Icon: `arrow-outward` |
| also-see | `app/shell/also-see.js` | Icon: `arrow-outward` |
| theme-toggle | `app/shell/theme.js` + render-shell | Icons: `light-mode`, `dark-mode`, `auto-mode` |
| sticky | `app/shell/sticky.js` | Optional `data-sticky-*` |
| title-numbering | `app/shell/title-numbering.js` | Optional `data-title-numbering`; CSS `.title-number` in `layout.css` |

## Shell-required icons

Do not remove these from `ICONS` while using `initShell`:

`light-mode`, `dark-mode`, `auto-mode`, `chevron-up`, `chevron-down`, `arrow-outward`, `link`

## Demo / Pages

| Keep as reference | Remove when shipping without demo |
| ----------------- | --------------------------------- |
| `demo.html`, `app/demo.js` | Delete both; drop `demo.html` from `.github/workflows/pages.yml` `cp` line |
| Prism / Toast UI | Only if no app page uses code-block / rich-text-editor |

## Legacy path aliases (migrate)

| Old (USAGE / older forks) | Current |
| ------------------------- | ------- |
| `app/dialog.js`, `app/combo.js`, … | `app/components/<name>.js` |
| `app/icons.js` | `app/utils/icons.js` (merge API; definitions in `icons-template.js` / `icons-app.js`) |
| `app/page-nav.js`, `app/heading-link.js`, … | `app/shell/<name>.js` |
| `app/file-dropzone.js` | `app/components/file-dropzone.js` |

## Trim decision algorithm

1. Collect entry HTML files → their `type=module` scripts → transitive imports.
2. Scan markup for feature hooks (`.tabs`, `.modal`, `data-expandable-surface`, `.file-dropzone`, etc.).
3. Mark a catalogue `id` **used** if imported or markup-matched.
4. Unused ids → candidates to delete (JS + exclusive vendor).
5. For each CSS partial, if no remaining used feature maps to it → drop `@import` from `app/css/template.css` and delete the file.
6. Never delete Always keep / shell-required icons / invariants.

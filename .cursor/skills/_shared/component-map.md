# Component dependency map

Authoritative inventory for lifecycle skills (`init-app`, `finalize-app`, `restore-component`, `migrate-framework`, etc.). Paths are relative to the repo root. Prefer this file over stale flat-path examples in USAGE.md (`app/dialog.js` → `app/components/dialog.js`).

Machine-readable twin: [`scripts/lib/framework-catalogue.mjs`](../../scripts/lib/framework-catalogue.mjs) → generated [`framework-manifest.json`](../../framework-manifest.json) via `npm run manifest:framework`. When this map changes, update the catalogue module and regenerate the manifest.

When trimming: delete a feature’s JS only if unused; remove a **shared** CSS partial only when **no** remaining feature in that partial’s group needs it; never delete [invariants](invariants.md).

## Always keep (with `initShell`)

| Area | Paths |
| ---- | ----- |
| Entry | `app/theme-init.js`, `app/config.js`, `app/version.js`, `app/main.js` (or other page modules), `app/styles.css` (fork entry), `app/css/framework.css` (generated index), `app/css/app.css` (fork-owned) |
| Shell | `app/shell/shell.js`, `render-shell.js`, `theme.js`, `page-nav.js`, `sticky.js`, `heading-link.js`, `external-link.js`, `also-see.js`, `title-numbering.js` |
| Infra | `app/utils/dom.js`, `document-listeners.js`, `icons.js`, `icons-framework.js`, `icons-app.js`, `brand-icon.js`, `button-label.js` |
| Shell-pulled components | `app/components/tooltip.js`, `app/components/banner.js` (imported by `shell.js`) |
| Core CSS | `app/tokens.css`, `app/css/layout.css`, `app/css/controls-buttons.css`, `app/css/overlays.css` (tooltips + banners + modals styles) |
| Brand | `app/res/` logos as wired in HTML / `__MICROAPP__` |

Keep `app/utils/menu.js` if any popup menu remains (combo, dropdown, dropdown-toggle, tabular-input type menu).

## CSS partial → features

| Partial (`app/css/`) | Features that need it |
| -------------------- | --------------------- |
| `layout.css` | Shell, section layout, page nav, footer, theme toggle, sticky, title numbering |
| `controls-buttons.css` | Buttons, toolbar, toggle-button (always with shell) |
| `overlays.css` | tooltip, banner, dialog, callout, popover |
| `tutorial.css` | tutorial |
| `code-block.css` | code-block, expandable-surface |
| `controls-badges.css` | badge |
| `controls-chips.css` | chip, legend |
| `controls-fields.css` | field/input (CSS-only), combobox, date-picker, time-picker, duration-input |
| `controls-widgets.css` | toggle, checkbox, segmented-control, pagination, progress-bar, spinner, slider, stepper, color-input, color-picker (channel sliders) |
| `controls-section-panel.css` | section-panel (CSS-only pattern) |
| `controls-menus.css` | combo, dropdown, dropdown-toggle, color-picker (format menu) |
| `controls-disclosure.css` | expand, accordion, tabs, progress-indicator |
| `controls-file.css` | file-dropzone, file-download |
| `controls-image.css` | image-preview |
| `controls-color.css` | color-set, color-picker |
| `controls-charts.css` | charts |
| `controls-diagram.css` | diagram |
| `rich-text-editor.css` | rich-text-editor (+ `app/toastui-editor.css`) |
| `table.css` | table |
| `controls-tabular-input.css` | tabular-input |

Also wired from `app/css/framework.css`: every partial above is `@import`ed there (and pulled in via `app/styles.css`). When removing the last consumer of a partial, drop its `@import` from `framework.css` (sync regenerates this index from the lock/manifest).

## Feature catalogue

Icons listed are **required by the component JS or typical markup**. Banner/status icons used only in demo markup are optional unless the app uses those variants.

| id | JS | CSS | Vendor / extra | Icons | Infra | Notes |
| -- | -- | --- | -------------- | ----- | ----- | ----- |
| tooltip | `app/components/tooltip.js` | `overlays.css` | — | — | — | Always via `initShell` |
| banner | `app/components/banner.js` | `overlays.css` | — | Markup: `note`, `info`, `success`, `important`, `warning`, `error`, `help`, `experiment`, `format-quote`, `tip` as used | `dom`, `icons` | Always via `initShell` (error banner) |
| dialog | `app/components/dialog.js` | `overlays.css` | — | — | `dom`, `document-listeners` | |
| about-dialog | `app/components/about-dialog.js` | `overlays.css`, `layout.css` (`.tagline-link`) | — | — | `dom`; wraps `dialog` | Tagline “What?” + progressive Huh? stages |
| popover | `app/components/popover.js` | `overlays.css` | — | JS: `clear` (dismiss) | `dom`, `document-listeners`, `icons` | Speech-bubble card; optional action icons |
| tutorial | `app/components/tutorial.js` | `tutorial.css`, `overlays.css` | — | Via popover: `clear`, `chevron-left`, `chevron-right` | `dom`, `document-listeners`; wraps `popover` | Spotlight tour; optional `when` / nested `steps`; Escape priority 110 |
| badge | `app/components/badge.js` | `controls-badges.css` | — | — | `dom` | |
| chip | `app/components/chip.js` | `controls-chips.css` | — | — | `dom` | |
| legend | `app/components/legend.js` | `controls-chips.css` | — | — | — | Coloured category chips; slots 1–8; optional toggle; tooltips via `data-tooltip` |
| combobox | `app/components/combobox.js` | `controls-fields.css`; multi also `controls-badges.css` | — | — | `dom`, `document-listeners`; multi: badge | Multi via `data-combobox-multi` |
| date-picker | `app/components/date-picker/` (`index.js`, `calendar.js`, `parse.js`) + time panel (`time-picker/index.js`, `panel.js`, `field.js`) | `controls-fields.css` | — | `calendar`, `chevron-up`, `chevron-down` | `dom`, `document-listeners`, `icons` | Optional side-by-side time panel |
| time-picker | `app/components/time-picker.js`, `app/components/time-picker/` (`index.js`, `panel.js`, `field.js`) | `controls-fields.css` | — | `clock`, `chevron-up`, `chevron-down` | `dom`, `document-listeners`, `icons` | Custom segmented popup; legacy native field fallback |
| duration-input | `app/components/duration-input.js`, `app/components/time-picker/panel.js` | `controls-fields.css` | — | `clock`, `chevron-up`, `chevron-down` | `dom`, `document-listeners`, `icons` | Inline segments + shared popup in duration mode |
| color-input | `app/components/color-input.js` | `controls-widgets.css` | — | — | `dom`, `color`; optional `color-set` / `color-picker` via `openOnClick` | Hex field + swatch; optional alpha; `openTrigger` `either`/`swatch`/`input` |
| color-set | `app/components/color-set/` (`index.js`, `panel.js`, `registry.js`, `sets/*`) | `controls-color.css` | — | — | `dom`, `document-listeners`, `color` | Named palette gallery; popup or embedded; one module per set |
| color-picker | `app/components/color-picker/` (`index.js`, `panel.js`) | `controls-color.css`, `controls-menus.css`, `controls-widgets.css` | — | JS: `chevron-down` (format menu), `palette` (colour sets toggle) | `dom`, `document-listeners`, `color`, `menu`, `icons`; uses `slider`; optional `color-set` | Spectrum / channel picker; RGB/CMYK/alpha via `initSlider`; format menu on hex field; optional adjacent colour set |
| toggle | `app/components/toggle.js` | `controls-widgets.css` | — | Markup: `check`; tristate also `remove` | `dom`, `icons` | |
| toggle-button | `app/components/toggle-button.js` | `controls-buttons.css` | — | Optional: `fullscreen`, `fullscreen-exit` (or any pair) | `dom`, `icons` | Pressed `.btn-toggle`; optional next-action label/icon swap; `data-toggle-button-always-active` drops the pressed accent styling |
| checkbox | `app/components/checkbox.js` | `controls-fields.css` | — | — | `dom`, `icons` | Tri-state checkbox; inset face via `initIcons` / `ensureCheckboxFace` |
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
| image-preview | `app/components/image-preview.js` | `controls-image.css` | — | Markup/JS: `download` when download enabled | `dom`, `icons`, `sanitize-svg`; download uses `file-download`; maximise: expandable-surface | Checkerboard host; `setSvg` (sanitized) / `setSrc` / `setBlob`; optional maximise, download, dimensions, file-size, SMIL frames/duration meta |
| code-block | `app/components/code-block.js` | `code-block.css` | `app/vendor/prism/`, `app/prism.css` | `clear`, `copy`, `paste`, `lines`, `highlight`, `fullscreen` | `dom`, `clipboard`, `button-label`, `icons` | Load Prism scripts on the page |
| expandable-surface | `app/components/expandable-surface.js` | `code-block.css` | — | `fullscreen`, `fullscreen-exit` | `dom`, `document-listeners`, `icons`; closes `tooltip` | Code-block floating maximise respects `data-code-surface-actions`; `data-expandable-surface-click` / `data-expandable-surface-control="false"` |
| table | `app/components/table.js` | `table.css` | — | `chevron-up` (sort) | `dom`, `icons` | |
| tabular-input | `app/components/tabular-input.js` | `controls-tabular-input.css` | — | `copy`, `paste`, `paste-special`, `plus`, `delete`, `remove`, `chevron-up`, `chevron-down` | `dom`, `document-listeners`, `menu`, `icons`, `clipboard`, `button-label`; closes `tooltip` | |
| rich-text-editor | `app/components/rich-text-editor.js`, `segmented-control.js` | `rich-text-editor.css`; mode switch also `controls-widgets.css` | `app/vendor/toastui-editor/`, `app/vendor/toastui-editor-plugin-table-merged-cell/`, `app/toastui-editor.css` | — | `config`, `dom`; mode switch: segmented-control | Large vendor bundle; Markdown/WYSIWYG uses segmented control; owns Toast UI global access (no separate seam file) |
| charts | `app/components/charts.js` | `controls-charts.css` | `app/vendor/tanstack-charts/`, `app/vendor/d3-scale/`, `app/vendor/d3-shape/` | — | `config` | Thin `mountChart` host; import map for `d3-scale` / `d3-shape` when using `barY` / `barX`; forks author `defineChart` |
| diagram | `app/components/diagram.js` | `controls-diagram.css` | `app/vendor/mermaid/` | — | `config`, `dom` | Thin Mermaid host; ESM entry lazy-loads diagram chunks; theme follows light/dark |

## CSS-only / shell patterns (no dedicated component module)

| id | Markup / CSS | Notes |
| -- | ------------ | ----- |
| buttons | `.btn*`, `controls-buttons.css` | Always keep with shell; `.btn-toggle` pressed styles shared with toggle-button |
| toolbar | `.toolbar` | Layout helper; no JS module |
| fields | `.field`, `.input`, `.textarea`, … | Base field styles in `controls-fields.css` |
| section-panel | `.section-panel`, `controls-section-panel.css` | Demo pattern; drop partial if unused |
| callout | `.callout`, `overlays.css` | CSS-only tip card; keep `overlays.css` if banners/tooltips/dialogs remain |
| page-nav | `app/shell/page-nav.js`, `layout.css` | Via `initShell` |
| heading-link | `app/shell/heading-link.js` | Icon: `link`; opt out with `initShell({ headingLinks: false })`, `data-no-heading-links`, or `data-no-heading-link` |
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
| Prism / Toast UI / TanStack Charts / Mermaid | Only if no app page uses code-block / rich-text-editor / charts / diagram |

## Legacy path aliases (migrate)

| Old (USAGE / older forks) | Current |
| ------------------------- | ------- |
| `app/dialog.js`, `app/combo.js`, … | `app/components/<name>.js` |
| `app/icons.js` | `app/utils/icons.js` (merge API; definitions in `icons-framework.js` / `icons-app.js`) |
| `app/page-nav.js`, `app/heading-link.js`, … | `app/shell/<name>.js` |
| `app/file-dropzone.js` | `app/components/file-dropzone.js` |
| `app/components/toastui-editor.js` | Merged into `app/components/rich-text-editor.js` (no separate seam) |

## Trim decision algorithm

1. Collect entry HTML files → their `type=module` scripts → transitive imports.
2. Scan markup for feature hooks (`.tabs`, `.modal`, `data-expandable-surface`, `.file-dropzone`, etc.).
3. Mark a catalogue `id` **used** if imported or markup-matched.
4. Unused ids → candidates to delete (JS + exclusive vendor).
5. For each CSS partial, if no remaining used feature maps to it → drop `@import` from `app/css/framework.css` and delete the file.
6. Never delete Always keep / shell-required icons / invariants.

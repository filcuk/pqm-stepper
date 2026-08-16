/**
 * Fork-owned inline SVG icons. Never overwritten by template sync.
 *
 * Add app-specific entries here (or blank stubs with empty `markup` when the
 * user will supply paths). Prefer `{ ref: "template-id" }` to alias a template
 * icon. Import `ICON_ATTRIBUTIONS` from `./icons.js` (or `./icons-template.js`)
 * when setting `attribution`.
 *
 * Available (app): syntax-highlight, step-highlight
 *
 * Verbose-names / always-number toolbar glyphs stay as inline text SVGs in
 * `index.html` (not catalogue icons).
 */

/** @typedef {{ viewBox: string, markup: string, attribution?: string, name?: string }} IconSvgDef */
/** @typedef {{ ref: string }} IconRefDef */
/** @typedef {IconSvgDef | IconRefDef} IconDef */

/** @type {Record<string, IconDef>} */
export const APP_ICONS = {
  "syntax-highlight": {
    viewBox: "0 0 20 20",
    markup: `<path d="M4 6h12M4 10h12M4 14h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  "step-highlight": {
    viewBox: "0 0 20 20",
    markup: `<rect class="highlight-icon-swatch hl-blue" x="2" y="2" width="7" height="7" rx="1.5"/><rect class="highlight-icon-swatch hl-green" x="11" y="2" width="7" height="7" rx="1.5"/><rect class="highlight-icon-swatch hl-amber" x="2" y="11" width="7" height="7" rx="1.5"/><rect class="highlight-icon-swatch hl-red" x="11" y="11" width="7" height="7" rx="1.5"/>`,
  },
};

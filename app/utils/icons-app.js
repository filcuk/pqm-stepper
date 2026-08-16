/**
 * Fork-owned inline SVG icons. Never overwritten by template sync.
 *
 * Add app-specific entries here (or blank stubs with empty `markup` when the
 * user will supply paths). Prefer `{ ref: "template-id" }` to alias a template
 * icon. Import `ICON_ATTRIBUTIONS` from `./icons.js` (or `./icons-template.js`)
 * when setting `attribution`.
 *
 * Available (app): (none yet — toolbar glyphs still live inline in index.html;
 * migrate them here via the add-icon / handle-assets skills)
 */

/** @typedef {{ viewBox: string, markup: string, attribution?: string, name?: string }} IconSvgDef */
/** @typedef {{ ref: string }} IconRefDef */
/** @typedef {IconSvgDef | IconRefDef} IconDef */

/** @type {Record<string, IconDef>} */
export const APP_ICONS = {};

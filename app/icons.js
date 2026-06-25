/**
 * Central inline SVG icons. Add or edit paths here, then use in HTML:
 *
 *   <button type="button" data-icon="light-mode" data-icon-class="theme-icon"></button>
 *
 * Or in JS: import { createIcon } from "./icons.js";
 *           button.append(createIcon("light-mode", { className: "theme-icon" }));
 *
 * Third-party icons may require attribution — set `attribution` on the icon
 * definition (see ICON_ATTRIBUTIONS). It is inserted as an SVG comment in the
 * rendered markup, e.g. <!-- Icon from … -->.
 *
 * Match `viewBox` to the source SVG (Material Icons from Icônes use `0 0 24 24`;
 * Octicons in this file use `0 0 16 16`). CSS width/height scales the icon to fit.
 *
 * For third-party icons, set `name` to the icon's name in the source collection
 * (e.g. `round-info` on Icônes) — metadata only; the `ICONS` key is the app id
 * used in `data-icon` / `createIcon()`.
 *
 * To reuse an existing icon under another id, set `ref` to the target key:
 *   lines: { ref: "note" },
 *
 * Available: light-mode, dark-mode, auto-mode, lines, info, success, note, warning, error, important, chevron-up, chevron-down
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Reusable attribution strings for licensed icon sets. */
export const ICON_ATTRIBUTIONS = {
  materialIcons:
    "Icon from Google Material Icons by Material Design Authors - https://github.com/material-icons/material-icons/blob/master/LICENSE",
};

/** @typedef {{ viewBox: string, markup: string, attribution?: string, name?: string }} IconSvgDef */
/** @typedef {{ ref: string }} IconRefDef */
/** @typedef {IconSvgDef | IconRefDef} IconDef */

/** @type {Record<string, IconDef>} */
export const ICONS = {
  "light-mode": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1m18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1M11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1m0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1M5.99 4.58a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41zm12.37 12.37a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41zm1.06-10.96a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0zM7.05 18.36a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-light-mode",
  },
  "dark-mode": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M11.57 2.3c2.38-.59 4.68-.27 6.63.64c.35.16.41.64.1.86C15.7 5.6 14 8.6 14 12s1.7 6.4 4.3 8.2c.32.22.26.7-.09.86c-1.28.6-2.71.94-4.21.94c-6.05 0-10.85-5.38-9.87-11.6c.61-3.92 3.59-7.16 7.44-8.1"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-nightlight",
  },
  "auto-mode": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2S2 6.48 2 12s4.48 10 10 10m1-17.93c3.94.49 7 3.85 7 7.93s-3.05 7.44-7 7.93z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-contrast",
  },
  lines: { ref: "note" },
  info: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 15c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1m1-8h-2V7h2z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-info",
  },
  success: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2M9.29 16.29L5.7 12.7a.996.996 0 1 1 1.41-1.41L10 14.17l6.88-6.88a.996.996 0 1 1 1.41 1.41l-7.59 7.59a.996.996 0 0 1-1.41 0"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-check-circle",
  },
  note: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M20 11H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1M4 18h10c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1M20 6H4c-.55 0-1 .45-1 1v.01c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V7c0-.55-.45-1-1-1"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-notes",
  },
  important: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="m12 17.27l4.15 2.51c.76.46 1.69-.22 1.49-1.08l-1.1-4.72l3.67-3.18c.67-.58.31-1.68-.57-1.75l-4.83-.41l-1.89-4.46c-.34-.81-1.5-.81-1.84 0L9.19 8.63l-4.83.41c-.88.07-1.24 1.17-.57 1.75l3.67 3.18l-1.1 4.72c-.2.86.73 1.54 1.49 1.08z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-star",
  },
  warning: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3M12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1m1 4h-2v-2h2z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-warning",
  },
  error: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10s10-4.47 10-10S17.53 2 12 2m4.3 14.3a.996.996 0 0 1-1.41 0L12 13.41L9.11 16.3a.996.996 0 1 1-1.41-1.41L10.59 12L7.7 9.11A.996.996 0 1 1 9.11 7.7L12 10.59l2.89-2.89a.996.996 0 1 1 1.41 1.41L13.41 12l2.89 2.89c.38.38.38 1.02 0 1.41"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-cancel",
  },
  "chevron-up": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M8.12 14.71L12 10.83l3.88 3.88a.996.996 0 1 0 1.41-1.41L12.7 8.71a.996.996 0 0 0-1.41 0L6.7 13.3a.996.996 0 0 0 0 1.41c.39.38 1.03.39 1.42 0"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-keyboard-arrow-up",
  },
  "chevron-down": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M15.88 9.29L12 13.17L8.12 9.29a.996.996 0 1 0-1.41 1.41l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59a.996.996 0 0 0 0-1.41c-.38-.38-1.03-.39-1.42 0"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-keyboard-arrow-down",
  },
};

/**
 * @param {string} name
 * @param {Set<string>} [seen]
 * @returns {IconSvgDef}
 */
function resolveIconDef(name, seen = new Set()) {
  if (seen.has(name)) {
    throw new Error(`Icon ref cycle: ${[...seen, name].join(" → ")}`);
  }

  const entry = ICONS[name];
  if (!entry) {
    throw new Error(`Unknown icon: ${name}`);
  }

  if ("ref" in entry) {
    seen.add(name);
    return resolveIconDef(entry.ref, seen);
  }

  return entry;
}

function appendAttribution(svg, text) {
  if (!text) return;
  svg.insertBefore(document.createComment(` ${text} `), svg.firstChild);
}

/**
 * @param {string} name
 * @param {{ className?: string, includeAttribution?: boolean }} [options]
 */
export function createIcon(name, { className = "", includeAttribution = true } = {}) {
  const def = resolveIconDef(name);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", def.viewBox);
  svg.setAttribute("aria-hidden", "true");
  if (className) {
    svg.setAttribute("class", className);
  }
  svg.innerHTML = def.markup;
  if (includeAttribution && def.attribution) {
    appendAttribution(svg, def.attribution);
  }
  return svg;
}

/**
 * @param {Element} element
 * @param {string} name
 * @param {{ className?: string, replace?: boolean, includeAttribution?: boolean }} [options]
 */
export function mountIcon(element, name, { className = "", replace = true, includeAttribution = true } = {}) {
  const iconClass = className || element.dataset.iconClass || "";
  const svg = createIcon(name, { className: iconClass, includeAttribution });

  if (replace) {
    element.replaceChildren(svg);
  } else {
    element.append(svg);
  }

  return svg;
}

/** Mount icons on elements with `data-icon` (optional `data-icon-class`). */
export function initIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    mountIcon(element, element.dataset.icon, {
      className: element.dataset.iconClass || "",
    });
  });
}

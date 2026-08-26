/**
 * Merged icon registry and render helpers.
 *
 * Framework definitions live in `icons-framework.js` (hashed / synced).
 * Fork definitions live in `icons-app.js` (never overwritten; win on key clash).
 *
 * Use in HTML:
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
 * Available (framework): see `icons-framework.js`. Available (app): see `icons-app.js`.
 */

import { ICON_ATTRIBUTIONS, FRAMEWORK_ICONS } from "./icons-framework.js";
import { APP_ICONS } from "./icons-app.js";

export { ICON_ATTRIBUTIONS };

const SVG_NS = "http://www.w3.org/2000/svg";

/** @typedef {{ viewBox: string, markup: string, attribution?: string, name?: string }} IconSvgDef */
/** @typedef {{ ref: string }} IconRefDef */
/** @typedef {IconSvgDef | IconRefDef} IconDef */

/** Merged registry: framework first, then app (app wins on duplicate keys). */
/** @type {Record<string, IconDef>} */
export const ICONS = { ...FRAMEWORK_ICONS, ...APP_ICONS };

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

/**
 * Wrap a checkbox input with an inset face host (checked square / mixed disc).
 * Safe to call more than once; no-ops when already enhanced.
 * @param {Element | null | undefined} inputEl
 */
export function ensureCheckboxFace(inputEl) {
  if (!(inputEl instanceof HTMLInputElement) || !inputEl.classList.contains("checkbox-input")) {
    return;
  }

  let control = inputEl.parentElement;
  if (!control?.classList.contains("checkbox-control")) {
    control = document.createElement("span");
    control.className = "checkbox-control";
    inputEl.replaceWith(control);
    control.append(inputEl);
  }

  if (control.querySelector(".checkbox-face")) return;

  const face = document.createElement("span");
  face.className = "checkbox-face";
  face.setAttribute("aria-hidden", "true");
  control.append(face);
}

/** Mount icons on elements with `data-icon` (optional `data-icon-class`). */
export function initIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    mountIcon(element, element.dataset.icon, {
      className: element.dataset.iconClass || "",
    });
  });

  root.querySelectorAll("input.checkbox-input").forEach((input) => {
    ensureCheckboxFace(input);
  });
}

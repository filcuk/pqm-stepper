/** HTML boolean attributes: `""`, `"true"`, or presence → true; absent → undefined. */
export function parseBooleanAttr(value) {
  if (value === undefined) return undefined;
  return value === "" || value === "true";
}

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Visible, focusable descendants of `root`. */
export function getFocusableElements(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => el.offsetParent !== null && !el.closest(".hidden")
  );
}

/** Keep Tab focus inside `root` while handling a keydown event. */
export function trapTabKey(event, root) {
  if (event.key !== "Tab") return;

  const focusable = getFocusableElements(root);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

const DEFAULT_INERT_SELECTOR = "body > header, body > main";

/** Toggle `inert` on page regions outside modal overlays (header + main by default). */
export function setPageInert(inert, { selector = DEFAULT_INERT_SELECTOR } = {}) {
  for (const el of document.querySelectorAll(selector)) {
    if (inert) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }
}

/** Toggle visibility using `.hidden` class and the `hidden` attribute together. */
export function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
  el.hidden = hidden;
}

/** Whether the user prefers reduced motion. */
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Resolve a selector string, element, or iterable to an array of elements. */
export function resolveElements(value) {
  if (!value) return [];
  if (typeof value === "string") {
    return [...document.querySelectorAll(value)];
  }
  if (value instanceof Element) return [value];
  return [...value];
}

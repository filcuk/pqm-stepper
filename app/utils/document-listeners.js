/** @typedef {{ handler: (event: Event) => boolean | void, priority: number }} EscapeEntry */
/** @typedef {(options?: { restoreFocus?: boolean }) => void} PopupCloser */

const clickOutsideHandlers = new Set();
/**
 * Anchored popups that are currently open (menus, pickers, …). Triggers call
 * `stopPropagation`, so peers never see an outside click — opening one popup
 * closes the others through this registry.
 * @type {Set<PopupCloser>}
 */
const openPopups = new Set();
/** Popups opened inside the current `openPopupGroup()` call. @type {Set<PopupCloser> | null} */
let groupedPopups = null;
/** @type {EscapeEntry[]} */
const escapeHandlers = [];
let bound = false;

function ensureBound() {
  if (bound) return;
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);
  bound = true;
}

function onDocumentClick(event) {
  for (const handler of clickOutsideHandlers) {
    handler(event);
  }
}

function onDocumentKeydown(event) {
  if (event.key !== "Escape") return;

  const ordered = [...escapeHandlers].sort((a, b) => b.priority - a.priority);
  for (const { handler } of ordered) {
    if (handler(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
}

/** Register a document click handler (e.g. close menus on outside click). */
export function onDocumentClickOutside(handler) {
  ensureBound();
  clickOutsideHandlers.add(handler);
  return () => clickOutsideHandlers.delete(handler);
}

/**
 * Mark an anchored popup as open. Closes every other open popup first, so only
 * one is ever visible. Call the returned function when the popup closes.
 * @param {PopupCloser} close
 */
export function registerOpenPopup(close) {
  for (const closePeer of [...openPopups]) {
    if (closePeer === close || groupedPopups?.has(closePeer)) continue;
    closePeer({ restoreFocus: false });
  }
  openPopups.add(close);
  groupedPopups?.add(close);
  return () => openPopups.delete(close);
}

/** Forget a popup closer without closing anything (teardown, manual close). */
export function unregisterOpenPopup(close) {
  openPopups.delete(close);
}

/**
 * Open several popups as one unit (e.g. a colour input showing its set and
 * picker together) — they stay open alongside each other, and the next popup
 * opened outside the group closes them all.
 * @template T
 * @param {() => T} run
 */
export function openPopupGroup(run) {
  const outer = groupedPopups;
  groupedPopups = outer ?? new Set();
  try {
    return run();
  } finally {
    groupedPopups = outer;
  }
}

/**
 * Register an Escape handler. Return true when the event is handled.
 * Higher priority runs first (dialogs before menus).
 */
export function onDocumentEscape(handler, { priority = 0 } = {}) {
  ensureBound();
  const entry = { handler, priority };
  escapeHandlers.push(entry);
  return () => {
    const index = escapeHandlers.indexOf(entry);
    if (index >= 0) escapeHandlers.splice(index, 1);
  };
}

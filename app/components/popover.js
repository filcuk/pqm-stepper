/**
 * Anchored speech-bubble popover with a notch pointing at a target.
 * Prefer this for interactive rich content; use tooltips for short text-only tips.
 */

import { createIcon } from "../utils/icons.js";
import {
  getFocusableElements,
  resolveElements,
  setHidden,
  trapTabKey,
} from "../utils/dom.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
} from "../utils/document-listeners.js";

const DEFAULT_GAP = 12;
const DEFAULT_NOTCH = 12;
const DEFAULT_PADDING = 8;

let popoverSeq = 0;

/** @typedef {"top" | "bottom" | "left" | "right"} PopoverSide */
/** @typedef {"auto" | PopoverSide} PopoverPosition */

/**
 * @typedef {{
 *   label: string,
 *   className?: string,
 *   onClick?: (event: MouseEvent) => void,
 *   closeOnClick?: boolean,
 *   disabled?: boolean,
 *   icon?: string,
 * }} PopoverAction
 */

/**
 * @param {PopoverSide} side
 * @returns {PopoverSide}
 */
function oppositeSide(side) {
  switch (side) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    default:
      return "left";
  }
}

/**
 * @param {PopoverPosition | undefined} value
 * @returns {PopoverPosition}
 */
function normalizePosition(value) {
  if (
    value === "top" ||
    value === "bottom" ||
    value === "left" ||
    value === "right" ||
    value === "auto"
  ) {
    return value;
  }
  return "auto";
}

/**
 * Pure placement helper — no DOM access. Prefer `position`, flip when short on
 * space, clamp to the viewport, and keep the notch aimed at the anchor centre.
 *
 * Pass `anchorRect: null` for a centred, notch-less card.
 *
 * @param {{
 *   anchorRect: {
 *     top: number,
 *     left: number,
 *     width: number,
 *     height: number,
 *     right?: number,
 *     bottom?: number,
 *   } | null,
 *   bubble: { width: number, height: number },
 *   viewport: { width: number, height: number },
 *   position?: PopoverPosition,
 *   gap?: number,
 *   notchSize?: number,
 *   padding?: number,
 * }} options
 * @returns {{
 *   top: number,
 *   left: number,
 *   side: PopoverSide | null,
 *   notchOffset: number,
 *   visible: boolean,
 * }}
 */
export function computePopoverPlacement(options) {
  const {
    anchorRect,
    bubble,
    viewport,
    position: positionOpt = "auto",
    gap = DEFAULT_GAP,
    notchSize = DEFAULT_NOTCH,
    padding = DEFAULT_PADDING,
  } = options;

  if (!anchorRect) {
    return {
      top: Math.max(padding, (viewport.height - bubble.height) / 2),
      left: Math.max(padding, (viewport.width - bubble.width) / 2),
      side: null,
      notchOffset: 0,
      visible: true,
    };
  }

  const rect = {
    top: anchorRect.top,
    left: anchorRect.left,
    width: anchorRect.width,
    height: anchorRect.height,
    right: anchorRect.right ?? anchorRect.left + anchorRect.width,
    bottom: anchorRect.bottom ?? anchorRect.top + anchorRect.height,
  };

  /* Clamp keeps an on-screen anchor’s bubble in view. When the anchor itself
     is fully off-screen, hide instead of pinning the bubble to an edge. */
  if (!rectIntersectsViewport(rect, viewport.width, viewport.height)) {
    return {
      top: 0,
      left: 0,
      side: null,
      notchOffset: 0,
      visible: false,
    };
  }

  /**
   * @param {PopoverSide} side
   */
  function spaceFor(side) {
    switch (side) {
      case "top":
        return rect.top - gap - padding;
      case "bottom":
        return viewport.height - rect.bottom - gap - padding;
      case "left":
        return rect.left - gap - padding;
      default:
        return viewport.width - rect.right - gap - padding;
    }
  }

  /**
   * @param {PopoverSide} side
   */
  function primarySize(side) {
    return side === "top" || side === "bottom" ? bubble.height : bubble.width;
  }

  /** @type {PopoverSide} */
  let side;
  const requested = normalizePosition(positionOpt);
  if (requested === "auto") {
    /** @type {PopoverSide[]} */
    const order = ["bottom", "top", "right", "left"];
    const fitting = order.filter((candidate) => spaceFor(candidate) >= primarySize(candidate));
    side =
      fitting[0] ??
      order.reduce((best, candidate) =>
        spaceFor(candidate) > spaceFor(best) ? candidate : best,
      );
  } else {
    side = requested;
    const needed = primarySize(side);
    if (spaceFor(side) < needed) {
      const flip = oppositeSide(side);
      if (spaceFor(flip) > spaceFor(side)) {
        side = flip;
      }
    }
  }

  const ax = rect.left + rect.width / 2;
  const ay = rect.top + rect.height / 2;

  let top = 0;
  let left = 0;

  switch (side) {
    case "bottom":
      top = rect.bottom + gap;
      left = ax - bubble.width / 2;
      break;
    case "top":
      top = rect.top - gap - bubble.height;
      left = ax - bubble.width / 2;
      break;
    case "right":
      left = rect.right + gap;
      top = ay - bubble.height / 2;
      break;
    default:
      left = rect.left - gap - bubble.width;
      top = ay - bubble.height / 2;
  }

  const maxLeft = Math.max(padding, viewport.width - bubble.width - padding);
  const maxTop = Math.max(padding, viewport.height - bubble.height - padding);
  left = Math.max(padding, Math.min(left, maxLeft));
  top = Math.max(padding, Math.min(top, maxTop));

  const notchInset = Math.max(notchSize, DEFAULT_NOTCH);
  let notchOffset = 0;
  if (side === "top" || side === "bottom") {
    notchOffset = ax - left;
    notchOffset = Math.max(
      notchInset,
      Math.min(notchOffset, bubble.width - notchInset),
    );
  } else {
    notchOffset = ay - top;
    notchOffset = Math.max(
      notchInset,
      Math.min(notchOffset, bubble.height - notchInset),
    );
  }

  return { top, left, side, notchOffset, visible: true };
}

/**
 * True when `rect` overlaps the viewport at all (any positive area).
 * @param {{ top: number, left: number, right: number, bottom: number, width?: number, height?: number }} rect
 * @param {number} vw
 * @param {number} vh
 */
export function rectIntersectsViewport(rect, vw, vh) {
  const width = rect.width ?? rect.right - rect.left;
  const height = rect.height ?? rect.bottom - rect.top;
  return (
    width > 0 &&
    height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < vh &&
    rect.left < vw
  );
}

/**
 * @param {string | Node | null | undefined} body
 * @returns {Node[]}
 */
function nodesFromBody(body) {
  if (body === null || body === undefined || body === "") return [];
  if (typeof body === "string") {
    const p = document.createElement("p");
    p.className = "popover__text";
    p.textContent = body;
    return [p];
  }
  if (body instanceof Node) return [body];
  return [];
}

/**
 * Anchored popover. Pass `anchor: null` for a centred, notch-less card.
 *
 * @param {{
 *   anchor?: Element | string | null,
 *   title?: string,
 *   body?: string | Node | null,
 *   position?: PopoverPosition,
 *   actions?: PopoverAction[],
 *   dismissible?: boolean,
 *   closeOnOutsideClick?: boolean,
 *   trapFocus?: boolean,
 *   className?: string,
 *   gap?: number,
 *   notchSize?: number,
 *   onClose?: () => void,
 * }} options
 */
export function initPopover(options = {}) {
  const {
    title = "",
    body = null,
    position: initialPosition = "auto",
    actions: initialActions = [],
    dismissible = true,
    className = "",
    gap = DEFAULT_GAP,
    notchSize = DEFAULT_NOTCH,
    onClose,
  } = options;
  const closeOnOutsideClick =
    options.closeOnOutsideClick !== undefined
      ? Boolean(options.closeOnOutsideClick)
      : dismissible;
  let trapFocus = options.trapFocus !== false;

  /** @type {HTMLElement | null} */
  let anchorEl = resolveAnchor(options.anchor);
  /** @type {PopoverPosition} */
  let position = normalizePosition(initialPosition);
  /** @type {PopoverAction[]} */
  let actions = Array.isArray(initialActions) ? [...initialActions] : [];

  const titleId = `popover-title-${++popoverSeq}`;

  const el = document.createElement("div");
  el.className = ["popover", "hidden", className].filter(Boolean).join(" ");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "false");
  el.setAttribute("aria-labelledby", titleId);
  el.tabIndex = -1;
  el.hidden = true;

  const notch = document.createElement("div");
  notch.className = "popover__notch";
  notch.setAttribute("aria-hidden", "true");

  const header = document.createElement("div");
  header.className = "popover__header";

  const titleEl = document.createElement("h2");
  titleEl.className = "popover__title";
  titleEl.id = titleId;
  titleEl.textContent = title;
  titleEl.hidden = !title;

  /** @type {HTMLButtonElement | null} */
  let closeBtn = null;
  if (dismissible) {
    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "popover__close btn btn-slim btn-icon";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.append(
      createIcon("clear", { className: "btn-icon-svg popover__close-icon" }),
    );
  }

  header.append(titleEl);
  if (closeBtn) header.append(closeBtn);
  header.hidden = !title && !closeBtn;
  if (title) {
    el.setAttribute("aria-labelledby", titleId);
  } else {
    el.removeAttribute("aria-labelledby");
  }

  const bodyEl = document.createElement("div");
  bodyEl.className = "popover__body";
  bodyEl.replaceChildren(...nodesFromBody(body));

  const footer = document.createElement("div");
  footer.className = "popover__footer";

  el.append(notch, header, bodyEl, footer);
  document.body.append(el);

  let isOpen = false;
  /** Last measured bubble size — used when the card is hidden off-screen. */
  let lastBubbleSize = { width: 0, height: 0 };
  /** Ignore the document click that opened us (same event bubbles to `document`). */
  let ignoreOutsideClick = false;
  /** @type {Element | null} */
  let previouslyFocused = null;

  function renderActions() {
    footer.replaceChildren();
    footer.hidden = actions.length === 0;
    for (const action of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = action.className || "btn";
      btn.disabled = Boolean(action.disabled);
      if (action.icon) {
        btn.append(
          createIcon(action.icon, { className: "btn-icon-svg" }),
          document.createTextNode(action.label),
        );
        btn.classList.add("popover__action--icon");
      } else {
        btn.textContent = action.label;
      }
      btn.addEventListener("click", (event) => {
        action.onClick?.(event);
        if (action.closeOnClick !== false) {
          close();
        }
      });
      footer.append(btn);
    }
  }

  renderActions();

  function applyPlacement() {
    let bubbleWidth = lastBubbleSize.width;
    let bubbleHeight = lastBubbleSize.height;
    if (!el.hidden) {
      const bubbleRect = el.getBoundingClientRect();
      if (bubbleRect.width > 0 && bubbleRect.height > 0) {
        bubbleWidth = bubbleRect.width;
        bubbleHeight = bubbleRect.height;
        lastBubbleSize = { width: bubbleWidth, height: bubbleHeight };
      }
    }

    const placed = computePopoverPlacement({
      anchorRect: anchorEl?.isConnected
        ? anchorEl.getBoundingClientRect()
        : null,
      bubble: { width: bubbleWidth, height: bubbleHeight },
      viewport: {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      },
      position,
      gap,
      notchSize,
    });

    if (!placed.visible) {
      setHidden(el, true);
      return;
    }

    el.style.top = `${placed.top}px`;
    el.style.left = `${placed.left}px`;
    el.style.setProperty("--popover-notch-offset", `${placed.notchOffset}px`);

    if (placed.side) {
      el.dataset.popoverSide = placed.side;
      notch.hidden = false;
    } else {
      delete el.dataset.popoverSide;
      notch.hidden = true;
    }

    if (isOpen) setHidden(el, false);
  }

  function onKeyDown(event) {
    if (!isOpen || !trapFocus) return;
    trapTabKey(event, el);
  }

  /**
   * Prefer primary action, then any footer action, then close, then the root.
   * @returns {HTMLElement}
   */
  function resolveInitialFocus() {
    const focusable = getFocusableElements(el);
    const footerButtons = [...footer.querySelectorAll("button")].filter(
      (btn) => focusable.includes(btn) && !btn.disabled,
    );
    const primary = footerButtons.find((btn) =>
      btn.classList.contains("btn-primary"),
    );
    return (
      primary ||
      footerButtons[0] ||
      (closeBtn && focusable.includes(closeBtn) ? closeBtn : null) ||
      focusable[0] ||
      el
    );
  }

  function onViewportChange() {
    if (isOpen) applyPlacement();
  }

  /**
   * @param {{
   *   title?: string,
   *   body?: string | Node | null,
   *   position?: PopoverPosition,
   *   actions?: PopoverAction[],
   * }} [patch]
   */
  function update(patch = {}) {
    if (patch.title !== undefined) {
      titleEl.textContent = patch.title;
      titleEl.hidden = !patch.title;
      header.hidden = !patch.title && !closeBtn;
      if (patch.title) {
        el.setAttribute("aria-labelledby", titleId);
      } else {
        el.removeAttribute("aria-labelledby");
      }
    }
    if (patch.body !== undefined) {
      bodyEl.replaceChildren(...nodesFromBody(patch.body));
    }
    if (patch.position !== undefined) {
      position = normalizePosition(patch.position);
    }
    if (patch.actions !== undefined) {
      actions = Array.isArray(patch.actions) ? [...patch.actions] : [];
      renderActions();
    }
    if (isOpen) applyPlacement();
  }

  /**
   * @param {Element | string | null | undefined} next
   */
  function setAnchor(next) {
    anchorEl = resolveAnchor(next);
    if (isOpen) applyPlacement();
  }

  function open() {
    if (isOpen) {
      applyPlacement();
      return;
    }

    previouslyFocused = document.activeElement;
    setHidden(el, false);
    el.classList.add("is-open");
    isOpen = true;
    /* Opening often happens inside a click handler; that same click reaches the
       document outside listener and would close us immediately. */
    ignoreOutsideClick = true;
    window.setTimeout(() => {
      ignoreOutsideClick = false;
    }, 0);
    applyPlacement();
    /* Second pass after layout settles (actions / wrapping can change size). */
    applyPlacement();

    resolveInitialFocus().focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;

    setHidden(el, true);
    el.classList.remove("is-open");
    isOpen = false;

    if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
      previouslyFocused.focus({ preventScroll: true });
    }
    previouslyFocused = null;
    onClose?.();
  }

  function onCloseClick() {
    close();
  }

  closeBtn?.addEventListener("click", onCloseClick);
  el.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange);

  const removeClickOutside = onDocumentClickOutside((event) => {
    if (!isOpen || !closeOnOutsideClick || ignoreOutsideClick) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (el.contains(target)) return;
    if (anchorEl?.contains(target)) return;
    close();
  });

  const removeEscape = onDocumentEscape(() => {
    if (!isOpen || !dismissible) return false;
    close();
    return true;
  }, { priority: 50 });

  return {
    open,
    close,
    update,
    setAnchor,
    /**
     * When false, Tab is not trapped inside the popover (e.g. interactive
     * tutorial steps that must reach the spotlighted control).
     * @param {boolean} enabled
     */
    setTrapFocus(enabled) {
      trapFocus = Boolean(enabled);
    },
    isOpen: () => isOpen,
    /** Underlying popover element (for advanced composition). */
    getElement: () => el,
    destroy() {
      if (isOpen) close();
      removeClickOutside();
      removeEscape();
      closeBtn?.removeEventListener("click", onCloseClick);
      el.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      el.remove();
    },
  };
}

/**
 * @param {Element | string | null | undefined} value
 * @returns {HTMLElement | null}
 */
function resolveAnchor(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const found = document.querySelector(value);
    return found instanceof HTMLElement ? found : null;
  }
  const resolved = resolveElements(value)[0];
  return resolved instanceof HTMLElement ? resolved : null;
}

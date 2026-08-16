/**
 * Tooltips: hover (default), timer (reaction flash), and persistent (tutorial).
 * See DESIGN.md — hover/timer share one slot; persistent tips are separate.
 */

import { createIcon } from "../utils/icons.js";

const GAP = 8;
const TOOLTIP_ID = "tooltip";
const TONE_CLASSES = ["tooltip--success", "tooltip--error"];

/** @typedef {"info" | "success" | "error"} TooltipTone */
/** @typedef {"hover" | "timer"} SharedSlotMode */

let tooltipEl = null;
/** @type {HTMLElement | null} */
let activeTarget = null;
/** @type {SharedSlotMode | null} */
let slotMode = null;
/** @type {string | null} */
let savedDescribedBy = null;

/**
 * @type {{
 *   target: HTMLElement,
 *   restoreText: string | null,
 *   restoreTone: string | null,
 *   timerId: ReturnType<typeof setTimeout>,
 * } | null}
 */
let timerState = null;

/**
 * @type {Map<string, {
 *   id: string,
 *   el: HTMLElement,
 *   target: HTMLElement,
 *   position: "top" | "bottom" | "left" | "right",
 *   savedDescribedBy: string | null,
 * }>}
 */
const persistentById = new Map();

const boundRoots = new WeakSet();
let globalListenersBound = false;
let persistentSeq = 0;

/** @type {ReturnType<typeof setTimeout> | null} */
let hideCleanupTimer = null;
/** @type {((event: TransitionEvent) => void) | null} */
let hideTransitionHandler = null;

/** Fallback after hide transition (matches `--control-hover-ms`, plus slack). */
const HIDE_CLEANUP_MS = 120;

function ensureTooltipElement() {
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement("div");
  tooltipEl.id = TOOLTIP_ID;
  tooltipEl.className = "tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

/**
 * @param {string | undefined} value
 * @returns {TooltipTone}
 */
function normalizeTone(value) {
  if (value === "success" || value === "error") return value;
  return "info";
}

/**
 * @param {HTMLElement} target
 * @returns {TooltipTone}
 */
function toneFromTarget(target) {
  return normalizeTone(target.dataset.tooltipTone);
}

/**
 * @param {HTMLElement} el
 * @param {string} text
 * @param {TooltipTone} tone
 */
function fillTipContent(el, text, tone) {
  el.classList.remove(...TONE_CLASSES);
  if (tone === "success") el.classList.add("tooltip--success");
  if (tone === "error") el.classList.add("tooltip--error");

  el.replaceChildren();

  if (tone === "success" || tone === "error") {
    const iconWrap = document.createElement("span");
    iconWrap.className = "tooltip__icon";
    iconWrap.append(
      createIcon(tone === "success" ? "check" : "clear", {
        className: "tooltip__icon-svg",
      })
    );
    const label = document.createElement("span");
    label.className = "tooltip__label";
    label.textContent = text;
    el.append(iconWrap, label);
    return;
  }

  const label = document.createElement("span");
  label.className = "tooltip__label";
  label.textContent = text;
  el.append(label);
}

/**
 * @param {string | undefined} value
 * @returns {"top" | "bottom" | "left" | "right"}
 */
function normalizePosition(value) {
  if (value === "bottom" || value === "left" || value === "right") {
    return value;
  }
  return "top";
}

/**
 * @param {HTMLElement} target
 * @returns {"top" | "bottom" | "left" | "right"}
 */
function getPosition(target) {
  return normalizePosition(target.dataset.tooltipPosition);
}

/**
 * @param {HTMLElement} el
 * @param {HTMLElement} target
 * @param {"top" | "bottom" | "left" | "right"} position
 */
function placeTip(el, target, position) {
  if (el === tooltipEl) {
    cancelHideCleanup();
  }
  el.classList.add("is-visible");
  el.hidden = false;

  const rect = target.getBoundingClientRect();
  const tipRect = el.getBoundingClientRect();
  let top = 0;
  let left = 0;

  switch (position) {
    case "bottom":
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.left - tipRect.width - GAP;
      break;
    case "right":
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.right + GAP;
      break;
    default:
      top = rect.top - tipRect.height - GAP;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
  }

  const maxLeft = window.innerWidth - tipRect.width - GAP;
  const maxTop = window.innerHeight - tipRect.height - GAP;
  left = Math.max(GAP, Math.min(left, maxLeft));
  top = Math.max(GAP, Math.min(top, maxTop));

  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

/**
 * @param {HTMLElement} target
 * @param {string} tipDomId
 */
function linkDescribedBy(target, tipDomId) {
  savedDescribedBy = target.getAttribute("aria-describedby");
  const ids = new Set((savedDescribedBy || "").split(/\s+/).filter(Boolean));
  ids.add(tipDomId);
  target.setAttribute("aria-describedby", [...ids].join(" "));
}

/**
 * @param {HTMLElement} target
 */
function unlinkDescribedBy(target) {
  if (savedDescribedBy) {
    target.setAttribute("aria-describedby", savedDescribedBy);
  } else {
    target.removeAttribute("aria-describedby");
  }
  savedDescribedBy = null;
}

/** Restore idle tooltip text/tone after a cancelled or finished timer flash. */
function restoreTimerTarget() {
  if (!timerState) return;

  const { target, restoreText, restoreTone, timerId } = timerState;
  window.clearTimeout(timerId);
  timerState = null;

  if (restoreText !== null && restoreText !== undefined) {
    target.dataset.tooltip = restoreText;
  } else {
    delete target.dataset.tooltip;
  }

  if (restoreTone) {
    target.dataset.tooltipTone = restoreTone;
  } else {
    delete target.dataset.tooltipTone;
  }
}

function cancelHideCleanup() {
  if (hideCleanupTimer !== null) {
    window.clearTimeout(hideCleanupTimer);
    hideCleanupTimer = null;
  }
  if (hideTransitionHandler && tooltipEl) {
    tooltipEl.removeEventListener("transitionend", hideTransitionHandler);
  }
  hideTransitionHandler = null;
}

/** Finish hide after opacity fade — keep content until then so the box does not collapse. */
function finishHideSharedSlot() {
  cancelHideCleanup();
  if (!tooltipEl || tooltipEl.classList.contains("is-visible")) return;

  tooltipEl.classList.remove(...TONE_CLASSES);
  tooltipEl.hidden = true;
  tooltipEl.replaceChildren();
}

function hideSharedSlot() {
  if (activeTarget) {
    unlinkDescribedBy(activeTarget);
    activeTarget = null;
  }
  slotMode = null;

  if (!tooltipEl) return;

  /* Already fully dismissed. */
  if (tooltipEl.hidden) {
    tooltipEl.classList.remove("is-visible", ...TONE_CLASSES);
    tooltipEl.replaceChildren();
    return;
  }

  /* Fade already in progress — leave content until cleanup. */
  if (!tooltipEl.classList.contains("is-visible")) return;

  cancelHideCleanup();
  tooltipEl.classList.remove("is-visible");

  hideTransitionHandler = (event) => {
    if (event.target !== tooltipEl || event.propertyName !== "opacity") return;
    finishHideSharedSlot();
  };
  tooltipEl.addEventListener("transitionend", hideTransitionHandler);
  hideCleanupTimer = window.setTimeout(finishHideSharedSlot, HIDE_CLEANUP_MS);
}

/** Cancel hover/timer slot; restore timer trigger if a flash was in progress. */
function cancelSharedSlot() {
  if (timerState) {
    restoreTimerTarget();
  }
  hideSharedSlot();
}

/**
 * @param {HTMLElement} target
 * @param {SharedSlotMode} mode
 */
function showSharedSlot(target, mode) {
  const text = target.dataset.tooltip;
  if (!text) return;

  if (activeTarget && activeTarget !== target) {
    hideSharedSlot();
  } else if (activeTarget === target && slotMode === "timer" && mode === "hover") {
    /* Keep timer tip when re-entering the same control. */
    return;
  }

  const el = ensureTooltipElement();
  const tone = toneFromTarget(target);
  fillTipContent(el, text, tone);

  if (activeTarget !== target) {
    activeTarget = target;
    linkDescribedBy(target, TOOLTIP_ID);
  }
  slotMode = mode;
  placeTip(el, target, getPosition(target));
}

/**
 * @param {HTMLElement} target
 */
function showHover(target) {
  if (timerState && timerState.target !== target) {
    restoreTimerTarget();
    hideSharedSlot();
  } else if (timerState && timerState.target === target) {
    return;
  } else if (slotMode && slotMode !== "hover") {
    hideSharedSlot();
  }

  showSharedSlot(target, "hover");
}

function handlePointerOver(e) {
  const target = e.target.closest("[data-tooltip]");
  if (!target || !e.currentTarget.contains(target)) return;
  showHover(target);
}

function handlePointerOut(e) {
  if (slotMode !== "hover") return;

  const from = e.target.closest("[data-tooltip]");
  if (!from) return;

  const to = e.relatedTarget?.closest?.("[data-tooltip]");
  if (to === from) return;

  if (activeTarget === from) {
    hideSharedSlot();
  }
}

function handleFocusIn(e) {
  const target = e.target.closest?.("[data-tooltip]");
  if (!target || !e.currentTarget.contains(target)) return;
  showHover(target);
}

function handleFocusOut(e) {
  if (slotMode !== "hover") return;

  const from = e.target.closest?.("[data-tooltip]");
  if (!from) return;

  const to = e.relatedTarget?.closest?.("[data-tooltip]");
  if (to === from) return;

  if (activeTarget === from) {
    hideSharedSlot();
  }
}

function repositionShared() {
  if (!activeTarget || !tooltipEl) return;
  if (!activeTarget.isConnected) {
    cancelSharedSlot();
    return;
  }
  const text = activeTarget.dataset.tooltip;
  if (!text) {
    cancelSharedSlot();
    return;
  }
  fillTipContent(tooltipEl, text, toneFromTarget(activeTarget));
  placeTip(tooltipEl, activeTarget, getPosition(activeTarget));
}

function repositionPersistent() {
  for (const entry of persistentById.values()) {
    if (!entry.target.isConnected) {
      dismissPersistentTooltip(entry.id);
      continue;
    }
    placeTip(entry.el, entry.target, entry.position);
  }
}

function repositionAll() {
  repositionShared();
  repositionPersistent();
}

/** Show tooltip for `target` in hover mode (reads `data-tooltip`). */
export function openTooltip(target) {
  showHover(target);
}

/** Hide the shared hover/timer tooltip, restoring any in-flight timer flash. */
export function closeTooltip() {
  cancelSharedSlot();
}

/**
 * Timer-mode reaction tip. Stays visible without hover until `durationMs` or
 * another hover/timer tip takes the shared slot.
 *
 * @param {HTMLElement} target
 * @param {{
 *   text: string,
 *   tone?: TooltipTone,
 *   restoreText?: string | null,
 *   restoreTone?: string | null,
 *   durationMs?: number,
 * }} options
 */
export function flashTooltip(target, options) {
  const {
    text,
    tone = "info",
    restoreText,
    restoreTone,
    durationMs = 2000,
  } = options;

  const prevText = Object.hasOwn(target.dataset, "tooltip")
    ? target.dataset.tooltip
    : null;
  const prevTone = Object.hasOwn(target.dataset, "tooltipTone")
    ? target.dataset.tooltipTone
    : null;

  cancelSharedSlot();

  target.dataset.tooltip = text;
  if (tone === "success" || tone === "error") {
    target.dataset.tooltipTone = tone;
  } else {
    delete target.dataset.tooltipTone;
  }

  if (typeof target.blur === "function") {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    target.blur();
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
      window.scrollTo(scrollX, scrollY);
    }
  }

  showSharedSlot(target, "timer");

  timerState = {
    target,
    restoreText: restoreText !== undefined ? restoreText : prevText,
    restoreTone: restoreTone !== undefined ? restoreTone : prevTone,
    timerId: window.setTimeout(() => {
      const state = timerState;
      if (!state || state.target !== target) return;
      restoreTimerTarget();
      if (slotMode === "timer" && activeTarget === target) {
        hideSharedSlot();
      }
    }, durationMs),
  };
}

/**
 * Persistent tip (tutorial). Independent of the hover/timer slot.
 * Optional `position` overrides `data-tooltip-position` on the target so a
 * hover tip on the same control can sit on a different side.
 *
 * @param {HTMLElement} target
 * @param {{
 *   text: string,
 *   tone?: TooltipTone,
 *   id?: string,
 *   position?: "top" | "bottom" | "left" | "right",
 * }} options
 * @returns {string} Tip id for `dismissPersistentTooltip`
 */
export function showPersistentTooltip(target, options) {
  const { text, tone = "info", id, position: positionOpt } = options;
  const tipId = id || `tooltip-persistent-${++persistentSeq}`;
  const position =
    positionOpt !== undefined
      ? normalizePosition(positionOpt)
      : getPosition(target);

  dismissPersistentTooltip(tipId);

  const el = document.createElement("div");
  el.id = tipId;
  el.className = "tooltip tooltip--persistent";
  el.setAttribute("role", "tooltip");
  fillTipContent(el, text, normalizeTone(tone));
  document.body.append(el);

  const prevDescribedBy = target.getAttribute("aria-describedby");
  const ids = new Set((prevDescribedBy || "").split(/\s+/).filter(Boolean));
  ids.add(tipId);
  target.setAttribute("aria-describedby", [...ids].join(" "));

  placeTip(el, target, position);

  persistentById.set(tipId, {
    id: tipId,
    el,
    target,
    position,
    savedDescribedBy: prevDescribedBy,
  });

  return tipId;
}

/**
 * Dismiss a persistent tip by id, or all tips anchored to a given element.
 *
 * @param {string | HTMLElement} idOrTarget
 */
export function dismissPersistentTooltip(idOrTarget) {
  if (typeof idOrTarget === "string") {
    const entry = persistentById.get(idOrTarget);
    if (!entry) return;
    persistentById.delete(idOrTarget);
    if (entry.savedDescribedBy) {
      entry.target.setAttribute("aria-describedby", entry.savedDescribedBy);
    } else {
      entry.target.removeAttribute("aria-describedby");
    }
    entry.el.remove();
    return;
  }

  for (const [id, entry] of [...persistentById.entries()]) {
    if (entry.target === idOrTarget) {
      dismissPersistentTooltip(id);
    }
  }
}

export function initTooltips(root = document) {
  if (boundRoots.has(root)) return;

  ensureTooltipElement();

  root.addEventListener("mouseover", handlePointerOver);
  root.addEventListener("mouseout", handlePointerOut);
  root.addEventListener("focusin", handleFocusIn);
  root.addEventListener("focusout", handleFocusOut);

  if (!globalListenersBound) {
    window.addEventListener("scroll", repositionAll, true);
    window.addEventListener("resize", repositionAll);
    globalListenersBound = true;
  }

  boundRoots.add(root);
}

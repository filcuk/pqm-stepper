/**
 * Guided page tutorial: dim everything except a spotlighted target, show a
 * popover step card, and walk a JS-defined script with back / next / close.
 * Any number of tutorials may be registered; only one runs at a time.
 */

import { initPopover } from "./popover.js";
import {
  prefersReducedMotion,
  resolveElements,
  setHidden,
  setPageInert,
} from "../utils/dom.js";
import { onDocumentEscape } from "../utils/document-listeners.js";

const DEFAULT_PADDING = 8;

/** @type {{ stop: (options?: { reason?: string }) => void } | null} */
let activeTutorial = null;

/**
 * @typedef {"auto" | "top" | "bottom" | "left" | "right"} TutorialPosition
 *
 * @typedef {{
 *   target?: string | Element | (() => string | Element | null | undefined) | null,
 *   title?: string,
 *   body?: string | Node | null,
 *   position?: TutorialPosition,
 *   interactive?: boolean,
 *   advanceOn?: "click" | false | null,
 *   padding?: number,
 *   scroll?: boolean,
 *   onEnter?: (ctx: { index: number, step: NormalizedTutorialStep }) => void,
 *   onLeave?: (ctx: { index: number, step: NormalizedTutorialStep }) => void,
 * }} TutorialStep
 *
 * @typedef {{
 *   target: string | Element | (() => string | Element | null | undefined) | null,
 *   title: string,
 *   body: string | Node | null,
 *   position: TutorialPosition,
 *   interactive: boolean,
 *   advanceOn: "click" | null,
 *   padding: number | null,
 *   scroll: boolean,
 *   onEnter: TutorialStep["onEnter"],
 *   onLeave: TutorialStep["onLeave"],
 * }} NormalizedTutorialStep
 */

/**
 * Clamp a step index into `[0, length)`.
 * @param {number} index
 * @param {number} length
 * @returns {number}
 */
export function clampTutorialIndex(index, length) {
  if (!Number.isFinite(length) || length <= 0) return -1;
  const n = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.min(Math.max(0, n), length - 1);
}

/**
 * Normalise a raw steps array into a stable shape for the runner.
 * @param {TutorialStep[] | null | undefined} steps
 * @returns {NormalizedTutorialStep[]}
 */
export function normalizeTutorialSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((raw) => {
    const step = raw && typeof raw === "object" ? raw : {};
    return {
      target: step.target ?? null,
      title: typeof step.title === "string" ? step.title : "",
      body: step.body ?? null,
      position:
        step.position === "top" ||
        step.position === "bottom" ||
        step.position === "left" ||
        step.position === "right" ||
        step.position === "auto"
          ? step.position
          : "auto",
      interactive: Boolean(step.interactive),
      advanceOn: step.advanceOn === "click" ? "click" : null,
      padding:
        typeof step.padding === "number" && Number.isFinite(step.padding)
          ? step.padding
          : null,
      scroll: step.scroll !== false,
      onEnter: typeof step.onEnter === "function" ? step.onEnter : undefined,
      onLeave: typeof step.onLeave === "function" ? step.onLeave : undefined,
    };
  });
}

/**
 * Resolve a step target to a live element (or null).
 * @param {NormalizedTutorialStep["target"]} target
 * @returns {HTMLElement | null}
 */
export function resolveTutorialTarget(target) {
  if (target === null || target === undefined || target === "") return null;

  let value = target;
  if (typeof value === "function") {
    try {
      value = value();
    } catch {
      return null;
    }
  }

  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const found = document.querySelector(value);
    return found instanceof HTMLElement ? found : null;
  }

  if (value instanceof HTMLElement) {
    return value.isConnected ? value : null;
  }

  const resolved = resolveElements(value)[0];
  return resolved instanceof HTMLElement && resolved.isConnected
    ? resolved
    : null;
}

/**
 * @param {string} template
 * @param {number} index
 * @param {number} total
 */
function formatStepOf(template, index, total) {
  return template
    .replaceAll("{n}", String(index + 1))
    .replaceAll("{N}", String(total));
}

/* The step card is only shown once scrolling has finished, so the tour runs the
   scroll itself: native smooth scrolling gives no dependable "done" signal
   (`scrollend` fires per frame for programmatic scrolls, and a smooth scroll can
   start late on a busy main thread), which left the card placed against a
   viewport the page had not reached yet. */
const SCROLL_MIN_MS = 240;
const SCROLL_MAX_MS = 640;
const SCROLL_PX_PER_MS = 2.4;

/**
 * Scroll the window without honouring CSS `scroll-behavior`, so each animation
 * frame lands exactly where asked.
 * @param {number} y
 */
function jumpWindowTo(y) {
  window.scrollTo({ top: y, left: window.scrollX, behavior: "instant" });
}

/**
 * Nearest ancestor that scrolls independently of the page.
 * @param {HTMLElement} target
 * @returns {HTMLElement | null}
 */
function scrollableAncestor(target) {
  const scrollable = /(auto|scroll|overlay)/;
  let node = target.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (
      (scrollable.test(style.overflowY) && node.scrollHeight > node.clientHeight) ||
      (scrollable.test(style.overflowX) && node.scrollWidth > node.clientWidth)
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Page scroll position that centres `target`, clamped to the document.
 * @param {HTMLElement} target
 * @returns {number}
 */
function centeredScrollY(target) {
  const rect = target.getBoundingClientRect();
  const desired =
    window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
  const max = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  return Math.max(0, Math.min(desired, max));
}

/**
 * True when showing `target` requires moving the page or an inner scroller.
 * @param {HTMLElement} target
 * @returns {boolean}
 */
function needsScrollFor(target) {
  if (scrollableAncestor(target)) return true;
  return Math.abs(centeredScrollY(target) - window.scrollY) > 1;
}

/**
 * Centre `target` and resolve when the page has stopped moving. Inner scrollers
 * are brought into view first (instantly); the page scroll is then animated
 * here rather than by `scrollIntoView`, so the end of the scroll is exact.
 * @param {HTMLElement} target
 * @param {{ signal?: AbortSignal, animate?: boolean }} [options]
 * @returns {Promise<void>}
 */
function scrollTargetIntoView(target, options = {}) {
  const { signal, animate = true } = options;
  if (signal?.aborted) return Promise.resolve();

  if (scrollableAncestor(target)) {
    target.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
  }

  const destination = centeredScrollY(target);
  const startY = window.scrollY;
  const distance = destination - startY;

  if (!animate || Math.abs(distance) <= 1) {
    jumpWindowTo(destination);
    return Promise.resolve();
  }

  const duration = Math.min(
    SCROLL_MAX_MS,
    Math.max(SCROLL_MIN_MS, Math.abs(distance) / SCROLL_PX_PER_MS),
  );

  return new Promise((resolve) => {
    const started = performance.now();
    let frame = 0;

    const finish = () => {
      cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };

    function onAbort() {
      finish();
    }

    const tick = (now) => {
      if (signal?.aborted || !target.isConnected) {
        finish();
        return;
      }

      const progress = Math.min(1, (now - started) / duration);
      const eased =
        progress < 0.5
          ? 4 * progress ** 3
          : 1 - (-2 * progress + 2) ** 3 / 2;
      jumpWindowTo(startY + distance * eased);

      if (progress >= 1) {
        /* Re-centre in case the page reflowed while scrolling. */
        jumpWindowTo(centeredScrollY(target));
        finish();
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    frame = requestAnimationFrame(tick);
  });
}

/**
 * @param {{
 *   id?: string,
 *   steps: TutorialStep[],
 *   startTriggers?: string | Element | Iterable<Element>,
 *   labels?: {
 *     back?: string,
 *     next?: string,
 *     done?: string,
 *     close?: string,
 *     stepOf?: string,
 *   },
 *   padding?: number,
 *   onStep?: (ctx: {
 *     index: number,
 *     step: NormalizedTutorialStep,
 *     target: HTMLElement | null,
 *   }) => void,
 *   onFinish?: (ctx: { reason: string, index: number }) => void,
 * }} options
 */
export function initTutorial(options) {
  const {
    id = `tutorial-${Math.random().toString(36).slice(2, 9)}`,
    startTriggers = [],
    padding: defaultPadding = DEFAULT_PADDING,
    onStep,
    onFinish,
  } = options;

  const labels = {
    back: options.labels?.back ?? "Back",
    next: options.labels?.next ?? "Next",
    done: options.labels?.done ?? "Done",
    close: options.labels?.close ?? "Close",
    stepOf: options.labels?.stepOf ?? "Step {n} of {N}",
  };

  const steps = normalizeTutorialSteps(options.steps);
  if (!steps.length) return null;

  const triggers = resolveElements(startTriggers);

  const overlay = document.createElement("div");
  overlay.className = "tutorial-overlay hidden";
  overlay.id = `tutorial-overlay-${id}`;
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  const dim = document.createElement("div");
  dim.className = "tutorial-overlay__dim";

  const spotlight = document.createElement("div");
  spotlight.className = "tutorial-overlay__spotlight";

  const blockerTop = document.createElement("div");
  const blockerRight = document.createElement("div");
  const blockerBottom = document.createElement("div");
  const blockerLeft = document.createElement("div");
  for (const [el, edge] of [
    [blockerTop, "top"],
    [blockerRight, "right"],
    [blockerBottom, "bottom"],
    [blockerLeft, "left"],
  ]) {
    el.className = `tutorial-overlay__blocker tutorial-overlay__blocker--${edge}`;
    el.setAttribute("aria-hidden", "true");
  }

  overlay.append(
    dim,
    spotlight,
    blockerTop,
    blockerRight,
    blockerBottom,
    blockerLeft,
  );
  document.body.append(overlay);

  let isActive = false;
  let stepIndex = -1;
  /** @type {(() => void) | null} */
  let removeAdvanceListener = null;
  /** @type {AbortController | null} */
  let pendingReveal = null;
  /** @type {Element | null} */
  let previouslyFocused = null;
  let closing = false;

  const api = {
    start,
    stop,
    next,
    back,
    goTo,
    isActive: () => isActive,
    getIndex: () => stepIndex,
    getId: () => id,
    destroy,
  };

  const popover = initPopover({
    anchor: null,
    title: "",
    body: null,
    dismissible: true,
    closeOnOutsideClick: false,
    className: "popover--tutorial",
    onClose: () => {
      if (!closing) stop({ reason: "close" });
    },
  });

  if (labels.close) {
    const closeBtn = popover.getElement().querySelector(".popover__close");
    closeBtn?.setAttribute("aria-label", labels.close);
  }

  function clearAdvanceListener() {
    removeAdvanceListener?.();
    removeAdvanceListener = null;
  }

  function cancelPendingReveal() {
    pendingReveal?.abort();
    pendingReveal = null;
  }

  function leaveCurrentStep() {
    clearAdvanceListener();
    cancelPendingReveal();
    if (stepIndex < 0 || stepIndex >= steps.length) return;
    const step = steps[stepIndex];
    step.onLeave?.({ index: stepIndex, step });
  }

  /** Close the step card without ending the tutorial (e.g. while scrolling). */
  function hideStepPopover() {
    if (!popover.isOpen()) return;
    closing = true;
    popover.close();
    closing = false;
  }

  /**
   * @param {HTMLElement | null} target
   * @param {number} pad
   * @param {boolean} interactive
   */
  function placeSpotlight(target, pad, interactive) {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;

    if (!target) {
      overlay.classList.add("tutorial-overlay--full");
      overlay.classList.remove("tutorial-overlay--interactive");
      spotlight.hidden = true;
      for (const blocker of [blockerTop, blockerRight, blockerBottom, blockerLeft]) {
        setHidden(blocker, true);
      }
      return;
    }

    overlay.classList.remove("tutorial-overlay--full");
    overlay.classList.toggle("tutorial-overlay--interactive", interactive);
    spotlight.hidden = false;

    const rect = target.getBoundingClientRect();
    const top = Math.max(0, rect.top - pad);
    const left = Math.max(0, rect.left - pad);
    const right = Math.min(vw, rect.right + pad);
    const bottom = Math.min(vh, rect.bottom + pad);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    spotlight.style.top = `${top}px`;
    spotlight.style.left = `${left}px`;
    spotlight.style.width = `${width}px`;
    spotlight.style.height = `${height}px`;

    blockerTop.style.top = "0";
    blockerTop.style.left = "0";
    blockerTop.style.width = "100%";
    blockerTop.style.height = `${top}px`;

    blockerBottom.style.top = `${bottom}px`;
    blockerBottom.style.left = "0";
    blockerBottom.style.width = "100%";
    blockerBottom.style.height = `${Math.max(0, vh - bottom)}px`;

    blockerLeft.style.top = `${top}px`;
    blockerLeft.style.left = "0";
    blockerLeft.style.width = `${left}px`;
    blockerLeft.style.height = `${height}px`;

    blockerRight.style.top = `${top}px`;
    blockerRight.style.left = `${right}px`;
    blockerRight.style.width = `${Math.max(0, vw - right)}px`;
    blockerRight.style.height = `${height}px`;

    for (const blocker of [blockerTop, blockerRight, blockerBottom, blockerLeft]) {
      setHidden(blocker, false);
    }
  }

  function buildStepBody(step, index) {
    const wrap = document.createElement("div");
    wrap.className = "tutorial-step-body";

    const meta = document.createElement("p");
    meta.className = "tutorial-step-meta";
    meta.textContent = formatStepOf(labels.stepOf, index, steps.length);
    wrap.append(meta);

    if (typeof step.body === "string" && step.body) {
      const text = document.createElement("p");
      text.className = "popover__text";
      text.textContent = step.body;
      wrap.append(text);
    } else if (step.body instanceof Node) {
      const content = document.createElement("div");
      content.className = "tutorial-step-content";
      content.append(step.body);
      wrap.append(content);
    }

    return wrap;
  }

  function syncPopover(step, index, target) {
    const isFirst = index <= 0;
    const isLast = index >= steps.length - 1;

    popover.setAnchor(target);
    popover.update({
      title: step.title,
      body: buildStepBody(step, index),
      position: target ? step.position : "auto",
      actions: [
        {
          label: labels.back,
          className: "btn",
          icon: "chevron-left",
          disabled: isFirst,
          closeOnClick: false,
          onClick: () => back(),
        },
        {
          label: isLast ? labels.done : labels.next,
          className: "btn btn-primary",
          icon: isLast ? undefined : "chevron-right",
          closeOnClick: false,
          onClick: () => {
            if (isLast) stop({ reason: "done" });
            else next();
          },
        },
      ],
    });

    if (!popover.isOpen()) popover.open();
    else {
      /* Reposition after content swap. */
      popover.open();
    }
  }

  /**
   * @param {NormalizedTutorialStep} step
   * @param {number} i
   * @param {HTMLElement | null} target
   */
  function presentStep(step, i, target) {
    const pad = step.padding ?? defaultPadding;
    setPageInert(!step.interactive);
    placeSpotlight(target, pad, step.interactive);
    /* Interactive steps need Tab to reach the spotlight target. */
    popover.setTrapFocus(!step.interactive);
    syncPopover(step, i, target);

    if (step.interactive && step.advanceOn === "click" && target) {
      clearAdvanceListener();
      const onAdvance = () => {
        clearAdvanceListener();
        next();
      };
      target.addEventListener("click", onAdvance);
      removeAdvanceListener = () => {
        target.removeEventListener("click", onAdvance);
      };
    }

    step.onEnter?.({ index: i, step });
    onStep?.({ index: i, step, target });
  }

  /**
   * @param {number} index
   * @param {"forward" | "backward"} [direction]
   */
  function showStep(index, direction = "forward") {
    if (!isActive) return;

    let i = clampTutorialIndex(index, steps.length);
    if (i < 0) {
      stop({ reason: "empty" });
      return;
    }

    /* Skip steps whose target disappeared (bounded scan). */
    for (let attempts = 0; attempts < steps.length; attempts += 1) {
      const step = steps[i];
      const hasTargetRef =
        step.target !== null && step.target !== undefined && step.target !== "";
      const target = resolveTutorialTarget(step.target);

      if (hasTargetRef && !target) {
        const nextIndex = direction === "backward" ? i - 1 : i + 1;
        const clamped = clampTutorialIndex(nextIndex, steps.length);
        if (clamped === i || clamped < 0) {
          stop({ reason: "missing-target" });
          return;
        }
        i = clamped;
        continue;
      }

      leaveCurrentStep();
      stepIndex = i;

      const pad = step.padding ?? defaultPadding;
      const animate = !prefersReducedMotion();
      const willScroll = Boolean(target && step.scroll) && needsScrollFor(target);

      setPageInert(!step.interactive);
      placeSpotlight(target, pad, step.interactive);
      popover.setTrapFocus(!step.interactive);

      if (!willScroll) {
        presentStep(step, i, target);
        return;
      }

      if (!animate) {
        scrollTargetIntoView(target, { animate: false });
        presentStep(step, i, target);
        return;
      }

      /* Keep the card hidden until the scroll has finished, so it is placed
         against the viewport the step actually ends on. */
      hideStepPopover();

      const controller = new AbortController();
      pendingReveal = controller;
      const revealIndex = i;
      scrollTargetIntoView(target, { signal: controller.signal }).then(() => {
        if (pendingReveal !== controller) return;
        pendingReveal = null;
        if (!isActive || stepIndex !== revealIndex) return;
        presentStep(step, revealIndex, target);
      });
      return;
    }

    stop({ reason: "missing-target" });
  }

  function onViewportChange() {
    if (!isActive || stepIndex < 0) return;
    const step = steps[stepIndex];
    const target = resolveTutorialTarget(step.target);
    if (
      step.target !== null &&
      step.target !== undefined &&
      step.target !== "" &&
      !target
    ) {
      showStep(stepIndex + 1, "forward");
      return;
    }
    placeSpotlight(target, step.padding ?? defaultPadding, step.interactive);
    if (popover.isOpen()) popover.open();
  }

  /**
   * @param {number} [index]
   */
  function start(index = 0) {
    if (!steps.length) return;

    if (activeTutorial && activeTutorial !== api) {
      activeTutorial.stop({ reason: "superseded" });
    }
    activeTutorial = api;

    if (isActive) {
      goTo(index);
      return;
    }

    previouslyFocused = document.activeElement;
    isActive = true;
    stepIndex = -1;
    setHidden(overlay, false);
    document.body.classList.add("tutorial-open");
    showStep(clampTutorialIndex(index, steps.length), "forward");
  }

  /**
   * @param {{ reason?: string }} [options]
   */
  function stop({ reason = "stop" } = {}) {
    if (!isActive && !popover.isOpen()) {
      if (activeTutorial === api) activeTutorial = null;
      return;
    }

    closing = true;
    leaveCurrentStep();
    clearAdvanceListener();
    cancelPendingReveal();
    setPageInert(false);
    setHidden(overlay, true);
    document.body.classList.remove("tutorial-open");
    overlay.classList.remove(
      "tutorial-overlay--full",
      "tutorial-overlay--interactive",
    );

    if (popover.isOpen()) popover.close();

    const finishedIndex = stepIndex;
    isActive = false;
    stepIndex = -1;

    if (activeTutorial === api) activeTutorial = null;

    if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
      previouslyFocused.focus({ preventScroll: true });
    }
    previouslyFocused = null;
    closing = false;

    onFinish?.({ reason, index: finishedIndex });
  }

  function next() {
    if (!isActive) return;
    if (stepIndex >= steps.length - 1) {
      stop({ reason: "done" });
      return;
    }
    showStep(stepIndex + 1, "forward");
  }

  function back() {
    if (!isActive || stepIndex <= 0) return;
    showStep(stepIndex - 1, "backward");
  }

  /**
   * @param {number} index
   */
  function goTo(index) {
    if (!isActive) {
      start(index);
      return;
    }
    const direction = index < stepIndex ? "backward" : "forward";
    showStep(index, direction);
  }

  function onTriggerClick(event) {
    event.preventDefault();
    start(0);
  }

  for (const trigger of triggers) {
    trigger.addEventListener("click", onTriggerClick);
  }

  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange);

  const removeEscape = onDocumentEscape(() => {
    if (!isActive) return false;
    stop({ reason: "escape" });
    return true;
  }, { priority: 110 });

  function destroy() {
    stop({ reason: "destroy" });
    removeEscape();
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    for (const trigger of triggers) {
      trigger.removeEventListener("click", onTriggerClick);
    }
    popover.destroy();
    overlay.remove();
  }

  return api;
}

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
 *   index: number,
 *   step: NormalizedTutorialStep,
 * }} TutorialWhenContext
 *
 * @typedef {boolean | ((ctx: TutorialWhenContext) => boolean)} TutorialWhen
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
 *   when?: TutorialWhen,
 *   steps?: TutorialStep[],
 *   onEnter?: (ctx: { index: number, step: NormalizedTutorialStep }) => void,
 *   onLeave?: (ctx: { index: number, step: NormalizedTutorialStep }) => void,
 * }} TutorialStep
 *
 * A node with a `steps` array is authoring sugar for a **group only**: it is
 * flattened away and any sibling leaf fields (`target`, `title`, …) on that
 * same object are ignored. `when` / `onEnter` / `onLeave` / `goTo` indices are
 * always post-flatten leaf indices.
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
 *   when: TutorialWhen | undefined,
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
 * Accept boolean / function `when`; anything else is treated as always eligible.
 * @param {unknown} when
 * @returns {TutorialWhen | undefined}
 */
function normalizeWhen(when) {
  if (typeof when === "boolean") return when;
  if (typeof when === "function") return when;
  return undefined;
}

/**
 * AND two step conditions. `undefined` / `true` are no-ops; `false` wins.
 * Callers should pass values already normalised by {@link normalizeWhen}
 * (boolean | function | undefined).
 * @param {TutorialWhen | undefined} parentWhen
 * @param {TutorialWhen | undefined} childWhen
 * @returns {TutorialWhen | undefined}
 */
export function combineTutorialWhen(parentWhen, childWhen) {
  if (parentWhen === undefined || parentWhen === true) return childWhen;
  if (childWhen === undefined || childWhen === true) return parentWhen;
  if (parentWhen === false || childWhen === false) return false;
  return (ctx) => Boolean(parentWhen(ctx)) && Boolean(childWhen(ctx));
}

/**
 * @param {object} step
 * @param {TutorialWhen | undefined} when
 * @returns {NormalizedTutorialStep}
 */
function normalizeTutorialLeaf(step, when) {
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
    when,
    onEnter: typeof step.onEnter === "function" ? step.onEnter : undefined,
    onLeave: typeof step.onLeave === "function" ? step.onLeave : undefined,
  };
}

/**
 * Flatten nested `{ when, steps }` groups and normalise leaf steps.
 * @param {TutorialStep[] | null | undefined} steps
 * @param {TutorialWhen | undefined} [inheritedWhen]
 * @returns {NormalizedTutorialStep[]}
 */
export function flattenTutorialSteps(steps, inheritedWhen) {
  if (!Array.isArray(steps)) return [];
  /** @type {NormalizedTutorialStep[]} */
  const out = [];
  for (const raw of steps) {
    const step = raw && typeof raw === "object" ? raw : {};
    const when = combineTutorialWhen(inheritedWhen, normalizeWhen(step.when));
    if (Array.isArray(step.steps)) {
      out.push(...flattenTutorialSteps(step.steps, when));
      continue;
    }
    out.push(normalizeTutorialLeaf(step, when));
  }
  return out;
}

/**
 * Normalise a raw steps array into a stable shape for the runner.
 * Nested `{ when, steps }` groups are flattened; child `when` is AND-ed with the parent.
 * @param {TutorialStep[] | null | undefined} steps
 * @returns {NormalizedTutorialStep[]}
 */
export function normalizeTutorialSteps(steps) {
  return flattenTutorialSteps(steps);
}

/**
 * Whether a normalised step should be shown for the current app state.
 * `when` throw → warn and treat as ineligible.
 * @param {NormalizedTutorialStep | null | undefined} step
 * @param {TutorialWhenContext} [ctx]
 * @returns {boolean}
 */
export function isTutorialStepEligible(step, ctx) {
  if (!step) return false;
  const when = step.when;
  if (when === undefined || when === true) return true;
  if (when === false) return false;
  if (typeof when !== "function") return true;
  const resolvedCtx = ctx ?? { index: -1, step };
  try {
    return Boolean(when(resolvedCtx));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[tutorial] Step condition threw; skipping step.", error);
    return false;
  }
}

/**
 * Whether a step declares a spotlight target (selector, element, or resolver).
 * @param {NormalizedTutorialStep | null | undefined} step
 * @returns {boolean}
 */
export function tutorialStepHasTargetRef(step) {
  if (!step) return false;
  return step.target !== null && step.target !== undefined && step.target !== "";
}

/**
 * Whether a step can be shown right now: `when` passes, and any target resolves.
 * @param {NormalizedTutorialStep | null | undefined} step
 * @param {TutorialWhenContext} [ctx]
 * @param {{
 *   resolveTarget?: (target: NormalizedTutorialStep["target"]) => HTMLElement | null,
 * }} [options]
 * @returns {boolean}
 */
export function isTutorialStepShowable(step, ctx, options) {
  if (!isTutorialStepEligible(step, ctx)) return false;
  if (!tutorialStepHasTargetRef(step)) return true;
  const resolveTarget = options?.resolveTarget ?? resolveTutorialTarget;
  return Boolean(resolveTarget(step.target));
}

/**
 * Next showable index at or after `fromIndex` (forward) / at or before (backward).
 * Showable = eligible `when` and a resolvable target (or no target).
 * Out-of-range `fromIndex` → `-1` (does not clamp into the array).
 * @param {NormalizedTutorialStep[] | null | undefined} steps
 * @param {number} fromIndex
 * @param {"forward" | "backward"} [direction]
 * @param {{
 *   resolveTarget?: (target: NormalizedTutorialStep["target"]) => HTMLElement | null,
 * }} [options]
 * @returns {number}
 */
export function findShowableTutorialIndex(
  steps,
  fromIndex,
  direction = "forward",
  options,
) {
  if (!Array.isArray(steps) || steps.length === 0) return -1;
  if (!Number.isFinite(fromIndex)) return -1;
  let i = Math.trunc(fromIndex);
  if (i < 0 || i >= steps.length) return -1;
  const delta = direction === "backward" ? -1 : 1;
  while (i >= 0 && i < steps.length) {
    const step = steps[i];
    if (isTutorialStepShowable(step, { index: i, step }, options)) return i;
    i += delta;
  }
  return -1;
}

/**
 * Next index that passes `when` only (ignores missing targets). Prefer
 * {@link findShowableTutorialIndex} for navigation.
 * @param {NormalizedTutorialStep[] | null | undefined} steps
 * @param {number} fromIndex
 * @param {"forward" | "backward"} [direction]
 * @returns {number}
 */
export function findEligibleTutorialIndex(
  steps,
  fromIndex,
  direction = "forward",
) {
  if (!Array.isArray(steps) || steps.length === 0) return -1;
  if (!Number.isFinite(fromIndex)) return -1;
  let i = Math.trunc(fromIndex);
  if (i < 0 || i >= steps.length) return -1;
  const delta = direction === "backward" ? -1 : 1;
  while (i >= 0 && i < steps.length) {
    const step = steps[i];
    if (isTutorialStepEligible(step, { index: i, step })) return i;
    i += delta;
  }
  return -1;
}

/**
 * Closest showable index to `targetIndex` (itself first; then ±1, ±2, …).
 * Equal distance prefers the forward neighbour.
 * @param {NormalizedTutorialStep[] | null | undefined} steps
 * @param {number} targetIndex
 * @param {{
 *   resolveTarget?: (target: NormalizedTutorialStep["target"]) => HTMLElement | null,
 * }} [options]
 * @returns {number}
 */
export function nearestShowableTutorialIndex(steps, targetIndex, options) {
  if (!Array.isArray(steps) || steps.length === 0) return -1;
  const start = clampTutorialIndex(targetIndex, steps.length);
  if (start < 0) return -1;
  if (
    isTutorialStepShowable(steps[start], { index: start, step: steps[start] }, options)
  ) {
    return start;
  }
  for (let distance = 1; distance < steps.length; distance += 1) {
    const forward = start + distance;
    if (
      forward < steps.length &&
      isTutorialStepShowable(
        steps[forward],
        { index: forward, step: steps[forward] },
        options,
      )
    ) {
      return forward;
    }
    const backward = start - distance;
    if (
      backward >= 0 &&
      isTutorialStepShowable(
        steps[backward],
        { index: backward, step: steps[backward] },
        options,
      )
    ) {
      return backward;
    }
  }
  return -1;
}

/**
 * How many steps are currently showable (`when` + resolvable target).
 * @param {NormalizedTutorialStep[] | null | undefined} steps
 * @param {{
 *   resolveTarget?: (target: NormalizedTutorialStep["target"]) => HTMLElement | null,
 * }} [options]
 * @returns {number}
 */
export function countEligibleTutorialSteps(steps, options) {
  if (!Array.isArray(steps)) return 0;
  let count = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (isTutorialStepShowable(step, { index: i, step }, options)) count += 1;
  }
  return count;
}

/**
 * 0-based ordinal of `index` among currently showable steps, or `-1`.
 * @param {NormalizedTutorialStep[] | null | undefined} steps
 * @param {number} index
 * @param {{
 *   resolveTarget?: (target: NormalizedTutorialStep["target"]) => HTMLElement | null,
 * }} [options]
 * @returns {number}
 */
export function eligibleTutorialOrdinal(steps, index, options) {
  if (!Array.isArray(steps) || !Number.isFinite(index)) return -1;
  const target = Math.trunc(index);
  let ordinal = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!isTutorialStepShowable(step, { index: i, step }, options)) continue;
    if (i === target) return ordinal;
    ordinal += 1;
  }
  return -1;
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
 * Short label for a step target ref (selectors, elements, resolvers).
 * @param {NormalizedTutorialStep["target"]} target
 * @returns {string}
 */
export function describeTutorialTarget(target) {
  if (target === null || target === undefined || target === "") return "(none)";
  if (typeof target === "string") return target;
  if (typeof target === "function") return "[function target]";
  if (
    target &&
    typeof target === "object" &&
    typeof target.tagName === "string"
  ) {
    const el = /** @type {HTMLElement} */ (target);
    if (el.id) return `#${el.id}`;
    const name = el.getAttribute?.("name");
    if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
    return `<${el.tagName.toLowerCase()}>`;
  }
  return String(target);
}

/**
 * @param {{
 *   id?: string,
 *   index: number,
 *   step: Pick<NormalizedTutorialStep, "target" | "title">,
 *   outcome: "skip-forward" | "skip-backward" | "stop" | "disconnected",
 * }} options
 * @returns {string}
 */
export function formatTutorialMissingTargetMessage(options) {
  const { id = "tutorial", index, step, outcome } = options;
  const stepLabel = step.title ? `"${step.title}"` : `step ${index + 1}`;
  const targetLabel = describeTutorialTarget(step.target);
  const prefix = `[tutorial:${id}]`;

  switch (outcome) {
    case "skip-forward":
      return `${prefix} Missing target for ${stepLabel} (${targetLabel}); skipping forward.`;
    case "skip-backward":
      return `${prefix} Missing target for ${stepLabel} (${targetLabel}); skipping backward.`;
    case "disconnected":
      return `${prefix} Target for ${stepLabel} (${targetLabel}) is no longer in the document; advancing forward.`;
    case "stop":
    default:
      return `${prefix} Missing target for ${stepLabel} (${targetLabel}); no reachable step — stopping tour.`;
  }
}

/**
 * Log a missing-target problem to the console (`warn`, or `error` when stopping).
 * @param {Parameters<typeof formatTutorialMissingTargetMessage>[0]} options
 */
export function reportTutorialMissingTarget(options) {
  const message = formatTutorialMissingTargetMessage(options);
  if (options.outcome === "stop") {
    // eslint-disable-next-line no-console
    console.error(message);
  } else {
    // eslint-disable-next-line no-console
    console.warn(message);
  }
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
 * True when `rect` (plus `padding`) fits entirely inside `bounds`.
 * @param {{ top: number, left: number, bottom: number, right: number }} rect
 * @param {{ top: number, left: number, bottom: number, right: number }} bounds
 * @param {number} [padding]
 * @returns {boolean}
 */
export function isRectFullyVisible(rect, bounds, padding = 0) {
  const pad = Math.max(0, Number.isFinite(padding) ? padding : 0);
  return (
    rect.top - pad >= bounds.top &&
    rect.left - pad >= bounds.left &&
    rect.bottom + pad <= bounds.bottom &&
    rect.right + pad <= bounds.right
  );
}

/**
 * True when the spotlighted target is clipped by the viewport or an inner
 * scroller. Already-visible targets are left alone — do not recentre them.
 * @param {HTMLElement} target
 * @param {number} [padding]
 * @returns {boolean}
 */
function needsScrollFor(target, padding = DEFAULT_PADDING) {
  const pad =
    typeof padding === "number" && Number.isFinite(padding)
      ? padding
      : DEFAULT_PADDING;
  const rect = target.getBoundingClientRect();
  const viewport = {
    top: 0,
    left: 0,
    bottom: window.innerHeight,
    right: window.innerWidth,
  };
  if (!isRectFullyVisible(rect, viewport, pad)) return true;

  const scroller = scrollableAncestor(target);
  if (!scroller) return false;

  const scrollerRect = scroller.getBoundingClientRect();
  return !isRectFullyVisible(rect, scrollerRect, pad);
}

/**
 * Bring `target` into view and resolve when the page has stopped moving. Inner
 * scrollers use nearest (instant); the page only scrolls when the target is
 * still clipped, then centres it. Page motion is animated here rather than by
 * `scrollIntoView`, so the end of the scroll is exact.
 * @param {HTMLElement} target
 * @param {{ signal?: AbortSignal, animate?: boolean, padding?: number }} [options]
 * @returns {Promise<void>}
 */
function scrollTargetIntoView(target, options = {}) {
  const { signal, animate = true, padding = DEFAULT_PADDING } = options;
  if (signal?.aborted) return Promise.resolve();

  if (scrollableAncestor(target)) {
    target.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
  }

  /* Inner nearest may have been enough; skip recentring a visible target. */
  if (!needsScrollFor(target, padding)) {
    return Promise.resolve();
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
    const total = countEligibleTutorialSteps(steps);
    const ordinal = eligibleTutorialOrdinal(steps, index);
    meta.textContent = formatStepOf(
      labels.stepOf,
      Math.max(0, ordinal),
      total,
    );
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
    const isFirst =
      findShowableTutorialIndex(steps, index - 1, "backward") < 0;
    const isLast =
      findShowableTutorialIndex(steps, index + 1, "forward") < 0;

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
   * Present a known-showable step, or scan from `index` in `direction` while
   * reporting missing targets. Exhausted scan with nothing to show:
   * - active tour already on a step → stay put (do not stop)
   * - starting / nothing shown yet → stop (`missing-target` or `empty`)
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

    let skippedMissingTarget = false;
    /** @type {number} */
    let lastMissingIndex = i;

    for (let attempts = 0; attempts < steps.length; attempts += 1) {
      const step = steps[i];
      const nextIndex = direction === "backward" ? i - 1 : i + 1;
      const canAdvance = nextIndex >= 0 && nextIndex < steps.length;

      if (!isTutorialStepEligible(step, { index: i, step })) {
        if (!canAdvance) break;
        i = nextIndex;
        continue;
      }

      if (tutorialStepHasTargetRef(step) && !resolveTutorialTarget(step.target)) {
        skippedMissingTarget = true;
        lastMissingIndex = i;
        reportTutorialMissingTarget({
          id,
          index: i,
          step,
          outcome: canAdvance
            ? direction === "backward"
              ? "skip-backward"
              : "skip-forward"
            : "stop",
        });
        if (!canAdvance) break;
        i = nextIndex;
        continue;
      }

      const target = resolveTutorialTarget(step.target);
      leaveCurrentStep();
      stepIndex = i;

      const pad = step.padding ?? defaultPadding;
      const animate = !prefersReducedMotion();
      const willScroll =
        Boolean(target && step.scroll) && needsScrollFor(target, pad);

      setPageInert(!step.interactive);
      placeSpotlight(target, pad, step.interactive);
      popover.setTrapFocus(!step.interactive);

      if (!willScroll) {
        presentStep(step, i, target);
        return;
      }

      if (!animate) {
        scrollTargetIntoView(target, { animate: false, padding: pad });
        presentStep(step, i, target);
        return;
      }

      /* Keep the card hidden until the scroll has finished, so it is placed
         against the viewport the step actually ends on. */
      hideStepPopover();

      const controller = new AbortController();
      pendingReveal = controller;
      const revealIndex = i;
      scrollTargetIntoView(target, {
        signal: controller.signal,
        padding: pad,
      }).then(() => {
        if (pendingReveal !== controller) return;
        pendingReveal = null;
        if (!isActive || stepIndex !== revealIndex) return;
        presentStep(step, revealIndex, target);
      });
      return;
    }

    /* Nothing showable in this direction. Keep the current step when one is
       already on screen (e.g. Back over a missing target). Stop only when the
       tour has not presented anything yet. */
    if (stepIndex >= 0) return;

    if (skippedMissingTarget) {
      const missingStep = steps[lastMissingIndex] ?? {
        target: null,
        title: "",
      };
      reportTutorialMissingTarget({
        id,
        index: lastMissingIndex,
        step: missingStep,
        outcome: "stop",
      });
      stop({ reason: "missing-target" });
      return;
    }
    stop({ reason: "empty" });
  }

  function onViewportChange() {
    if (!isActive || stepIndex < 0) return;
    const step = steps[stepIndex];
    const target = resolveTutorialTarget(step.target);
    if (tutorialStepHasTargetRef(step) && !target) {
      reportTutorialMissingTarget({
        id,
        index: stepIndex,
        step,
        outcome: "disconnected",
      });
      const nextShowable = findShowableTutorialIndex(
        steps,
        stepIndex + 1,
        "forward",
      );
      if (nextShowable < 0) {
        stop({ reason: "missing-target" });
        return;
      }
      showStep(nextShowable, "forward");
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

    const showable = nearestShowableTutorialIndex(steps, index);
    if (showable < 0) {
      const anyMissing = steps.some(
        (step, i) =>
          isTutorialStepEligible(step, { index: i, step }) &&
          tutorialStepHasTargetRef(step) &&
          !resolveTutorialTarget(step.target),
      );
      if (anyMissing) {
        const firstMissing = steps.findIndex(
          (step, i) =>
            isTutorialStepEligible(step, { index: i, step }) &&
            tutorialStepHasTargetRef(step) &&
            !resolveTutorialTarget(step.target),
        );
        reportTutorialMissingTarget({
          id,
          index: firstMissing,
          step: steps[firstMissing],
          outcome: "stop",
        });
        stop({ reason: "missing-target" });
        return;
      }
      stop({ reason: "empty" });
      return;
    }
    showStep(showable, "forward");
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
    const nextShowable = findShowableTutorialIndex(
      steps,
      stepIndex + 1,
      "forward",
    );
    if (nextShowable < 0) {
      stop({ reason: "done" });
      return;
    }
    showStep(nextShowable, "forward");
  }

  function back() {
    if (!isActive) return;
    const prevShowable = findShowableTutorialIndex(
      steps,
      stepIndex - 1,
      "backward",
    );
    if (prevShowable < 0) return;
    showStep(prevShowable, "backward");
  }

  /**
   * Jump to the nearest showable step to `index`. No-op when none exist
   * (keeps the current step if the tour is already showing one).
   * @param {number} index
   */
  function goTo(index) {
    if (!isActive) {
      start(index);
      return;
    }
    const showable = nearestShowableTutorialIndex(steps, index);
    if (showable < 0) return;
    const direction = showable < stepIndex ? "backward" : "forward";
    showStep(showable, direction);
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

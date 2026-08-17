/**
 * Optional hierarchical numbering for outline headings.
 *
 * Opt in with `data-title-numbering` on `<html>`, or call
 * {@link setTitleNumbering}(true). Off by default.
 *
 * Numbers `main :is(h2, h3, h4)[id]` in document order as `1.`, `1.1.`,
 * `1.2.1.`, … (relative to the shallowest matched level). Opt out per heading
 * with `data-no-title-number`.
 *
 * Injects a leading `.title-number` span so page nav (textContent) picks up
 * the prefix. Call {@link syncTitleNumbering} after DOM changes that add or
 * remove outline headings.
 */

import { syncStickyOffsets } from "./sticky.js";
import { initPageNavPanel } from "./page-nav.js";

const ROOT_ATTR = "data-title-numbering";
const SKIP_ATTR = "data-no-title-number";
const NUMBER_CLASS = "title-number";
const DEFAULT_SELECTOR = "main :is(h2, h3, h4)[id]";

/** @type {string} */
let activeSelector = DEFAULT_SELECTOR;

function rootEl() {
  return document.documentElement;
}

/**
 * @param {Element} heading
 * @returns {number | null}
 */
function headingLevel(heading) {
  const match = /^H([1-6])$/i.exec(heading.tagName);
  return match ? Number(match[1]) : null;
}

/**
 * Build outline labels for a sequence of absolute heading levels.
 * @param {number[]} levels Absolute levels (e.g. `[2, 3, 3, 4]`)
 * @returns {string[]} Labels like `["1.", "1.1.", "1.2.", "1.2.1."]`
 */
export function computeTitleNumberLabels(levels) {
  if (!levels.length) return [];

  const minLevel = Math.min(...levels);
  /** @type {number[]} */
  const counters = [];
  /** @type {string[]} */
  const labels = [];

  for (const level of levels) {
    const depth = level - minLevel;
    counters.length = depth + 1;
    for (let i = 0; i < depth; i++) {
      if (counters[i] === undefined || counters[i] === null) counters[i] = 0;
    }
    counters[depth] = (counters[depth] ?? 0) + 1;
    labels.push(`${counters.join(".")}.`);
  }

  return labels;
}

/**
 * @param {ParentNode} [root=document]
 * @param {string} [selector]
 */
function clearTitleNumbers(root = document, selector = activeSelector) {
  for (const heading of root.querySelectorAll(selector)) {
    if (!(heading instanceof HTMLElement)) continue;
    heading
      .querySelectorAll(`:scope > .${NUMBER_CLASS}`)
      .forEach((node) => node.remove());
  }
}

/**
 * @param {ParentNode} [root=document]
 * @param {string} [selector]
 */
function applyTitleNumbers(root = document, selector = activeSelector) {
  clearTitleNumbers(root, selector);

  const headings = [...root.querySelectorAll(selector)].filter(
    (heading) =>
      heading instanceof HTMLElement &&
      heading.id &&
      !heading.hasAttribute(SKIP_ATTR)
  );

  const levels = headings.map(headingLevel);
  if (levels.some((level) => level === null)) return;

  const labels = computeTitleNumberLabels(/** @type {number[]} */ (levels));

  headings.forEach((heading, index) => {
    const span = document.createElement("span");
    span.className = NUMBER_CLASS;
    span.textContent = `${labels[index] ?? ""}\u00A0`;
    heading.prepend(span);
  });
}

/**
 * Refresh page nav labels and sticky offsets after numbering changes.
 * No-op for page nav when `#page-nav` has not been initialised yet.
 */
function refreshChrome() {
  initPageNavPanel()?.rebuild();
  syncStickyOffsets();
}

/**
 * Apply or clear numbering based on the root attribute.
 * Safe to call when numbering is off (clears leftover spans).
 *
 * @param {object} [options]
 * @param {string} [options.selector] Heading selector (must have `id`)
 * @param {ParentNode} [options.root=document]
 * @param {boolean} [options.refresh=true]
 *   Rebuild page nav and sync sticky offsets (set false during `initShell`
 *   before `initPageNavPanel` so the first nav build already includes prefixes)
 */
export function syncTitleNumbering({
  selector = activeSelector,
  root = document,
  refresh = true,
} = {}) {
  activeSelector = selector;
  if (rootEl().hasAttribute(ROOT_ATTR)) {
    applyTitleNumbers(root, selector);
  } else {
    clearTitleNumbers(root, selector);
  }
  if (refresh) refreshChrome();
}

/**
 * Read the root attribute and apply numbering if enabled.
 * Called from {@link initShell} before page nav so the first nav build sees
 * prefixes (no rebuild).
 *
 * @param {object} [options]
 * @param {string} [options.selector]
 * @param {ParentNode} [options.root]
 */
export function initTitleNumbering(options = {}) {
  syncTitleNumbering({ ...options, refresh: false });
}

/**
 * Enable or disable title numbering (`data-title-numbering` on `<html>`).
 * @param {boolean} enabled
 */
export function setTitleNumbering(enabled) {
  rootEl().toggleAttribute(ROOT_ATTR, Boolean(enabled));
  syncTitleNumbering();
}

/** @returns {boolean} */
export function isTitleNumberingEnabled() {
  return rootEl().hasAttribute(ROOT_ATTR);
}

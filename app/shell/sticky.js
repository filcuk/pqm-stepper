/**
 * Optional sticky site header and section headings.
 *
 * Opt in with attributes on `<html>`:
 *   data-sticky-header
 *   data-sticky-section-headings
 *
 * Or call setStickyHeader() / setStickySectionHeadings().
 *
 * Stack model while pinned:
 *   site header (top: 0) — separate bar when enabled
 *   → single content slot (top: headerOffset + gap):
 *       tier alone → segment title
 *       tier + section → breadcrumb “Segment > Section” in the tier bar
 *       section alone (tier scrolled away) → section title
 *
 * Pinning is layout-neutral: `--sticky-collapse-reserve` gives back the height
 * a tier header loses to lead collapse, and stuck detection reads in-flow
 * document Y + scrollY rather than the clamped sticky rect. Together these stop
 * the boundary oscillation you would otherwise get when scroll stops on a pin.
 *
 * syncStickyOffsets() recollects participants, remasures offsets, and
 * refreshes stuck state. On scroll, only stuck state is updated (rAF-throttled).
 *
 * While pinned, each participant gets `data-sticky-stuck`; the bottom-most
 * *visible* pinned element also gets `data-sticky-stuck-edge` (hairline + shadow).
 * Sections merged into a tier crumb get `data-sticky-crumb-merged` (ghost chrome).
 *
 * CSS pins only under `data-sticky-ready` (set here on boot) so headings never
 * pin without the chrome this module paints; `data-sticky-boot` holds the fades
 * at 0ms across the first sync.
 *
 * CSS variables:
 *   --sticky-header-offset     on :root — live bottom of the site header (no gap)
 *   --sticky-tier-offset       on each .content-tier — pinned bar height, used
 *                              only for scroll-margin clearance
 *   --sticky-collapse-reserve  on each tier header — height reclaimed while pinned
 *
 * Below SHORT_VIEWPORT_MAX, tier headers leave the stack (no crumb).
 *
 * Page nav uses getHeadingScrollY() instead of scrollIntoView: sticky elements
 * report clamped visual offsets once pinned, which breaks upward scroll math.
 */

import { createIcon } from "../utils/icons.js";
import { prefersReducedMotion } from "../utils/dom.js";

/** Match the short-viewport CSS guard that drops tier headers from the stack. */
const SHORT_VIEWPORT_MAX = 700;

/**
 * px — once pinned, require scroll to move back past the pin line (or the
 * containing block to carry the box further out) by this much before
 * unpinning. Absorbs sub-pixel rounding so a pin cannot flip frame to frame.
 */
const STUCK_HYSTERESIS_PX = 4;

/**
 * px — ignore document-height noise below this when invalidating cached flow
 * tops. Pin/unpin is height-neutral by design but can still round by ~1px;
 * remeasuring on that would feed straight back into pin state.
 */
const FLOW_REMEASURE_TOLERANCE_PX = 8;

const STUCK_ATTR = "data-sticky-stuck";
const STUCK_EDGE_ATTR = "data-sticky-stuck-edge";
const CRUMB_ATTR = "data-sticky-crumb";
const CRUMB_MERGED_ATTR = "data-sticky-crumb-merged";

/** CSS pins only once this module can resolve and paint stuck state. */
const READY_ATTR = "data-sticky-ready";

/** Zeroes the fade durations so the first sync paints instead of fading in. */
const BOOT_ATTR = "data-sticky-boot";

/**
 * Hold the crumb across brief gaps between subsections so the large segment
 * title does not flash in and out during fast handoffs.
 */
const CRUMB_HOLD_MS = 220;

/**
 * @typedef {Object} CrumbAnimState
 * @property {ReturnType<typeof setTimeout> | null} holdTimer
 * @property {ReturnType<typeof setTimeout> | null} swapTimer
 * @property {string} shownCurrent
 * @property {string} pendingCurrent
 */

/** @type {WeakMap<HTMLElement, CrumbAnimState>} */
const crumbAnim = new WeakMap();

/** @type {WeakMap<HTMLElement, number>} in-flow document Y of border-box top */
let flowTopCache = new WeakMap();

function rootEl() {
  return document.documentElement;
}

/** Resolve a root CSS length custom property to CSS pixels. */
function cssPx(root, prop) {
  const raw = getComputedStyle(root).getPropertyValue(prop).trim();
  if (!raw) return 0;
  if (raw.endsWith("px")) return parseFloat(raw) || 0;
  if (raw.endsWith("rem")) {
    const fontSize = parseFloat(getComputedStyle(root).fontSize) || 16;
    return (parseFloat(raw) || 0) * fontSize;
  }
  return parseFloat(raw) || 0;
}

/**
 * @typedef {Object} StickyParticipants
 * @property {HTMLElement | null} siteHeader
 * @property {HTMLElement[]} tierHeaders
 * @property {HTMLElement[]} sectionHeadings
 * @property {HTMLElement[]} tiers
 */

/** @type {StickyParticipants} */
let participants = {
  siteHeader: null,
  tierHeaders: [],
  sectionHeadings: [],
  tiers: [],
};

/** @type {ResizeObserver | null} */
let resizeObserver = null;

let listenersBound = false;
let scrollTicking = false;
/** Cached `--sticky-gap` in px; refreshed on collect / resize. */
let cachedGapPx = 0;
/** Document height at last flow-top measurement; guards dynamic content. */
let lastScrollHeight = -1;

function collectParticipants() {
  const root = rootEl();
  const headerOn = root.hasAttribute("data-sticky-header");
  const sectionsOn = root.hasAttribute("data-sticky-section-headings");

  participants = {
    siteHeader:
      headerOn ? document.querySelector("body > header") : null,
    tierHeaders: sectionsOn
      ? [...document.querySelectorAll(".content-tier-header")]
      : [],
    sectionHeadings: sectionsOn
      ? [...document.querySelectorAll(".section-title")]
      : [],
    tiers: [...document.querySelectorAll(".content-tier")],
  };

  cachedGapPx = cssPx(root, "--sticky-gap");
  invalidateFlowTops();
  observeResizeTargets();
}

function invalidateFlowTops() {
  flowTopCache = new WeakMap();
  lastScrollHeight = document.documentElement.scrollHeight;
}

/** Drop cached flow tops when content height changed (expanded panels, etc.). */
function invalidateFlowTopsIfResized() {
  const height = document.documentElement.scrollHeight;
  if (Math.abs(height - lastScrollHeight) > FLOW_REMEASURE_TOLERANCE_PX) {
    invalidateFlowTops();
  }
}

/**
 * Cached in-flow document Y for an element's border-box top (sticky neutralized).
 * Live sticky rects clamp to `top` while pinned, which couples stuck chrome /
 * lead collapse back into detection and causes stick-edge spasm.
 * @param {HTMLElement} el
 * @returns {number}
 */
function getFlowTop(el) {
  const cached = flowTopCache.get(el);
  if (cached !== undefined) return cached;
  const top = inFlowDocumentTop(el);
  flowTopCache.set(el, top);
  return top;
}

function observeResizeTargets() {
  if (!resizeObserver) return;

  resizeObserver.disconnect();

  const { siteHeader, tierHeaders } = participants;
  if (siteHeader) resizeObserver.observe(siteHeader);
  for (const el of tierHeaders) {
    resizeObserver.observe(el);
  }
}

/**
 * Publish `--sticky-header-offset` (border-box bottom of the site header, no gap).
 * @returns {number} offset in CSS pixels
 */
function publishHeaderOffset() {
  const root = rootEl();
  const { siteHeader } = participants;
  let offset = 0;

  if (siteHeader && root.hasAttribute("data-sticky-header")) {
    offset = Math.max(0, siteHeader.getBoundingClientRect().bottom);
  }

  const next = `${Math.round(offset)}px`;
  if (root.style.getPropertyValue("--sticky-header-offset") !== next) {
    root.style.setProperty("--sticky-header-offset", next);
  }
  return offset;
}

/**
 * Measure each tier header in both states and publish:
 *
 *   --sticky-collapse-reserve (header) — height lost when it pins (lead hidden,
 *     tighter padding). CSS gives it back as margin so pinning never changes
 *     document height. Without it, pinning shortens the page, the next tier
 *     rises, that evicts the pinned header, the lead returns, and the boundary
 *     oscillates.
 *
 *   --sticky-tier-offset (tier) — pinned bar height, used only by
 *     `scroll-margin-top` so page-nav lands section titles below the bar
 *     instead of behind it. It never feeds sticky `top` or pin state.
 *
 * Measured on collect / resize only — never on the scroll path.
 */
function publishTierMetrics() {
  const sectionsOn = rootEl().hasAttribute("data-sticky-section-headings");
  const shortViewport = window.innerHeight < SHORT_VIEWPORT_MAX;

  for (const tier of participants.tiers) {
    const header = tier.querySelector(":scope > .content-tier-header");
    if (!(header instanceof HTMLElement)) {
      tier.style.setProperty("--sticky-tier-offset", "0px");
      continue;
    }

    const wasStuck = header.hasAttribute(STUCK_ATTR);

    // Measure both states with the reserve neutralized; layout is restored
    // before paint, so this is invisible. Fractional heights matter: rounding
    // to whole pixels leaves a 1px page-height wobble that re-enters pin state.
    header.style.setProperty("--sticky-collapse-reserve", "0px");
    header.removeAttribute(STUCK_ATTR);
    const naturalHeight = header.getBoundingClientRect().height;
    header.setAttribute(STUCK_ATTR, "");
    const pinnedHeight = header.getBoundingClientRect().height;
    if (!wasStuck) header.removeAttribute(STUCK_ATTR);

    const reserve = Math.max(0, naturalHeight - pinnedHeight);
    header.style.setProperty("--sticky-collapse-reserve", `${reserve.toFixed(3)}px`);

    const barHeight = sectionsOn && !shortViewport ? pinnedHeight : 0;
    tier.style.setProperty("--sticky-tier-offset", `${barHeight.toFixed(3)}px`);
  }
}

/**
 * Resolved sticky `top` for a participant, matching the CSS stack.
 * Tier headers and section titles share the same content slot.
 * @param {HTMLElement} el
 * @param {number} headerOffset
 * @returns {number}
 */
function resolvedTopFor(el, headerOffset) {
  if (el === participants.siteHeader) {
    return 0;
  }
  return headerOffset + cachedGapPx;
}

/**
 * Visible label for a heading (includes title-number text when present).
 * @param {HTMLElement | null} heading
 * @returns {string}
 */
function headingLabel(heading) {
  if (!heading) return "";
  return heading.textContent.replace(/\s+/g, " ").trim();
}

/**
 * Scroll so `heading` sits under the sticky stack (same math as page nav).
 * @param {HTMLElement} heading
 */
function scrollToHeading(heading) {
  window.scrollTo({
    top: getHeadingScrollY(heading),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/**
 * Resolve a hash href to a heading and scroll there.
 * @param {Event} event
 * @param {HTMLAnchorElement} link
 */
function navigateHeadingLink(event, link) {
  const hash = link.getAttribute("href");
  if (!hash || hash.charAt(0) !== "#") return;
  const heading = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!(heading instanceof HTMLElement)) return;
  event.preventDefault();
  scrollToHeading(heading);
  if (heading.id) {
    history.replaceState(null, "", `#${heading.id}`);
  }
}

/**
 * Point a crumb link at a heading (or disable when the heading has no id).
 * @param {Element | null} link
 * @param {HTMLElement | null} heading
 */
function bindCrumbHeadingLink(link, heading) {
  if (!(link instanceof HTMLAnchorElement)) return;
  if (heading?.id) {
    link.href = `#${heading.id}`;
    link.removeAttribute("aria-disabled");
    link.tabIndex = 0;
  } else {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
  }
}

/**
 * Ensure a reusable crumb trail exists inside a tier header.
 * @param {HTMLElement} tierHeader
 * @returns {HTMLElement}
 */
function ensureStickyCrumb(tierHeader) {
  let crumb = tierHeader.querySelector(":scope > .sticky-crumb");
  if (crumb instanceof HTMLElement) return crumb;

  crumb = document.createElement("nav");
  crumb.className = "sticky-crumb";
  crumb.setAttribute("aria-label", "Pinned section");

  const primary = document.createElement("a");
  primary.className = "sticky-crumb-primary";

  const sep = document.createElement("span");
  sep.className = "sticky-crumb-sep";
  sep.setAttribute("aria-hidden", "true");
  sep.append(createIcon("chevron-right", { className: "sticky-crumb-sep-icon" }));

  const current = document.createElement("a");
  current.className = "sticky-crumb-current";

  crumb.append(primary, sep, current);

  crumb.addEventListener("click", (event) => {
    const link = event.target instanceof Element
      ? event.target.closest("a.sticky-crumb-primary, a.sticky-crumb-current")
      : null;
    if (!(link instanceof HTMLAnchorElement) || !crumb.contains(link)) return;
    navigateHeadingLink(event, link);
  });

  const title = tierHeader.querySelector(":scope > .segment-title");
  if (title) {
    title.after(crumb);
  } else {
    tierHeader.prepend(crumb);
  }
  return crumb;
}

/**
 * @param {HTMLElement} tierHeader
 * @returns {CrumbAnimState}
 */
function crumbAnimState(tierHeader) {
  let state = crumbAnim.get(tierHeader);
  if (!state) {
    state = {
      holdTimer: null,
      swapTimer: null,
      shownCurrent: "",
      pendingCurrent: "",
    };
    crumbAnim.set(tierHeader, state);
  }
  return state;
}

/** @param {HTMLElement} tierHeader */
function cancelCrumbHold(tierHeader) {
  const state = crumbAnim.get(tierHeader);
  if (!state?.holdTimer) return;
  clearTimeout(state.holdTimer);
  state.holdTimer = null;
}

/** @param {HTMLElement} tierHeader */
function cancelCrumbSwap(tierHeader) {
  const state = crumbAnim.get(tierHeader);
  if (!state?.swapTimer) return;
  clearTimeout(state.swapTimer);
  state.swapTimer = null;
}

/**
 * Crossfade `.sticky-crumb-current` to `nextLabel`.
 *
 * Scroll fires this every frame while a section is pinned. Restarting the fade
 * each time left the label stuck at opacity 0 until scrolling stopped. Instead,
 * one in-flight fade runs to completion and applies the latest `pendingCurrent`.
 *
 * @param {HTMLElement} tierHeader
 * @param {HTMLElement} currentEl
 * @param {string} nextLabel
 */
function setCrumbCurrentLabel(tierHeader, currentEl, nextLabel) {
  const state = crumbAnimState(tierHeader);
  state.pendingCurrent = nextLabel;

  if (
    state.shownCurrent === nextLabel &&
    currentEl.textContent === nextLabel &&
    !state.swapTimer
  ) {
    currentEl.classList.remove("is-swapping");
    return;
  }

  if (prefersReducedMotion() || !state.shownCurrent) {
    cancelCrumbSwap(tierHeader);
    currentEl.classList.remove("is-swapping");
    currentEl.textContent = nextLabel;
    state.shownCurrent = nextLabel;
    return;
  }

  // Already fading — keep going; the timer will pick up pendingCurrent.
  if (state.swapTimer) return;

  currentEl.classList.add("is-swapping");
  const swapMs = cssPx(rootEl(), "--sticky-crumb-ms") || 180;
  const halfMs = Math.max(40, Math.round(swapMs * 0.55));

  state.swapTimer = window.setTimeout(() => {
    state.swapTimer = null;
    const label = state.pendingCurrent;
    currentEl.textContent = label;
    state.shownCurrent = label;
    // Double rAF so the opacity:0 frame paints before fading back in.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        currentEl.classList.remove("is-swapping");
        // Label changed again during fade-in — run another coalesced swap.
        if (state.pendingCurrent && state.pendingCurrent !== state.shownCurrent) {
          setCrumbCurrentLabel(tierHeader, currentEl, state.pendingCurrent);
        }
      });
    });
  }, halfMs);
}

/**
 * Clear breadcrumb UI on a tier header.
 * @param {HTMLElement} tierHeader
 */
function clearTierCrumb(tierHeader) {
  cancelCrumbHold(tierHeader);
  cancelCrumbSwap(tierHeader);
  const state = crumbAnim.get(tierHeader);
  if (state) {
    state.shownCurrent = "";
    state.pendingCurrent = "";
  }

  tierHeader.removeAttribute(CRUMB_ATTR);
  const crumb = tierHeader.querySelector(":scope > .sticky-crumb");
  if (!(crumb instanceof HTMLElement)) return;
  const primary = crumb.querySelector(".sticky-crumb-primary");
  const current = crumb.querySelector(".sticky-crumb-current");
  if (primary) primary.textContent = "";
  if (current instanceof HTMLElement) {
    current.classList.remove("is-swapping");
    current.textContent = "";
  }
}

/**
 * Keep the crumb visible briefly when no section is pinned, so fast subsection
 * handoffs never snap back to the large segment title.
 * @param {HTMLElement} tierHeader
 */
function scheduleCrumbHoldClear(tierHeader) {
  const state = crumbAnimState(tierHeader);
  if (state.holdTimer) return;

  state.holdTimer = window.setTimeout(() => {
    state.holdTimer = null;
    if (!tierHeader.hasAttribute(STUCK_ATTR)) {
      clearTierCrumb(tierHeader);
      return;
    }
    const tier = tierHeader.closest(".content-tier");
    if (!tier) {
      clearTierCrumb(tierHeader);
      return;
    }
    const stillPinned = [...tier.querySelectorAll(".section-title")].some(
      (section) =>
        section instanceof HTMLElement && section.hasAttribute(STUCK_ATTR),
    );
    if (!stillPinned) clearTierCrumb(tierHeader);
  }, CRUMB_HOLD_MS);
}

/**
 * Grow segment → Segment > Section when both are pinned in the same slot.
 * Merged sections keep sticky containment but suppress chrome.
 */
function syncCrumbs() {
  const shortViewport = window.innerHeight < SHORT_VIEWPORT_MAX;

  for (const section of participants.sectionHeadings) {
    section.removeAttribute(CRUMB_MERGED_ATTR);
  }

  for (const tierHeader of participants.tierHeaders) {
    if (shortViewport || !tierHeader.hasAttribute(STUCK_ATTR)) {
      clearTierCrumb(tierHeader);
      continue;
    }

    const tier = tierHeader.closest(".content-tier");
    if (!tier) {
      clearTierCrumb(tierHeader);
      continue;
    }

    /** @type {HTMLElement | null} */
    let stuckSection = null;
    for (const section of tier.querySelectorAll(".section-title")) {
      if (!(section instanceof HTMLElement)) continue;
      if (!section.hasAttribute(STUCK_ATTR)) continue;
      stuckSection = section;
    }

    if (!stuckSection) {
      // Hold the existing crumb across the handoff gap; only fall back to the
      // large segment title after CRUMB_HOLD_MS with no section pinned.
      if (tierHeader.hasAttribute(CRUMB_ATTR)) {
        scheduleCrumbHoldClear(tierHeader);
      }
      continue;
    }

    cancelCrumbHold(tierHeader);

    const segment = tierHeader.querySelector(".segment-title");
    const crumb = ensureStickyCrumb(tierHeader);
    const primary = crumb.querySelector(".sticky-crumb-primary");
    const current = crumb.querySelector(".sticky-crumb-current");
    if (primary instanceof HTMLElement) {
      primary.textContent = headingLabel(
        segment instanceof HTMLElement ? segment : null,
      );
      bindCrumbHeadingLink(primary, segment instanceof HTMLElement ? segment : null);
    }

    const nextLabel = headingLabel(stuckSection);
    const enteringCrumb = !tierHeader.hasAttribute(CRUMB_ATTR);

    if (current instanceof HTMLElement) {
      bindCrumbHeadingLink(current, stuckSection);
      if (enteringCrumb) {
        // Instant label on first show; opacity transition handles segment → crumb.
        cancelCrumbSwap(tierHeader);
        current.classList.remove("is-swapping");
        current.textContent = nextLabel;
        const state = crumbAnimState(tierHeader);
        state.shownCurrent = nextLabel;
        state.pendingCurrent = nextLabel;
      } else {
        setCrumbCurrentLabel(tierHeader, current, nextLabel);
      }
    }

    if (enteringCrumb && !prefersReducedMotion()) {
      // Force a paint at opacity 0 before enabling the crumb so fade-in runs.
      void crumb.offsetWidth;
    }

    tierHeader.setAttribute(CRUMB_ATTR, "");
    stuckSection.setAttribute(CRUMB_MERGED_ATTR, "");
    stuckSection.removeAttribute(STUCK_EDGE_ATTR);
  }
}

/**
 * Sticky containing block for a participant — the box that eventually carries
 * it out of the slot. Its height does not depend on pin state.
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
function stickyContainerFor(el) {
  if (el.classList.contains("content-tier-header")) {
    return el.closest(".content-tier");
  }
  if (el.classList.contains("section-title")) {
    return el.closest(".content-section");
  }
  return null;
}

/**
 * Whether `el` should carry `data-sticky-stuck`.
 * Uses in-flow document Y + scrollY (not live sticky rect.top) so lead collapse
 * and crumb chrome cannot flip the flag when scroll stops on the pin line.
 * The containing block still gates exit (peer handoff).
 * @param {HTMLElement} el
 * @param {number} stickyTop
 * @returns {boolean}
 */
function computeStuck(el, stickyTop) {
  const wasStuck = el.hasAttribute(STUCK_ATTR);

  // Eviction is measured against the containing block, never the element's own
  // box: a pinned tier header is shorter (lead hidden), so testing its own
  // bottom would make each state imply the other and flip every frame.
  const container = stickyContainerFor(el);
  const bottom = (container ?? el).getBoundingClientRect().bottom;
  const exitLine = stickyTop + 0.5 - (wasStuck ? STUCK_HYSTERESIS_PX : 0);
  if (bottom <= exitLine) return false;

  const flowTop = getFlowTop(el);
  const pinLine = window.scrollY + stickyTop;
  return wasStuck
    ? pinLine >= flowTop - STUCK_HYSTERESIS_PX
    : pinLine >= flowTop - 0.5;
}

/**
 * Apply stuck flags for a participant list.
 * @param {HTMLElement[]} els
 * @param {number} headerOffset
 */
function applyStuckFlags(els, headerOffset) {
  for (const el of els) {
    const stickyTop = resolvedTopFor(el, headerOffset);
    el.toggleAttribute(STUCK_ATTR, computeStuck(el, stickyTop));
    el.removeAttribute(STUCK_EDGE_ATTR);
  }
}

/**
 * Toggle stuck / stuck-edge attributes from scroll + in-flow geometry.
 * @param {number} headerOffset
 */
function syncStuckState(headerOffset) {
  const root = rootEl();
  const headerOn = root.hasAttribute("data-sticky-header");
  const sectionsOn = root.hasAttribute("data-sticky-section-headings");
  const shortViewport = window.innerHeight < SHORT_VIEWPORT_MAX;

  /** @type {HTMLElement[]} */
  const primary = [];
  if (headerOn && participants.siteHeader) {
    primary.push(participants.siteHeader);
  }
  if (sectionsOn && !shortViewport) {
    primary.push(...participants.tierHeaders);
  }

  /** @type {HTMLElement[]} */
  const sections = sectionsOn ? [...participants.sectionHeadings] : [];

  /** @type {HTMLElement[]} */
  const active = [...primary, ...sections];

  // Pinning is layout-neutral (see publishTierMetrics), so tier and section
  // flags can be resolved against the same cached flow geometry.
  applyStuckFlags(primary, headerOffset);
  applyStuckFlags(sections, headerOffset);

  // Clear attributes on participants that are no longer in the active set
  // (e.g. tier headers after a short-viewport transition).
  const activeSet = new Set(active);
  for (const el of [
    participants.siteHeader,
    ...participants.tierHeaders,
    ...participants.sectionHeadings,
  ]) {
    if (!el || activeSet.has(el)) continue;
    el.removeAttribute(STUCK_ATTR);
    el.removeAttribute(STUCK_EDGE_ATTR);
    el.removeAttribute(CRUMB_ATTR);
    el.removeAttribute(CRUMB_MERGED_ATTR);
  }

  // Crumb swap must not change tier-header height (segment stays in layout).
  syncCrumbs();

  /** @type {HTMLElement | null} */
  let edgeEl = null;
  let edgeBottom = -Infinity;
  for (const el of active) {
    if (!el.hasAttribute(STUCK_ATTR)) continue;
    // Ghost section under a tier crumb must not own the hairline/shadow.
    if (el.hasAttribute(CRUMB_MERGED_ATTR)) continue;
    const bottom = el.getBoundingClientRect().bottom;
    if (bottom >= edgeBottom) {
      edgeBottom = bottom;
      edgeEl = el;
    }
  }

  if (edgeEl) {
    edgeEl.setAttribute(STUCK_EDGE_ATTR, "");
  }
}

/** Reset all sticky state and offset variables. */
function clearStickyState() {
  const root = rootEl();
  root.removeAttribute("data-sticky-header-stuck");
  root.style.setProperty("--sticky-header-offset", "0px");

  for (const el of [
    participants.siteHeader,
    ...participants.tierHeaders,
    ...participants.sectionHeadings,
  ]) {
    if (!el) continue;
    el.removeAttribute(STUCK_ATTR);
    el.removeAttribute(STUCK_EDGE_ATTR);
    el.removeAttribute(CRUMB_ATTR);
    el.removeAttribute(CRUMB_MERGED_ATTR);
    el.style.top = "";
  }

  for (const tierHeader of document.querySelectorAll(".content-tier-header")) {
    if (!(tierHeader instanceof HTMLElement)) continue;
    clearTierCrumb(tierHeader);
    tierHeader.removeAttribute(STUCK_ATTR);
    tierHeader.removeAttribute(CRUMB_MERGED_ATTR);
    tierHeader.style.removeProperty("--sticky-collapse-reserve");
  }

  invalidateFlowTops();

  for (const tier of participants.tiers) {
    tier.style.setProperty("--sticky-tier-offset", "0px");
  }
}

/**
 * Full sync: recollect, remasure offsets, refresh stuck state.
 * Safe to call when stickiness is off (offsets and attributes reset).
 */
export function syncStickyOffsets() {
  collectParticipants();

  const root = rootEl();
  const anyOn =
    root.hasAttribute("data-sticky-header") ||
    root.hasAttribute("data-sticky-section-headings");

  if (!anyOn) {
    clearStickyState();
    return;
  }

  // Drop the legacy root attribute if a previous version left it behind.
  root.removeAttribute("data-sticky-header-stuck");

  publishTierMetrics();
  invalidateFlowTops();
  const headerOffset = publishHeaderOffset();
  syncStuckState(headerOffset);
}

/** Scroll-path update: offsets that move with scroll + stuck flags. */
function onScrollFrame() {
  scrollTicking = false;

  const root = rootEl();
  if (
    !root.hasAttribute("data-sticky-header") &&
    !root.hasAttribute("data-sticky-section-headings")
  ) {
    return;
  }

  invalidateFlowTopsIfResized();
  const headerOffset = publishHeaderOffset();
  syncStuckState(headerOffset);
}

function onScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(onScrollFrame);
}

function onResize() {
  syncStickyOffsets();
}

/** @param {boolean} enabled */
export function setStickyHeader(enabled) {
  rootEl().toggleAttribute("data-sticky-header", Boolean(enabled));
  requestAnimationFrame(syncStickyOffsets);
}

/** @param {boolean} enabled */
export function setStickySectionHeadings(enabled) {
  rootEl().toggleAttribute("data-sticky-section-headings", Boolean(enabled));
  requestAnimationFrame(syncStickyOffsets);
}

/** @returns {boolean} */
export function isStickyHeader() {
  return rootEl().hasAttribute("data-sticky-header");
}

/** @returns {boolean} */
export function isStickySectionHeadings() {
  return rootEl().hasAttribute("data-sticky-section-headings");
}

/**
 * In-flow document Y of an element's border-box top.
 * Sticky paint offsets are neutralized — `offsetTop` / live rects follow the
 * visual sticky box once an element is pinned, which breaks upward scroll math.
 * @param {HTMLElement} el
 * @returns {number}
 */
function inFlowDocumentTop(el) {
  /** @type {{ el: HTMLElement, position: string }[]} */
  const touched = [];
  let node = /** @type {HTMLElement | null} */ (el);
  while (node && node !== document.body) {
    if (getComputedStyle(node).position === "sticky") {
      touched.push({ el: node, position: node.style.position });
      node.style.position = "static";
    }
    node = node.parentElement;
  }

  const top = el.getBoundingClientRect().top + window.scrollY;

  for (const { el: stickyEl, position } of touched) {
    stickyEl.style.position = position;
  }
  return top;
}

/**
 * Window `scrollY` that places `heading` under the sticky stack, matching
 * `scroll-margin-top` after tier-lead collapse. Prefer this over `scrollIntoView`
 * for sticky headings — otherwise navigating upward undershoots and nudges.
 *
 * @param {HTMLElement} heading
 * @returns {number}
 */
export function getHeadingScrollY(heading) {
  const margin = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
  // Pinning is layout-neutral, so in-flow Y is the same before and after the
  // destination tier pins — no need to simulate lead collapse here.
  const top = inFlowDocumentTop(heading);
  return Math.max(0, top - margin);
}

/**
 * Sync offsets now and on resize/scroll. Call once from `initShell()`.
 */
export function initStickyChrome() {
  if (typeof ResizeObserver !== "undefined" && !resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      // Pinning itself resizes tier headers; only remasure from a settled,
      // fully expanded layout (avoids reflow churn while scrolling).
      if (!participants.tierHeaders.some((el) => el.hasAttribute(STUCK_ATTR))) {
        publishTierMetrics();
      }
      invalidateFlowTopsIfResized();
      const headerOffset = publishHeaderOffset();
      syncStuckState(headerOffset);
    });
  }

  const root = rootEl();
  // Pinning and its chrome must land in the same paint: a page reloaded
  // mid-document restores scroll before this module runs, so CSS-only pinning
  // would show bare headings over the content behind them, then fade the
  // background in once the first sync ran.
  root.setAttribute(BOOT_ATTR, "");
  root.setAttribute(READY_ATTR, "");

  syncStickyOffsets();

  // Two frames: one to paint the boot state, one before fades are armed again.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.removeAttribute(BOOT_ATTR));
  });

  if (listenersBound) return;
  listenersBound = true;
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", onStickyTitleClick);
}

/**
 * Click a pinned segment / section title (when not covered by the crumb) to
 * jump to that heading — same clearance math as page nav.
 * @param {MouseEvent} event
 */
function onStickyTitleClick(event) {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest(".sticky-crumb")) return;

  const segment = event.target.closest(
    ".content-tier-header[data-sticky-stuck]:not([data-sticky-crumb]) .segment-title",
  );
  if (segment instanceof HTMLElement && segment.id) {
    event.preventDefault();
    scrollToHeading(segment);
    history.replaceState(null, "", `#${segment.id}`);
    return;
  }

  const section = event.target.closest(
    ".section-title[data-sticky-stuck]:not([data-sticky-crumb-merged])",
  );
  if (section instanceof HTMLElement && section.id) {
    event.preventDefault();
    scrollToHeading(section);
    history.replaceState(null, "", `#${section.id}`);
  }
}

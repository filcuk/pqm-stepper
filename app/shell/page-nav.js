import { prefersReducedMotion } from "../utils/dom.js";
import { getHeadingScrollY } from "./sticky.js";

/** @type {WeakMap<HTMLElement, PageNavInstance>} */
const instances = new WeakMap();

function scrollToY(top) {
  window.scrollTo({
    top,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

function getMaxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function collectHeadings(root, selector) {
  return [...root.querySelectorAll(selector)].filter((heading) => heading.id);
}

function headingLabel(heading) {
  return heading.textContent.replace(/\s+/g, " ").trim();
}

function isTierHeading(heading) {
  return heading.hasAttribute("data-page-nav-tier");
}

/**
 * True when the fixed nav strip horizontally overlaps `main`.
 * @param {HTMLElement} navEl
 * @param {Element | null} mainEl
 */
function navOverlapsMain(navEl, mainEl) {
  if (!mainEl) return true;
  const navRect = navEl.getBoundingClientRect();
  const mainRect = mainEl.getBoundingClientRect();
  return navRect.left < mainRect.right && navRect.right > mainRect.left;
}

/**
 * @typedef {Object} PageNavOptions
 * @property {string} [headingSelector="main :is(h2, h3)[id]"] CSS selector for headings (must have `id`)
 * @property {ParentNode} [headingRoot=document] Root to scan for headings
 */

/**
 * @typedef {Object} PageNavInstance
 * @property {() => void} update Recompute scroll progress ring
 * @property {() => HTMLElement[]} getHeadings Current heading elements in the nav list
 * @property {() => HTMLElement[]} rebuild Rescan headings and rebuild links
 * @property {() => void} destroy Remove listeners (safe to call more than once)
 */

/**
 * Fixed page navigation: in-page headings, jump to top, jump to bottom.
 *
 * Expects markup from {@link PAGE_NAV_MARKUP} in `app/render-shell.js` (injected by `initShell()`).
 *
 * @param {HTMLElement | null} navEl Root `.page-nav` element
 * @param {PageNavOptions} [options]
 * @returns {PageNavInstance | null}
 */
export function initPageNav(
  navEl,
  {
    headingSelector = "main :is(h2, h3)[id]",
    headingRoot = document,
  } = {}
) {
  if (!navEl) return null;

  const existing = instances.get(navEl);
  if (existing) return existing;

  const listEl = navEl.querySelector(".page-nav-list");
  const panelEl = navEl.querySelector(".page-nav-panel");
  const upBtn = navEl.querySelector('[data-page-nav="up"]');
  const downBtn = navEl.querySelector('[data-page-nav="down"]');
  const mainEl = document.querySelector("main");

  let ticking = false;
  /** @type {HTMLElement[]} */
  let headings = [];

  /** Toggle full right-edge hover when the strip clears `main`; otherwise jumps-only. */
  function syncEdgeHoverMode() {
    const edgeHover = !navOverlapsMain(navEl, mainEl);
    navEl.classList.toggle("page-nav--edge-hover", edgeHover);
  }

  /** @param {Event} event */
  function onLinkClick(event) {
    const link = event.currentTarget;
    if (!(link instanceof HTMLAnchorElement)) return;

    const id = link.getAttribute("href")?.slice(1);
    if (!id) return;

    const heading = document.getElementById(id);
    if (!heading) return;

    event.preventDefault();
    // Manual Y (not scrollIntoView): sticky headings + collapsing tier leads
    // otherwise undershoot when navigating upward, requiring repeated clicks.
    scrollToY(getHeadingScrollY(heading));
    history.replaceState(null, "", `#${heading.id}`);
  }

  /** @param {HTMLElement} heading */
  function createNavLink(heading) {
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.className = "page-nav-link";
    link.textContent = headingLabel(heading);
    link.addEventListener("click", onLinkClick);
    return link;
  }

  function buildHeadingLinks() {
    if (!listEl) return [];

    listEl.replaceChildren();
    headings = collectHeadings(headingRoot, headingSelector);
    /** @type {HTMLUListElement | null} */
    let sublist = null;
    /** @type {HTMLLIElement | null} */
    let tierItem = null;

    for (const heading of headings) {
      if (isTierHeading(heading)) {
        tierItem = document.createElement("li");
        tierItem.className = "page-nav-item page-nav-item--tier";

        const link = createNavLink(heading);
        link.classList.add("page-nav-link--tier");
        tierItem.append(link);

        sublist = null;
        listEl.append(tierItem);
        continue;
      }

      if (tierItem) {
        if (!sublist) {
          sublist = document.createElement("ul");
          sublist.className = "page-nav-sublist";
          tierItem.append(sublist);
        }

        const item = document.createElement("li");
        item.className = "page-nav-item page-nav-item--section";

        const link = createNavLink(heading);
        link.classList.add("page-nav-link--section");
        item.append(link);

        sublist.append(item);
        continue;
      }

      const item = document.createElement("li");
      item.className = "page-nav-item";
      item.append(createNavLink(heading));
      listEl.append(item);
    }

    if (panelEl) {
      panelEl.hidden = headings.length === 0;
    }

    return headings;
  }

  function update() {
    const maxScroll = getMaxScroll();
    const progress =
      maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;

    navEl.style.setProperty("--scroll-progress", String(progress));
    syncEdgeHoverMode();
    ticking = false;
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function onJumpUp(event) {
    scrollToY(0);
    event.currentTarget?.blur();
  }

  function onJumpDown(event) {
    scrollToY(getMaxScroll());
    event.currentTarget?.blur();
  }

  function destroy() {
    if (!instances.has(navEl)) return;

    window.removeEventListener("scroll", onScrollOrResize);
    window.removeEventListener("resize", onScrollOrResize);
    upBtn?.removeEventListener("click", onJumpUp);
    downBtn?.removeEventListener("click", onJumpDown);
    navEl.classList.remove("page-nav--edge-hover");

    listEl
      ?.querySelectorAll(".page-nav-link")
      .forEach((link) => link.removeEventListener("click", onLinkClick));

    instances.delete(navEl);
  }

  upBtn?.addEventListener("click", onJumpUp);
  downBtn?.addEventListener("click", onJumpDown);
  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });

  buildHeadingLinks();
  update();

  /** @type {PageNavInstance} */
  const instance = {
    update,
    getHeadings: () => headings,
    rebuild: buildHeadingLinks,
    destroy,
  };

  instances.set(navEl, instance);
  return instance;
}

/**
 * Wire the shared page nav (defaults to `#page-nav`).
 *
 * @param {string} [selector="#page-nav"]
 * @param {PageNavOptions} [options]
 * @returns {PageNavInstance | null}
 */
export function initPageNavPanel(selector = "#page-nav", options = {}) {
  return initPageNav(document.querySelector(selector), options);
}

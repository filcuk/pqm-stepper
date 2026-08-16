/**
 * Browser-side prep for README demo scroll capture (injected by Playwright).
 * Dev-only — lives under scripts/, not app/.
 *
 * Builds an infinite-carousel layout: site chrome removed, `#main` duplicated,
 * scroll distance = one copy so the last frame matches the first when looped.
 * Optionally strips tier/section titles and section subtitles for a continuous
 * section scroll.
 */

export const CAPTURE_STYLE = `
html[data-capture],
html[data-capture] body {
  margin: 0 !important;
  padding: 0 !important;
  scrollbar-width: none;
  overflow-x: hidden;
}

html[data-capture]::-webkit-scrollbar,
html[data-capture] body::-webkit-scrollbar {
  display: none;
}

/* Content-only: no site chrome, no sticky, tight vertical rhythm at the seam. */
html[data-capture] main,
html[data-capture] #main-capture-clone {
  max-width: var(--page-width);
  margin-left: auto;
  margin-right: auto;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding-top: var(--page-padding-y);
  padding-bottom: var(--page-padding-y);
  padding-left: var(--page-padding-x);
  padding-right: var(--page-padding-x);
  width: 100%;
  box-sizing: border-box;
}

html[data-capture] .content-tier-header,
html[data-capture] .section-title {
  position: static !important;
  top: auto !important;
}

html[data-capture] .content-tier-header::before,
html[data-capture] .content-tier-header::after,
html[data-capture] .section-title::before,
html[data-capture] .section-title::after {
  content: none !important;
  display: none !important;
}

/* Continuous sections: one stack, one gap (no leftover tier/main spacing). */
html[data-capture-hide-titles] main,
html[data-capture-hide-titles] #main-capture-clone {
  gap: 0 !important;
}

html[data-capture-hide-titles] .capture-section-stack {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

html[data-capture-hide-titles] .content-section {
  gap: 0 !important;
}

html[data-capture] #main-capture-clone {
  pointer-events: none;
  user-select: none;
}

html[data-capture] #tooltip {
  display: none !important;
}

/* Freeze motion so frames are identical composites (no mid-transition shots). */
html[data-capture],
html[data-capture] * {
  animation: none !important;
  animation-delay: 0s !important;
  animation-duration: 0s !important;
  transition: none !important;
  transition-delay: 0s !important;
  transition-duration: 0s !important;
  scroll-behavior: auto !important;
  caret-color: transparent !important;
}
`;

/** Default matches `APP_CONFIG.themeStorageKey` / demo.html `__MICROAPP__`. */
export const DEFAULT_THEME_STORAGE_KEY = "microapp-theme";

/**
 * Runs before page scripts so sticky chrome never boots and theme is forced.
 * Pass to `context.addInitScript`.
 *
 * @param {{ theme: string, storageKey: string }} opts
 */
export function captureInitScript({ theme, storageKey }) {
  const root = document.documentElement;
  root.removeAttribute("data-sticky-section-headings");
  root.removeAttribute("data-sticky-header");
  if (theme === "light" || theme === "dark") {
    localStorage.setItem(storageKey, theme);
  }
}

/**
 * Runs after demo load (icons painted). Strip chrome, clone `#main` for a
 * seamless carousel loop. Pass to `page.evaluate`.
 *
 * @param {{ loop: boolean, styleText: string, hideTitles?: boolean }} opts
 * @returns {{ scrollBy: number, mainHeight: number }}
 */
export function applyCaptureLayout({ loop, styleText, hideTitles = true }) {
  const root = document.documentElement;
  root.dataset.capture = "";
  if (hideTitles) root.dataset.captureHideTitles = "";
  else delete root.dataset.captureHideTitles;
  root.removeAttribute("data-sticky-section-headings");
  root.removeAttribute("data-sticky-header");
  root.style.removeProperty("--sticky-header-offset");

  document
    .querySelectorAll(
      "[data-sticky-stuck], [data-sticky-stuck-edge], [data-sticky-crumb], [data-sticky-crumb-merged]",
    )
    .forEach((el) => {
      el.removeAttribute("data-sticky-stuck");
      el.removeAttribute("data-sticky-stuck-edge");
      el.removeAttribute("data-sticky-crumb");
      el.removeAttribute("data-sticky-crumb-merged");
    });
  document.querySelectorAll(".content-tier").forEach((tier) => {
    tier.style.removeProperty("--sticky-tier-offset");
  });
  document.querySelectorAll(".content-tier-header").forEach((header) => {
    header.style.removeProperty("--sticky-collapse-reserve");
  });
  document.querySelectorAll(".sticky-crumb").forEach((crumb) => crumb.remove());

  // Remove from the tree (not just hide) so they cannot appear mid-scroll.
  for (const selector of [
    "body > header",
    "#app-page-footer",
    "#page-nav",
    "#skip-to-main",
    "#tooltip",
  ]) {
    document.querySelectorAll(selector).forEach((el) => el.remove());
  }

  if (hideTitles) {
    // Tier headers (e.g. Theme + lead), section titles (e.g. Properties), and
    // section subtitles (direct .panel-hint under .content-section). Panel-level
    // hints stay.
    document
      .querySelectorAll(
        ".content-tier-header, .section-title, .content-section > .panel-hint",
      )
      .forEach((el) => el.remove());
  }

  if (!document.getElementById("capture-mode-style")) {
    const style = document.createElement("style");
    style.id = "capture-mode-style";
    style.textContent = styleText;
    document.head.appendChild(style);
  }

  const main = document.getElementById("main");
  if (!main) return { scrollBy: 0, mainHeight: 0 };

  if (hideTitles) {
    // Lift every content-section into one flex stack so former tier boundaries
    // (Theme → Basic → …) use the same gap as in-tier section pairs.
    const sections = [...main.querySelectorAll(".content-section")];
    if (sections.length > 0) {
      const stack = document.createElement("div");
      stack.className = "capture-section-stack";
      for (const section of sections) {
        stack.appendChild(section);
      }
      main.replaceChildren(stack);
    }
  }

  // Collapse margins so main | clone share a hard seam.
  main.style.marginTop = "0";
  main.style.marginBottom = "0";

  let scrollBy = 0;
  let mainHeight = main.getBoundingClientRect().height;

  if (loop) {
    let clone = document.getElementById("main-capture-clone");
    if (!clone) {
      clone = main.cloneNode(true);
      clone.id = "main-capture-clone";
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("[id]").forEach((el) => {
        el.id = `capture-clone-${el.id}`;
      });
      main.after(clone);
    }
    clone.style.marginTop = "0";
    clone.style.marginBottom = "0";

    // Distance from the top of #main to the top of the clone in document space.
    // Scrolling this far puts the clone (first section again) where #main started.
    const mainTop = main.getBoundingClientRect().top + window.scrollY;
    const cloneTop = clone.getBoundingClientRect().top + window.scrollY;
    scrollBy = cloneTop - mainTop;
    mainHeight = main.getBoundingClientRect().height;
  } else {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    scrollBy = maxScroll;
    mainHeight = main.getBoundingClientRect().height;
  }

  window.scrollTo(0, 0);
  return { scrollBy, mainHeight };
}

/**
 * Pad the seam so the loop distance is a whole multiple of the per-frame scroll
 * step. Frames can then advance by a constant integer pixel count (uniform
 * motion) while the last frame still lands exactly on the clone. Padding is
 * always less than one step, so the seam gap stays visually unchanged.
 *
 * Pass to `page.evaluate` after `applyCaptureLayout`.
 *
 * @param {{ stepPx: number }} opts
 * @returns {{ scrollBy: number, padPx: number }}
 */
export function alignCaptureLoopToStep({ stepPx }) {
  const main = document.getElementById("main");
  const clone = document.getElementById("main-capture-clone");
  const measure = () => {
    if (!main || !clone) return 0;
    const mainTop = main.getBoundingClientRect().top + window.scrollY;
    const cloneTop = clone.getBoundingClientRect().top + window.scrollY;
    return cloneTop - mainTop;
  };

  const scrollBy = measure();
  if (!main || !clone || !(stepPx > 0) || !(scrollBy > 0)) {
    return { scrollBy, padPx: 0 };
  }

  const target = Math.ceil(scrollBy / stepPx) * stepPx;
  const padPx = target - scrollBy;

  let spacer = document.getElementById("capture-loop-spacer");
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.id = "capture-loop-spacer";
    spacer.setAttribute("aria-hidden", "true");
    clone.before(spacer);
  }
  // Padding (not margin) so it cannot collapse into the surrounding blocks.
  spacer.style.height = `${padPx}px`;
  spacer.style.margin = "0";
  spacer.style.padding = "0";

  window.scrollTo(0, 0);
  return { scrollBy: measure(), padPx };
}

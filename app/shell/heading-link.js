import { createIcon } from "../utils/icons.js";
import { copyText } from "../utils/clipboard.js";
import { flashTooltip } from "../components/tooltip.js";

const TOOLTIP_DEFAULT = "Get link";
const TOOLTIP_COPIED = "Copied!";
const ROOT_SKIP_ATTR = "data-no-heading-links";
const HEADING_SKIP_ATTR = "data-no-heading-link";
const DEFAULT_SELECTOR = "main :is(h2, h3)[id]";

function headingUrl(heading) {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#${heading.id}`;
}

/**
 * Whether copy-link buttons should be installed.
 *
 * Explicit `headingLinks` from `initShell` wins. Otherwise the page is enabled
 * unless `<html>` has `data-no-heading-links`.
 *
 * @param {boolean | { enabled?: boolean, selector?: string } | undefined} headingLinks
 * @param {{ noHeadingLinks?: boolean }} [html]
 * @returns {boolean}
 */
export function resolveHeadingLinksEnabled(
  headingLinks,
  { noHeadingLinks = false } = {}
) {
  if (headingLinks === false) return false;
  if (headingLinks === true) return true;
  if (headingLinks && typeof headingLinks === "object" && "enabled" in headingLinks) {
    if (headingLinks.enabled === false) return false;
    if (headingLinks.enabled === true) return true;
  }
  return !noHeadingLinks;
}

/**
 * Add a hover-revealed link icon to section headings; click copies the heading URL.
 *
 * Skip the page with `data-no-heading-links` on `<html>`, `{ enabled: false }`,
 * or `initShell({ headingLinks: false })`. Skip one heading with
 * `data-no-heading-link`.
 *
 * @param {ParentNode} [root=document]
 * @param {{ selector?: string, enabled?: boolean }} [options]
 */
export function initHeadingLinks(root = document, options = {}) {
  const {
    selector = DEFAULT_SELECTOR,
    enabled = !document.documentElement.hasAttribute(ROOT_SKIP_ATTR),
  } = options;
  if (!enabled) return;

  for (const heading of root.querySelectorAll(selector)) {
    if (!(heading instanceof HTMLElement)) continue;
    if (!heading.id) continue;
    if (heading.hasAttribute(HEADING_SKIP_ATTR)) continue;
    if (heading.dataset.headingLink !== undefined) continue;

    heading.classList.add("heading-anchor");
    heading.dataset.headingLink = "";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "heading-link-btn";
    button.dataset.tooltip = TOOLTIP_DEFAULT;
    button.dataset.tooltipPosition = "top";
    button.setAttribute("aria-label", "Copy section link");
    button.append(createIcon("link", { className: "heading-link-icon" }));

    button.addEventListener("click", async () => {
      history.replaceState(null, "", `#${heading.id}`);

      const ok = await copyText(headingUrl(heading));
      flashTooltip(button, {
        text: ok ? TOOLTIP_COPIED : "Copy failed",
        tone: ok ? "success" : "error",
        restoreText: TOOLTIP_DEFAULT,
      });
    });

    heading.append(button);
  }
}

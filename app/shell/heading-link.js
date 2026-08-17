import { createIcon } from "../utils/icons.js";
import { copyText } from "../utils/clipboard.js";
import { flashTooltip } from "../components/tooltip.js";

const TOOLTIP_DEFAULT = "Get link";
const TOOLTIP_COPIED = "Copied!";

function headingUrl(heading) {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#${heading.id}`;
}

/**
 * Add a hover-revealed link icon to section headings; click copies the heading URL.
 *
 * @param {ParentNode} [root=document]
 * @param {{ selector?: string }} [options]
 */
export function initHeadingLinks(
  root = document,
  { selector = "main :is(h2, h3)[id]" } = {}
) {
  for (const heading of root.querySelectorAll(selector)) {
    if (!(heading instanceof HTMLElement)) continue;
    if (!heading.id || heading.dataset.headingLink !== undefined) continue;

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

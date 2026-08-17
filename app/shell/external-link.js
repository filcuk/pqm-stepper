import { createIcon } from "../utils/icons.js";

/**
 * @param {HTMLAnchorElement} anchor
 * @returns {boolean}
 */
function isExternalLink(anchor) {
  if (anchor.dataset.noExternalIcon !== undefined) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
    return false;
  }

  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Append an arrow-outward icon to external `http(s)` links.
 *
 * Skips links with `data-no-external-icon` and links already marked.
 *
 * @param {ParentNode} [root=document]
 */
export function initExternalLinks(root = document) {
  const anchors = root.querySelectorAll("a[href]");

  for (const anchor of anchors) {
    if (!(anchor instanceof HTMLAnchorElement)) continue;
    if (anchor.dataset.externalLinkIcon !== undefined) continue;
    if (!isExternalLink(anchor)) continue;

    anchor.classList.add("external-link");
    anchor.append(createIcon("arrow-outward", { className: "external-link-icon" }));
    anchor.dataset.externalLinkIcon = "";
  }
}

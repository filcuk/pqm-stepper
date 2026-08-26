import { APP_CONFIG } from "../config.js";
import { createIcon } from "../utils/icons.js";
import { initPopupMenu } from "../utils/menu.js";
import {
  alsoSeeHasItems,
  mergeAlsoSeeSections,
  mountAlsoSee,
  normalizeAlsoSee,
} from "./render-shell.js";

/**
 * Drop a failed menu icon; remove the wrap when empty, or show the remaining
 * theme variant in both themes so the slot is not blank.
 *
 * @param {HTMLImageElement} img
 */
function hideBrokenAlsoSeeIcon(img) {
  const wrap = img.closest(".dropdown-menu-item-icon-wrap");
  img.remove();
  if (!wrap) return;

  const remaining = wrap.querySelectorAll("img");
  if (!remaining.length) {
    wrap.remove();
    return;
  }

  remaining.forEach((el) => {
    el.classList.remove("brand-icon--light", "brand-icon--dark");
  });
}

/**
 * Hide also-see icons that 404 (including already-failed cached loads).
 *
 * @param {ParentNode} root
 */
function bindAlsoSeeIconFallback(root) {
  root.querySelectorAll(".dropdown-menu-item-icon").forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.complete && img.naturalWidth === 0) {
      hideBrokenAlsoSeeIcon(img);
      return;
    }
    img.addEventListener("error", () => hideBrokenAlsoSeeIcon(img), {
      once: true,
    });
  });
}

/**
 * @param {ParentNode} [root=document]
 * @returns {ReturnType<typeof initPopupMenu> | null}
 */
function wireAlsoSeeMenu(root = document) {
  const containerEl =
    root.querySelector?.("#footer-also-see") ??
    document.getElementById("footer-also-see");
  if (!containerEl) return null;

  const trigger = containerEl.querySelector(".footer-also-see-trigger");
  const menuEl = containerEl.querySelector(".footer-also-see-menu");
  if (!trigger || !menuEl) return null;

  if (!trigger.querySelector(".external-link-icon")) {
    trigger.classList.add("external-link");
    trigger.append(createIcon("arrow-outward", { className: "external-link-icon" }));
  }

  bindAlsoSeeIconFallback(menuEl);

  const columns = Number.parseInt(menuEl.dataset.alsoSeeColumns ?? "1", 10);
  const gridCols = Number.isFinite(columns) && columns >= 1 ? columns : 1;

  return initPopupMenu({
    containerEl,
    menuEl,
    toggleEl: trigger,
    itemSelector: ".dropdown-menu-item",
    // Fixed so the upward menu is not covered by main content (editors, etc.).
    fixed: true,
    // Shared dropdown grid: one column count for the whole menu (alsoSeeMenuColumns).
    gridMin: gridCols > 1 ? 0 : false,
    gridCols,
    onSelect: ({ item }) => {
      // Plain left-click / keyboard: same window. Middle-click and Ctrl/Cmd-click
      // use the native <a> behaviour (menu.js skips onSelect for those).
      const url =
        (item instanceof HTMLAnchorElement && item.getAttribute("href")) ||
        item.dataset.url;
      if (!url) return;
      window.location.assign(url);
    },
  });
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function fetchAlsoSeeJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`alsoSee fetch failed (${response.status})`);
  }
  return response.json();
}

/**
 * @param {object} [options]
 * @returns {boolean | string[] | null | undefined}
 */
function resolveAlsoSeeTopics(options = {}) {
  if (options.alsoSeeTopics !== undefined) return options.alsoSeeTopics;
  if (APP_CONFIG.alsoSeeTopics !== undefined) return APP_CONFIG.alsoSeeTopics;
  return undefined;
}

/**
 * @param {object} [options]
 * @returns {boolean}
 */
function resolveAlsoSeeIncludeLocal(options = {}) {
  if (typeof options.alsoSeeIncludeLocal === "boolean") {
    return options.alsoSeeIncludeLocal;
  }
  if (typeof APP_CONFIG.alsoSeeIncludeLocal === "boolean") {
    return APP_CONFIG.alsoSeeIncludeLocal;
  }
  return false;
}

/**
 * @param {object} [options]
 * @returns {unknown}
 */
function resolveAlsoSeeLocal(options = {}) {
  if ("alsoSee" in options && options.alsoSee !== undefined) {
    return options.alsoSee;
  }
  return APP_CONFIG.alsoSee;
}

/**
 * @param {ParentNode} root
 * @param {ReturnType<typeof normalizeAlsoSee>} sections
 * @param {ReturnType<typeof initPopupMenu> | null} menuApi
 * @returns {ReturnType<typeof initPopupMenu> | null}
 */
function remountAlsoSee(root, sections, menuApi) {
  menuApi?.destroy?.();
  if (!alsoSeeHasItems(sections)) {
    mountAlsoSee(root, []);
    return null;
  }
  mountAlsoSee(root, sections);
  return wireAlsoSeeMenu(root);
}

/**
 * Wire the footer “also see” dropdown (opens related-app links).
 *
 * Local `alsoSee` is included only when `alsoSeeIncludeLocal` is true (alone
 * if there is no remote URL, or merged with a successful remote fetch).
 * It is never used as a fallback when the remote is missing or fails.
 *
 * @param {ParentNode} [root=document]
 * @param {object} [options]
 * @param {string} [options.alsoSeeUrl]
 * @param {string} [options.appUrl]
 * @param {string[]} [options.alsoSeeTopics] Remote topic filter
 *   (`["*"]` = all; `"-Topic"` excludes; `[]` = none)
 * @param {boolean} [options.alsoSeeIncludeLocal] Include local list
 * @param {false | object[]} [options.alsoSee] Local related-app list
 * @returns {Promise<ReturnType<typeof initPopupMenu> | null>}
 */
export async function initAlsoSee(root = document, options = {}) {
  const alsoSeeUrl =
    typeof options.alsoSeeUrl === "string"
      ? options.alsoSeeUrl.trim()
      : typeof APP_CONFIG.alsoSeeUrl === "string"
        ? APP_CONFIG.alsoSeeUrl.trim()
        : "";
  const appUrl =
    typeof options.appUrl === "string"
      ? options.appUrl.trim()
      : typeof APP_CONFIG.appUrl === "string"
        ? APP_CONFIG.appUrl.trim()
        : "";
  const alsoSeeTopics = resolveAlsoSeeTopics(options);
  const includeLocal = resolveAlsoSeeIncludeLocal(options);
  const localAlsoSee = resolveAlsoSeeLocal(options);
  // Topic filter applies to remote only — local is included in full when enabled.
  const localSections = includeLocal
    ? normalizeAlsoSee(localAlsoSee, appUrl, ["*"])
    : [];

  let menuApi = wireAlsoSeeMenu(root);

  if (!alsoSeeUrl) {
    return remountAlsoSee(root, localSections, menuApi);
  }

  try {
    const data = await fetchAlsoSeeJson(alsoSeeUrl);
    const remoteSections = normalizeAlsoSee(data, appUrl, alsoSeeTopics);
    const sections = includeLocal
      ? mergeAlsoSeeSections(remoteSections, localSections)
      : remoteSections;
    return remountAlsoSee(root, sections, menuApi);
  } catch {
    // Remote failed — keep local only when includeLocal is on (already filtered none).
    return remountAlsoSee(root, localSections, menuApi);
  }
}

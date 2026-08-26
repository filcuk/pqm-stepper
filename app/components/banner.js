import { setHidden, prefersReducedMotion } from "../utils/dom.js";
import { mountIcon } from "../utils/icons.js";

/** @type {WeakMap<HTMLElement, ReturnType<typeof setTimeout>>} */
const expireTimers = new WeakMap();

/** @type {WeakMap<HTMLElement, { ids: string[], byId: Map<string, BannerVariation>, index: number }>} */
const variationState = new WeakMap();

/** @typedef {{ styleClass: string, icon: string, bodyHtml: string }} BannerVariation */

const BANNER_STYLE_CLASSES = [
  "banner-warning",
  "banner-question",
  "banner-error",
  "banner-info",
  "banner-success",
  "banner-tip",
  "banner-note",
  "banner-quote",
  "banner-important",
  "banner-example",
];

function readBannerFadeMs() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--banner-fade-ms")
    .trim();
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : 200;
}

const BANNER_FADE_MS = readBannerFadeMs();

function parseExpireMs(value) {
  if (value === undefined || value === "") return 0;
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function resolveExpireMs(bannerEl, expire) {
  if (expire !== undefined) return parseExpireMs(expire);
  return parseExpireMs(bannerEl.dataset.bannerExpire);
}

function clearExpireProgress(bannerEl) {
  bannerEl.classList.remove("banner-is-expiring");
  bannerEl.style.removeProperty("--banner-expire-ms");
}

function startExpireProgress(bannerEl, ms) {
  clearExpireProgress(bannerEl);
  bannerEl.style.setProperty("--banner-expire-ms", `${ms}ms`);

  if (prefersReducedMotion()) return;

  void bannerEl.offsetWidth;
  requestAnimationFrame(() => {
    bannerEl.classList.add("banner-is-expiring");
  });
}

function clearExpireTimer(bannerEl) {
  const timerId = expireTimers.get(bannerEl);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    expireTimers.delete(bannerEl);
  }
  clearExpireProgress(bannerEl);
}

function resetBannerVisualState(bannerEl) {
  bannerEl.classList.remove("banner-is-hiding");
  bannerEl.style.removeProperty("opacity");
}

function parseVariationIds(bannerEl) {
  const raw = bannerEl.dataset.bannerVariations?.trim();
  if (!raw) return [];
  return raw.split(/[\s,]+/).filter(Boolean);
}

function readCurrentStyleClass(bannerEl) {
  return BANNER_STYLE_CLASSES.find((className) => bannerEl.classList.contains(className)) || "";
}

function snapshotPrimaryVariation(bannerEl) {
  const iconEl = bannerEl.querySelector(".banner-icon");
  const bodyEl = bannerEl.querySelector(".banner-body");
  return {
    styleClass: readCurrentStyleClass(bannerEl),
    icon: iconEl?.dataset.icon || "",
    bodyHtml: bodyEl?.innerHTML || "",
  };
}

function readSourceVariation(sourceEl) {
  const iconEl = sourceEl.querySelector("[data-banner-variation-icon]");
  const bodyEl = sourceEl.querySelector("[data-banner-variation-body]");
  return {
    styleClass: sourceEl.dataset.bannerClass || "",
    icon: iconEl?.dataset.bannerVariationIcon || iconEl?.textContent?.trim() || "",
    bodyHtml: bodyEl?.innerHTML || "",
  };
}

function ensureVariationState(bannerEl) {
  let state = variationState.get(bannerEl);
  if (state) return state;

  const ids = parseVariationIds(bannerEl);
  const byId = new Map();

  if (ids.length > 0) {
    byId.set(ids[0], snapshotPrimaryVariation(bannerEl));
    bannerEl.querySelectorAll("[data-banner-variation]").forEach((sourceEl) => {
      const id = sourceEl.dataset.bannerVariation;
      if (!id || byId.has(id)) return;
      byId.set(id, readSourceVariation(sourceEl));
    });
  }

  state = { ids, byId, index: 0 };
  variationState.set(bannerEl, state);
  return state;
}

function applyBannerStyleClass(bannerEl, styleClass) {
  for (const className of BANNER_STYLE_CLASSES) {
    bannerEl.classList.toggle(className, className === styleClass);
  }
}

function applyBannerVariationContent(bannerEl, variation) {
  applyBannerStyleClass(bannerEl, variation.styleClass);

  const iconHost = bannerEl.querySelector(".banner-icon");
  if (iconHost && variation.icon) {
    iconHost.dataset.icon = variation.icon;
    mountIcon(iconHost, variation.icon, {
      className: iconHost.dataset.iconClass || "",
    });
  }

  const bodyEl = bannerEl.querySelector(".banner-body");
  if (bodyEl) {
    bodyEl.innerHTML = variation.bodyHtml;
  }
}

/**
 * Show a specific banner variation by id.
 *
 * @param {HTMLElement | null} bannerEl
 * @param {string} variationId
 */
export function setBannerVariation(bannerEl, variationId) {
  if (!bannerEl) return;

  const state = ensureVariationState(bannerEl);
  const variation = state.byId.get(variationId);
  if (!variation) return;

  const index = state.ids.indexOf(variationId);
  if (index >= 0) state.index = index;

  applyBannerVariationContent(bannerEl, variation);
}

function advanceBannerVariation(bannerEl) {
  const state = ensureVariationState(bannerEl);
  if (state.ids.length < 2) return;

  state.index = (state.index + 1) % state.ids.length;
  setBannerVariation(bannerEl, state.ids[state.index]);
}

function shouldRotateOnExpire(bannerEl) {
  if (!bannerEl.hasAttribute("data-banner-rotate")) return false;
  const state = ensureVariationState(bannerEl);
  return state.ids.length >= 2;
}

function scheduleExpire(bannerEl, ms, expireOverride) {
  clearExpireTimer(bannerEl);
  startExpireProgress(bannerEl, ms);

  expireTimers.set(
    bannerEl,
    setTimeout(() => {
      if (shouldRotateOnExpire(bannerEl)) {
        clearExpireProgress(bannerEl);
        advanceBannerVariation(bannerEl);
        showBanner(bannerEl, { expire: expireOverride });
        return;
      }
      fadeOutBanner(bannerEl);
    }, ms)
  );
}

function fadeOutBanner(bannerEl) {
  expireTimers.delete(bannerEl);
  clearExpireProgress(bannerEl);

  if (prefersReducedMotion()) {
    hideBanner(bannerEl);
    return;
  }

  bannerEl.classList.add("banner-is-hiding");

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    bannerEl.removeEventListener("animationend", onAnimationEnd);
    hideBanner(bannerEl);
  };

  const onAnimationEnd = (event) => {
    if (event.target !== bannerEl) return;
    finish();
  };

  bannerEl.addEventListener("animationend", onAnimationEnd);
  window.setTimeout(finish, BANNER_FADE_MS + 50);
}

/** Hide a banner and cancel any pending expiry. */
export function hideBanner(bannerEl) {
  if (!bannerEl) return;
  clearExpireTimer(bannerEl);
  resetBannerVisualState(bannerEl);

  const state = variationState.get(bannerEl);
  if (state && state.ids.length > 0) {
    state.index = 0;
    setBannerVariation(bannerEl, state.ids[0]);
  }

  setHidden(bannerEl, true);
}

/**
 * Show a banner. Auto-hides when `expire` is set (ms) or `data-banner-expire` is on the element.
 * With `data-banner-rotate` and multiple `data-banner-variations`, expiry advances instead of hiding.
 * `hideBanner()` resets the variation index to the first id (next show starts at the first slide).
 *
 * @param {HTMLElement | null} bannerEl
 * @param {{ expire?: number | string }} [options]
 */
export function showBanner(bannerEl, { expire } = {}) {
  if (!bannerEl) return;

  ensureVariationState(bannerEl);
  clearExpireTimer(bannerEl);
  resetBannerVisualState(bannerEl);
  setHidden(bannerEl, false);

  const ms = resolveExpireMs(bannerEl, expire);
  if (ms <= 0) return;

  scheduleExpire(bannerEl, ms, expire);
}

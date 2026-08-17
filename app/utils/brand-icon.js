/**
 * App logo / favicon paths.
 *
 * Pair mode (default): set `light` + `dark` (e.g. app-light.svg / app-dark.svg).
 * Single mode: set `icon` (e.g. app.svg) and clear `light` / `dark`.
 *
 * Optional overrides via `window.__MICROAPP__`: `appIcon`, `appIconLight`, `appIconDark`
 * (needed for correct favicon before modules load — see `theme-init.js`).
 */
export const APP_ICON_SRC = {
  icon: "",
  light: "app/res/app-light.svg",
  dark: "app/res/app-dark.svg",
};

/**
 * @param {object | null | undefined} microapp
 * @param {{ icon: string, light: string, dark: string }} defaults
 * @returns {{ icon: string, light: string, dark: string }}
 */
export function readAppIconConfig(microapp, defaults = APP_ICON_SRC) {
  const m = microapp && typeof microapp === "object" ? microapp : {};
  const pick = (key, fallback) => {
    if (Object.prototype.hasOwnProperty.call(m, key) && typeof m[key] === "string") {
      return m[key].trim();
    }
    return typeof fallback === "string" ? fallback.trim() : "";
  };

  return {
    icon: pick("appIcon", defaults.icon),
    light: pick("appIconLight", defaults.light),
    dark: pick("appIconDark", defaults.dark),
  };
}

/**
 * @param {{ icon: string, light: string, dark: string }} config
 * @returns
 *   | { mode: "pair", light: string, dark: string }
 *   | { mode: "single", icon: string }
 */
export function resolveAppIconSources(config) {
  const icon = typeof config?.icon === "string" ? config.icon.trim() : "";
  const light = typeof config?.light === "string" ? config.light.trim() : "";
  const dark = typeof config?.dark === "string" ? config.dark.trim() : "";

  if (light || dark) {
    return { mode: "pair", light: light || dark, dark: dark || light };
  }

  return { mode: "single", icon: icon || "app/res/app.svg" };
}

function currentAppIconConfig() {
  const microapp =
    typeof window !== "undefined" ? window.__MICROAPP__ : undefined;
  return readAppIconConfig(microapp, APP_ICON_SRC);
}

/**
 * @param {"light" | "dark" | string | undefined} theme
 * @returns {string}
 */
export function appIconSrc(theme = document.documentElement.dataset.theme) {
  const resolved = resolveAppIconSources(currentAppIconConfig());
  if (resolved.mode === "single") return resolved.icon;
  return theme === "dark" ? resolved.dark : resolved.light;
}

/** Update favicon and any `[data-brand-icon]` image or link. */
export function syncBrandIcons(theme) {
  const src = appIconSrc(theme);
  document.querySelectorAll("[data-brand-icon]").forEach((el) => {
    if (el instanceof HTMLLinkElement) el.href = src;
    else if (el instanceof HTMLImageElement) el.src = src;
  });
}

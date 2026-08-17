(function () {
  var microapp = window.__MICROAPP__ || {};
  var storageKey = microapp.themeStorageKey || "microapp-theme";
  var preference = localStorage.getItem(storageKey);
  if (preference !== "light" && preference !== "dark" && preference !== "auto") {
    preference = "auto";
  }

  var dark =
    preference === "dark" ||
    (preference === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePreference = preference;

  // Keep defaults in sync with app/utils/brand-icon.js `APP_ICON_SRC`.
  function pick(key, fallback) {
    if (Object.prototype.hasOwnProperty.call(microapp, key) && typeof microapp[key] === "string") {
      return microapp[key].trim();
    }
    return fallback;
  }

  var icon = pick("appIcon", "");
  var light = pick("appIconLight", "app/res/app-light.svg");
  var darkIcon = pick("appIconDark", "app/res/app-dark.svg");
  var href;
  if (light || darkIcon) {
    href = dark ? darkIcon || light : light || darkIcon;
  } else {
    href = icon || "app/res/app.svg";
  }

  var iconLink = document.querySelector("link[data-brand-icon]");
  if (iconLink) {
    iconLink.href = href;
  }
})();

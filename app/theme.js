const STORAGE_KEY = "pqm-theme";
const MODES = ["auto", "light", "dark"];

function getStoredPreference() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return MODES.includes(stored) ? stored : "auto";
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(preference = getStoredPreference()) {
  if (preference === "auto") return getSystemTheme();
  return preference;
}

function updatePrismTheme(resolvedTheme) {
  const lightLink = document.getElementById("prism-light");
  const darkLink = document.getElementById("prism-dark");
  if (!lightLink || !darkLink) return;

  lightLink.disabled = resolvedTheme !== "light";
  darkLink.disabled = resolvedTheme !== "dark";
}

function applyTheme(preference = getStoredPreference()) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  updatePrismTheme(resolved);
  document.dispatchEvent(
    new CustomEvent("pqm-theme-change", {
      detail: { preference, resolved },
    })
  );
}

function setThemePreference(preference) {
  localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
  syncThemeToggle(preference);
}

function syncThemeToggle(preference) {
  document.querySelectorAll("[data-theme-mode]").forEach((button) => {
    const active = button.dataset.themeMode === preference;
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

export function initThemeToggle(container) {
  container.querySelectorAll("[data-theme-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setThemePreference(button.dataset.themeMode);
    });
  });

  syncThemeToggle(getStoredPreference());

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getStoredPreference() === "auto") {
        applyTheme("auto");
      }
    });
}

export function initTheme() {
  applyTheme(getStoredPreference());
}

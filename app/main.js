import { APP_CONFIG } from "./config.js";
import { initShell } from "./shell/shell.js";
import { mountIcon } from "./utils/icons.js";
import { initCombo } from "./components/combo.js";
import { initToggleButton } from "./components/toggle-button.js";
import { initAboutDialog } from "./components/about-dialog.js";
import { transform } from "./transform.js";
import { renderHighlighted } from "./highlight.js";
import {
  fetchExample,
  fetchExampleManifest,
  pickRandomExample,
} from "./examples.js";
import {
  saveCaretOffset,
  getSelectionOffsets,
  restoreCaretOffset,
  readPlainText,
  selectElementContents,
  lineNumbersText,
} from "./editor.js";
import {
  getMappingForTransform,
  loadDefaultMapping,
  resolveMappingState,
  wasStoredMappingInvalid,
} from "./mapping-store.js";
import {
  initMappingDialog,
  resetMappingToDefault,
  refreshMappingEditorAvailability,
} from "./mapping-dialog.js";

initShell();

const inputEl = document.getElementById("input");
const inputGutterEl = document.getElementById("input-gutter");
const outputHighlightEl = document.getElementById("output-highlight");
const outputGutterEl = document.getElementById("output-gutter");
const exampleCombo = document.getElementById("example-combo");
const exampleBtn = document.getElementById("example-btn");
const exampleMenuBtn = document.getElementById("example-menu-btn");
const exampleMenu = document.getElementById("example-menu");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const bannerEl = document.getElementById("banner");
const bannerIconEl = document.getElementById("banner-icon");
const bannerBodyEl = document.getElementById("banner-body");
const mappingBannerEl = document.getElementById("mapping-banner");
const mappingBannerTextEl = document.getElementById("mapping-banner-text");
const mappingResetBannerBtn = document.getElementById("mapping-reset-banner-btn");

const BANNER_ICONS = {
  warning: "warning",
  error: "error",
  info: "info",
  success: "success",
  note: "note",
  important: "important",
};
const stepHighlightToggle = document.getElementById("step-highlight-toggle");
const stepHighlightLegend = document.getElementById("step-highlight-legend");
const syntaxHighlightToggle = document.getElementById("syntax-highlight-toggle");
const verboseNamesToggle = document.getElementById("verbose-names-toggle");
const alwaysNumberToggle = document.getElementById("always-number-toggle");

const STEP_HIGHLIGHT_STORAGE_KEY = "pqm-step-highlight";
const SYNTAX_HIGHLIGHT_STORAGE_KEY = "pqm-syntax-highlight";
const VERBOSE_NAMES_STORAGE_KEY = "pqm-verbose-names";
const ALWAYS_NUMBER_STORAGE_KEY = "pqm-always-number";

let mapping = {};
let mappingState = null;
let examples = [];
let lastLoadedExampleFile = null;
let lastRenames = null;
let inputText = "";
let outputText = "";
let isComposing = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let inputEditTimer = null;
const INPUT_EDIT_DEBOUNCE_MS = 75;

function getStepHighlightEnabled() {
  const stored = localStorage.getItem(STEP_HIGHLIGHT_STORAGE_KEY);
  return stored !== "false";
}

function getSyntaxHighlightEnabled() {
  const stored = localStorage.getItem(SYNTAX_HIGHLIGHT_STORAGE_KEY);
  return stored !== "false";
}

function getVerboseNamesEnabled() {
  const stored = localStorage.getItem(VERBOSE_NAMES_STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}

function getAlwaysNumberEnabled() {
  return localStorage.getItem(ALWAYS_NUMBER_STORAGE_KEY) === "true";
}

let stepHighlightEnabled = getStepHighlightEnabled();
let syntaxHighlightEnabled = getSyntaxHighlightEnabled();
let verboseNamesEnabled = getVerboseNamesEnabled();
let alwaysNumberEnabled = getAlwaysNumberEnabled();

function getTransformOptions() {
  return {
    namingMode: verboseNamesEnabled ? "verbose" : "numbered",
    alwaysNumber: alwaysNumberEnabled,
  };
}

function getHighlightOptions() {
  return {
    stepHighlightEnabled,
    syntaxHighlightEnabled,
  };
}

function syncMappingVersionBanner() {
  if (!mappingState?.isCustom) {
    mappingBannerEl.classList.add("hidden");
    mappingBannerTextEl.textContent = "";
    return;
  }

  const storedLabel = mappingState.storedVersion
    ? `v${mappingState.storedVersion}`
    : "undefined";

  if (mappingState.isOutdated) {
    mappingBannerTextEl.textContent = `Your mapping (${storedLabel}) is older than the current (v${mappingState.currentVersion}).`;
    mappingBannerEl.classList.remove("hidden");
    return;
  }

  if (mappingState.isFuture) {
    mappingBannerTextEl.textContent = `Your mapping (${storedLabel}) is newer than the current (v${mappingState.currentVersion}).`;
    mappingBannerEl.classList.remove("hidden");
    return;
  }

  mappingBannerEl.classList.add("hidden");
  mappingBannerTextEl.textContent = "";
}

function refreshMappingState() {
  mappingState = resolveMappingState();
  syncMappingVersionBanner();
}

function showBanner(messages, type = "warning") {
  if (!messages.length) {
    bannerEl.classList.add("hidden");
    bannerBodyEl.textContent = "";
    return;
  }

  const iconName = BANNER_ICONS[type] ?? "warning";
  bannerEl.className = `banner banner-${type}`;
  bannerEl.setAttribute("role", type === "error" ? "alert" : "status");
  bannerIconEl.dataset.icon = iconName;
  mountIcon(bannerIconEl, iconName, { className: "banner-icon-svg" });
  bannerBodyEl.textContent = messages.join(" ");
  bannerEl.classList.remove("hidden");
}

function filterLiveWarnings(warnings, text) {
  if (!text.trim()) return [];
  const complete = /\blet\b/i.test(text) && /\bin\b/i.test(text);
  return warnings.filter((w) => {
    if (w.includes("collision")) return true;
    if (!complete) return false;
    if (w === "Input is empty.") return false;
    return true;
  });
}

function updateInputDisplay(caret) {
  inputGutterEl.textContent = lineNumbersText(inputText);

  if (!inputText) {
    inputEl.innerHTML = "";
    inputEl.classList.add("is-empty");
    return;
  }

  inputEl.classList.remove("is-empty");
  inputEl.innerHTML = renderHighlighted(
    inputText,
    "input",
    lastRenames,
    getHighlightOptions()
  );

  if (caret !== undefined) {
    restoreCaretOffset(inputEl, caret);
  }
}

function updateOutputHighlight() {
  outputGutterEl.textContent = lineNumbersText(outputText);

  if (!outputText) {
    outputHighlightEl.textContent = "";
    outputHighlightEl.classList.add("is-empty");
    return;
  }

  outputHighlightEl.classList.remove("is-empty");
  outputHighlightEl.innerHTML = renderHighlighted(
    outputText,
    "output",
    lastRenames,
    getHighlightOptions()
  );
}

function runTransform(caret) {
  const result = transform(
    inputText,
    getMappingForTransform(mapping),
    getTransformOptions()
  );
  lastRenames = result.renames;
  outputText = result.output;
  copyBtn.disabled = !outputText;

  if (caret === undefined && document.activeElement === inputEl) {
    caret = saveCaretOffset(inputEl);
  }

  updateInputDisplay(caret);
  updateOutputHighlight();

  const warnings = filterLiveWarnings(result.warnings, inputText);
  showBanner(
    warnings,
    warnings.some((w) => w.includes("collision")) ? "error" : "warning"
  );
}

function cancelPendingInputEdit() {
  if (inputEditTimer !== null) {
    clearTimeout(inputEditTimer);
    inputEditTimer = null;
  }
}

function handleInputEdit() {
  const caret = saveCaretOffset(inputEl);
  inputText = readPlainText(inputEl);
  cancelPendingInputEdit();
  inputEditTimer = setTimeout(() => {
    inputEditTimer = null;
    runTransform(
      document.activeElement === inputEl ? saveCaretOffset(inputEl) : caret
    );
  }, INPUT_EDIT_DEBOUNCE_MS);
}

function runTransformNow(caret) {
  cancelPendingInputEdit();
  runTransform(caret);
}

function setInputText(text, caret) {
  cancelPendingInputEdit();
  inputText = text;
  runTransform(caret ?? text.length);
}

function rerunFromToggle() {
  if (document.activeElement === inputEl) {
    inputText = readPlainText(inputEl);
  }
  runTransformNow(
    document.activeElement === inputEl ? saveCaretOffset(inputEl) : undefined
  );
}

async function loadMapping() {
  try {
    await loadDefaultMapping();
    refreshMappingState();
    mapping = mappingState.mapping;

    if (wasStoredMappingInvalid()) {
      showBanner(
        ["Stored mapping was invalid and has been ignored. Using default mapping."],
        "warning"
      );
    }

    runTransform(0);
    return true;
  } catch (err) {
    showBanner(
      [
        `Could not load mapping.json: ${err.message}. Run from a local server or deploy to GitHub Pages.`,
      ],
      "error"
    );
    return false;
  }
}

function setMapping(nextMapping) {
  mapping = nextMapping;
  refreshMappingState();
  if (document.activeElement === inputEl) {
    inputText = readPlainText(inputEl);
  }
  const caret =
    document.activeElement === inputEl ? saveCaretOffset(inputEl) : undefined;
  runTransformNow(caret);
}

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(outputText);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy output";
    }, 1500);
  } catch {
    selectElementContents(outputHighlightEl);
    document.execCommand("copy");
    window.getSelection()?.removeAllRanges();
  }
}

copyBtn.addEventListener("click", copyOutput);

outputHighlightEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
    e.preventDefault();
    if (outputText) {
      selectElementContents(outputHighlightEl);
    }
  }
});

function refreshHighlights() {
  const caret =
    document.activeElement === inputEl ? saveCaretOffset(inputEl) : undefined;
  updateInputDisplay(caret);
  updateOutputHighlight();
}

/* Toolbar toggles — template toggle-button drives aria-pressed; the app keeps
   inline glyph SVGs, storage, and dynamic tooltip / aria-label copy. */

initToggleButton(stepHighlightToggle, {
  defaultPressed: stepHighlightEnabled,
  onChange: ({ pressed, source }) => {
    stepHighlightEnabled = pressed;
    localStorage.setItem(STEP_HIGHLIGHT_STORAGE_KEY, pressed ? "true" : "false");
    stepHighlightLegend.classList.toggle("is-disabled", !pressed);
    if (source !== "init") refreshHighlights();
  },
});

initToggleButton(syntaxHighlightToggle, {
  defaultPressed: syntaxHighlightEnabled,
  onChange: ({ pressed, source }) => {
    syntaxHighlightEnabled = pressed;
    localStorage.setItem(SYNTAX_HIGHLIGHT_STORAGE_KEY, pressed ? "true" : "false");
    if (source !== "init") refreshHighlights();
  },
});

initToggleButton(verboseNamesToggle, {
  defaultPressed: verboseNamesEnabled,
  onChange: ({ pressed, source }) => {
    verboseNamesEnabled = pressed;
    localStorage.setItem(VERBOSE_NAMES_STORAGE_KEY, pressed ? "true" : "false");
    verboseNamesToggle.setAttribute(
      "aria-label",
      pressed ? "Verbose steps" : "Simple steps"
    );
    verboseNamesToggle.dataset.tooltip = pressed
      ? "Verbose steps"
      : "Simple steps";
    if (source !== "init") rerunFromToggle();
  },
});

initToggleButton(alwaysNumberToggle, {
  defaultPressed: alwaysNumberEnabled,
  onChange: ({ pressed, source }) => {
    alwaysNumberEnabled = pressed;
    localStorage.setItem(ALWAYS_NUMBER_STORAGE_KEY, pressed ? "true" : "false");
    alwaysNumberToggle.setAttribute(
      "aria-label",
      pressed ? "Number repeated steps" : "Always number steps"
    );
    alwaysNumberToggle.dataset.tooltip = pressed
      ? "Always number steps"
      : "Number repeated steps";
    if (source !== "init") rerunFromToggle();
  },
});

/* Examples — template combo (split button + popup menu) */

function setExampleControlsEnabled(enabled) {
  exampleBtn.disabled = !enabled;
  exampleMenuBtn.disabled = !enabled;
}

function renderExampleMenu() {
  exampleMenu.replaceChildren(
    ...examples.map(({ file, label }) => {
      const item = document.createElement("li");
      item.setAttribute("role", "none");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "combo-menu-item";
      button.setAttribute("role", "menuitem");
      button.dataset.value = file;
      button.textContent = label;

      item.appendChild(button);
      return item;
    })
  );
}

async function loadExampleByName(filename) {
  try {
    const text = await fetchExample(filename);
    lastLoadedExampleFile = filename;
    setInputText(text);
    inputEl.focus();
  } catch (err) {
    showBanner([`Could not load example "${filename}": ${err.message}.`], "error");
  }
}

async function loadRandomExample() {
  const example = pickRandomExample(examples, lastLoadedExampleFile);
  if (!example) return;
  await loadExampleByName(example.file);
}

async function loadExamples() {
  try {
    examples = await fetchExampleManifest();
    renderExampleMenu();
    setExampleControlsEnabled(examples.length > 0);
    if (!examples.length) {
      showBanner(["No examples found in examples/."], "warning");
    }
  } catch (err) {
    setExampleControlsEnabled(false);
    showBanner([`Could not load examples: ${err.message}.`], "error");
  }
}

initCombo(exampleCombo, {
  onMainClick: () => {
    loadRandomExample();
  },
  onSelect: ({ value }) => {
    if (value) loadExampleByName(value);
  },
});

clearBtn.addEventListener("click", () => {
  setInputText("");
  inputEl.focus();
});

inputEl.closest(".code-editor")?.addEventListener("click", (e) => {
  if (inputEl.contains(e.target)) return;
  inputEl.focus();
});

inputEl.addEventListener("compositionstart", () => {
  isComposing = true;
});

inputEl.addEventListener("compositionend", () => {
  isComposing = false;
  const caret = saveCaretOffset(inputEl);
  inputText = readPlainText(inputEl);
  runTransformNow(caret);
});

inputEl.addEventListener("input", () => {
  if (isComposing) return;
  handleInputEdit();
});

inputEl.addEventListener("paste", (e) => {
  e.preventDefault();
  cancelPendingInputEdit();
  inputText = readPlainText(inputEl);
  const pasted = e.clipboardData.getData("text/plain");
  const { start, end } = getSelectionOffsets(inputEl);
  inputText = inputText.slice(0, start) + pasted + inputText.slice(end);
  runTransformNow(start + pasted.length);
});

mappingResetBannerBtn.addEventListener("click", () => {
  resetMappingToDefault();
});

/* Prism stylesheet swap follows the shell theme (shell owns tokens/chrome;
   the vendored Prism themes are app-owned). */
function updatePrismTheme(resolvedTheme) {
  const lightLink = document.getElementById("prism-light");
  const darkLink = document.getElementById("prism-dark");
  if (!lightLink || !darkLink) return;

  lightLink.disabled = resolvedTheme !== "light";
  darkLink.disabled = resolvedTheme !== "dark";
}

document.addEventListener(APP_CONFIG.themeChangeEvent, (e) => {
  updatePrismTheme(
    e.detail?.resolved ?? document.documentElement.dataset.theme
  );
  refreshHighlights();
});
updatePrismTheme(document.documentElement.dataset.theme);

initMappingDialog({
  onMappingChange: setMapping,
  onMappingReset: refreshMappingState,
});
loadMapping().then(() => {
  refreshMappingEditorAvailability();
});
initAboutDialog({
  dialogEl: document.getElementById("about-dialog"),
  openTriggers: [document.getElementById("about-open-btn")],
});
loadExamples();

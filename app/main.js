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
import { initIcons, mountIcon } from "./icons.js";
import { initTooltips } from "./tooltip.js";
import { initTheme, initThemeToggle } from "./theme.js";
import {
  getMappingForTransform,
  loadDefaultMapping,
  resolveMappingState,
  wasStoredMappingInvalid,
} from "./mapping-store.js";
import {
  initMappingDialog,
  isMappingDialogOpen,
  resetMappingToDefault,
  refreshMappingEditorAvailability,
} from "./mapping-dialog.js";
import { initAboutDialog, isAboutDialogOpen } from "./about-dialog.js";

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
let exampleMenuOpen = false;
let lastRenames = null;
let inputText = "";
let outputText = "";
let isComposing = false;

function getStepHighlightEnabled() {
  const stored = localStorage.getItem(STEP_HIGHLIGHT_STORAGE_KEY);
  return stored !== "false";
}

function setStepHighlightEnabled(enabled) {
  localStorage.setItem(STEP_HIGHLIGHT_STORAGE_KEY, enabled ? "true" : "false");
  stepHighlightToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  stepHighlightLegend.classList.toggle("is-disabled", !enabled);
}

function getSyntaxHighlightEnabled() {
  const stored = localStorage.getItem(SYNTAX_HIGHLIGHT_STORAGE_KEY);
  return stored !== "false";
}

function setSyntaxHighlightEnabled(enabled) {
  localStorage.setItem(SYNTAX_HIGHLIGHT_STORAGE_KEY, enabled ? "true" : "false");
  syntaxHighlightToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
}

function getVerboseNamesEnabled() {
  const stored = localStorage.getItem(VERBOSE_NAMES_STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}

function setVerboseNamesEnabled(enabled) {
  localStorage.setItem(VERBOSE_NAMES_STORAGE_KEY, enabled ? "true" : "false");
  verboseNamesToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  verboseNamesToggle.setAttribute(
    "aria-label",
    enabled ? "Verbose steps" : "Simple steps"
  );
  verboseNamesToggle.dataset.tooltip = enabled
    ? "Verbose steps"
    : "Simple steps";
}

function getAlwaysNumberEnabled() {
  return localStorage.getItem(ALWAYS_NUMBER_STORAGE_KEY) === "true";
}

function setAlwaysNumberEnabled(enabled) {
  localStorage.setItem(ALWAYS_NUMBER_STORAGE_KEY, enabled ? "true" : "false");
  alwaysNumberToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  alwaysNumberToggle.setAttribute(
    "aria-label",
    enabled ? "Number repeated steps" : "Always number steps"
  );
  alwaysNumberToggle.dataset.tooltip = enabled
    ? "Always number steps"
    : "Number repeated steps";
}

function getTransformOptions() {
  return {
    namingMode: getVerboseNamesEnabled() ? "verbose" : "numbered",
    alwaysNumber: getAlwaysNumberEnabled(),
  };
}

function getHighlightOptions() {
  return {
    stepHighlightEnabled: getStepHighlightEnabled(),
    syntaxHighlightEnabled: getSyntaxHighlightEnabled(),
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

function handleInputEdit() {
  const caret = saveCaretOffset(inputEl);
  inputText = readPlainText(inputEl);
  runTransform(caret);
}

function setInputText(text, caret) {
  inputText = text;
  runTransform(caret ?? text.length);
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
  const caret =
    document.activeElement === inputEl ? saveCaretOffset(inputEl) : undefined;
  runTransform(caret);
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

setStepHighlightEnabled(getStepHighlightEnabled());
setSyntaxHighlightEnabled(getSyntaxHighlightEnabled());
setVerboseNamesEnabled(getVerboseNamesEnabled());
setAlwaysNumberEnabled(getAlwaysNumberEnabled());

function refreshHighlights() {
  const caret =
    document.activeElement === inputEl ? saveCaretOffset(inputEl) : undefined;
  updateInputDisplay(caret);
  updateOutputHighlight();
}

stepHighlightToggle.addEventListener("click", () => {
  const enabled = stepHighlightToggle.getAttribute("aria-pressed") !== "true";
  setStepHighlightEnabled(enabled);
  refreshHighlights();
});

syntaxHighlightToggle.addEventListener("click", () => {
  const enabled = syntaxHighlightToggle.getAttribute("aria-pressed") !== "true";
  setSyntaxHighlightEnabled(enabled);
  refreshHighlights();
});

verboseNamesToggle.addEventListener("click", () => {
  const enabled = verboseNamesToggle.getAttribute("aria-pressed") !== "true";
  setVerboseNamesEnabled(enabled);
  runTransform();
});

alwaysNumberToggle.addEventListener("click", () => {
  const enabled = alwaysNumberToggle.getAttribute("aria-pressed") !== "true";
  setAlwaysNumberEnabled(enabled);
  runTransform();
});

function setExampleControlsEnabled(enabled) {
  exampleBtn.disabled = !enabled;
  exampleMenuBtn.disabled = !enabled;
}

function closeExampleMenu() {
  if (!exampleMenuOpen) return;
  exampleMenuOpen = false;
  exampleMenu.classList.add("hidden");
  exampleMenuBtn.setAttribute("aria-expanded", "false");
}

function openExampleMenu() {
  if (!examples.length) return;
  exampleMenuOpen = true;
  exampleMenu.classList.remove("hidden");
  exampleMenuBtn.setAttribute("aria-expanded", "true");
}

function toggleExampleMenu() {
  if (exampleMenuOpen) {
    closeExampleMenu();
  } else {
    openExampleMenu();
  }
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
      button.textContent = label;
      button.addEventListener("click", () => {
        closeExampleMenu();
        loadExampleByName(file);
      });

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

exampleBtn.addEventListener("click", () => {
  loadRandomExample();
});

exampleMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleExampleMenu();
});

document.addEventListener("click", (e) => {
  if (!exampleCombo.contains(e.target)) {
    closeExampleMenu();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (isMappingDialogOpen() || isAboutDialogOpen()) return;
    closeExampleMenu();
  }
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
  handleInputEdit();
});

inputEl.addEventListener("input", () => {
  if (isComposing) return;
  handleInputEdit();
});

inputEl.addEventListener("paste", (e) => {
  e.preventDefault();
  const pasted = e.clipboardData.getData("text/plain");
  const { start, end } = getSelectionOffsets(inputEl);
  inputText = inputText.slice(0, start) + pasted + inputText.slice(end);
  runTransform(start + pasted.length);
});

mappingResetBannerBtn.addEventListener("click", () => {
  resetMappingToDefault();
});

initMappingDialog({
  onMappingChange: setMapping,
  onMappingReset: refreshMappingState,
});
loadMapping().then(() => {
  refreshMappingEditorAvailability();
});
initAboutDialog();
loadExamples();
initIcons();
initTooltips();
initTheme();
initThemeToggle(document.getElementById("theme-toggle"));

document.addEventListener("pqm-theme-change", refreshHighlights);

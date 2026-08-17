import { APP_CONFIG } from "./config.js";
import { initShell } from "./shell/shell.js";
import { mountIcon } from "./utils/icons.js";
import { initCombo } from "./components/combo.js";
import { initToggleButton } from "./components/toggle-button.js";
import { initAboutDialog } from "./components/about-dialog.js";
import { initCodeBlock } from "./components/code-block.js";
import { initTutorial } from "./components/tutorial.js";
import { transform } from "./transform.js";
import { renderHighlighted } from "./highlight.js";
import {
  fetchExample,
  fetchExampleManifest,
  pickRandomExample,
} from "./examples.js";
import { selectElementContents } from "./editor.js";
import {
  getMappingForTransform,
  loadDefaultMapping,
  resolveMappingState,
  wasStoredMappingInvalid,
} from "./mapping-store.js";
import {
  initMappingDialog,
  requestMappingReset,
  refreshMappingEditorAvailability,
} from "./mapping-dialog.js";
import { initPageNavPanel } from "./shell/page-nav.js";

initShell();

/* This tool is a single-viewport editor — hide the shell’s floating page-nav
   jumps (and heading strip) rather than leaving them over the code panes. */
initPageNavPanel()?.destroy();
document.getElementById("page-nav")?.remove();

const inputCodeBlockEl = document.getElementById("input-code-block");
const outputCodeBlockEl = document.getElementById("output-code-block");
const inputCodeBlock = initCodeBlock(inputCodeBlockEl);
const outputCodeBlock = initCodeBlock(outputCodeBlockEl);
const inputEl = inputCodeBlockEl.querySelector(".code-block-editor");
const inputHighlightEl = document.getElementById("input-highlight");
const outputHighlightEl = document.getElementById("output-highlight");
const outputPreEl = outputHighlightEl.closest("pre");
inputEl.placeholder = "let\n    Source = ...\nin\n    ...";
outputHighlightEl.dataset.placeholder =
  "Transformed code appears here";
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
  if (inputCodeBlock.getSource() !== inputText) {
    inputCodeBlock.setSource(inputText);
  }
  inputHighlightEl.innerHTML = inputText
    ? renderHighlighted(inputText, "input", lastRenames, getHighlightOptions())
    : "";

  if (caret !== undefined) {
    inputEl.setSelectionRange(caret, caret);
  }
}

function updateOutputHighlight() {
  outputCodeBlock.setSource(outputText);
  outputHighlightEl.classList.toggle("is-empty", !outputText);
  outputHighlightEl.innerHTML = outputText
    ? renderHighlighted(outputText, "output", lastRenames, getHighlightOptions())
    : "";
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
    caret = inputEl.selectionStart;
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
  const caret = inputEl.selectionStart;
  inputText = inputEl.value;
  cancelPendingInputEdit();
  inputEditTimer = setTimeout(() => {
    inputEditTimer = null;
    runTransform(
      document.activeElement === inputEl ? inputEl.selectionStart : caret
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
  inputCodeBlock.setSource(text);
  runTransform(caret ?? text.length);
}

function rerunFromToggle() {
  if (document.activeElement === inputEl) {
    inputText = inputEl.value;
  }
  runTransformNow(
    document.activeElement === inputEl ? inputEl.selectionStart : undefined
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
    inputText = inputEl.value;
  }
  const caret =
    document.activeElement === inputEl ? inputEl.selectionStart : undefined;
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

outputPreEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
    e.preventDefault();
    if (outputText) {
      selectElementContents(outputHighlightEl);
    }
  }
});

function refreshHighlights() {
  const caret =
    document.activeElement === inputEl ? inputEl.selectionStart : undefined;
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

inputCodeBlockEl.addEventListener("click", (e) => {
  if (inputEl.contains(e.target)) return;
  inputEl.focus();
});

inputEl.addEventListener("compositionstart", () => {
  isComposing = true;
});

inputEl.addEventListener("compositionend", () => {
  isComposing = false;
  const caret = inputEl.selectionStart;
  inputText = inputEl.value;
  runTransformNow(caret);
});

inputEl.addEventListener("input", () => {
  if (isComposing) return;
  handleInputEdit();
});

mappingResetBannerBtn.addEventListener("click", () => {
  requestMappingReset();
});

document.addEventListener(APP_CONFIG.themeChangeEvent, () => {
  refreshHighlights();
});

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
initTutorial({
  id: "pqm-overview",
  startTriggers: [document.getElementById("start-tour-btn")],
  steps: [
    {
      target: ".panes",
      title: "Input / Output",
      body: "Insert your M code, the transformed output will be generated automatically.",
      position: "right",
    },
    {
      target: ".toolbar-mapping",
      title: "Step mapping",
      body: "Customise the mapping with your own step names and identifiers.",
      position: "bottom",
    },
    {
      target: "#verbose-names-toggle",
      title: "Step name style",
      body: "Switch between short names (default) and more descriptive step names. Verbose mode attempts to extract a descriptor from the step function.",
      position: "bottom",
    },
    {
      target: "#always-number-toggle",
      title: "Number repeated steps",
      body: "Choose between numbering recurring identical steps (default) or numbering all steps.",
      position: "bottom",
    },
    {
      target: "#syntax-highlight-toggle",
      title: "Syntax highlighting",
      body: "Turn syntax highlighting on or off.",
      position: "bottom",
    },
    {
      target: "#step-highlight-toggle",
      title: "Step highlighting",
      body: "Show or hide legend definition. The legend helps visually identify the transformations.",
      position: "bottom",
    },
    {
      target: "#example-btn",
      title: "Try it",
      body: "Load an example to see the transformation in action.",
      position: "bottom",
      interactive: true,
      advanceOn: "click",
    },
  ],
});
loadExamples();

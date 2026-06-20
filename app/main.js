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
  lineNumbersText,
} from "./editor.js";
import { initTheme, initThemeToggle } from "./theme.js";

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
const mappingInfoEl = document.getElementById("mapping-info");
const stepHighlightToggle = document.getElementById("step-highlight-toggle");
const stepHighlightLegend = document.getElementById("step-highlight-legend");

const STEP_HIGHLIGHT_STORAGE_KEY = "pqm-step-highlight";

let mapping = {};
let examples = [];
let lastLoadedExampleFile = null;
let exampleMenuOpen = false;
let lastRenames = null;
let inputText = "";
let outputText = "";
let isComposing = false;
let skipNextInput = false;

function getStepHighlightEnabled() {
  const stored = localStorage.getItem(STEP_HIGHLIGHT_STORAGE_KEY);
  return stored !== "false";
}

function setStepHighlightEnabled(enabled) {
  localStorage.setItem(STEP_HIGHLIGHT_STORAGE_KEY, enabled ? "true" : "false");
  stepHighlightToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  stepHighlightLegend.classList.toggle("is-disabled", !enabled);
}

function showBanner(messages, type = "warning") {
  if (!messages.length) {
    bannerEl.classList.add("hidden");
    bannerEl.textContent = "";
    return;
  }
  bannerEl.className = `banner banner-${type}`;
  bannerEl.textContent = messages.join(" ");
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
    getStepHighlightEnabled()
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
    getStepHighlightEnabled()
  );
}

function runTransform(caret) {
  const result = transform(inputText, mapping);
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
    const res = await fetch("app/mapping.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mapping = await res.json();
    mappingInfoEl.textContent = `${Object.keys(mapping).length} mappings loaded`;
    runTransform(0);
  } catch (err) {
    mappingInfoEl.textContent = "Failed to load mapping";
    showBanner(
      [
        `Could not load mapping.json: ${err.message}. Run from a local server or deploy to GitHub Pages.`,
      ],
      "error"
    );
  }
}

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(outputText);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy output";
    }, 1500);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(outputHighlightEl);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("copy");
    selection.removeAllRanges();
  }
}

copyBtn.addEventListener("click", copyOutput);

setStepHighlightEnabled(getStepHighlightEnabled());

stepHighlightToggle.addEventListener("click", () => {
  const enabled = stepHighlightToggle.getAttribute("aria-pressed") !== "true";
  setStepHighlightEnabled(enabled);
  const caret =
    document.activeElement === inputEl ? saveCaretOffset(inputEl) : undefined;
  updateInputDisplay(caret);
  updateOutputHighlight();
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
    closeExampleMenu();
  }
});

clearBtn.addEventListener("click", () => {
  setInputText("");
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
  if (isComposing || skipNextInput) {
    skipNextInput = false;
    return;
  }
  handleInputEdit();
});

inputEl.addEventListener("paste", (e) => {
  e.preventDefault();
  skipNextInput = true;
  const pasted = e.clipboardData.getData("text/plain");
  const { start, end } = getSelectionOffsets(inputEl);
  inputText = inputText.slice(0, start) + pasted + inputText.slice(end);
  runTransform(start + pasted.length);
});

loadMapping();
loadExamples();
initTheme();
initThemeToggle(document.getElementById("theme-toggle"));

document.addEventListener("pqm-theme-change", () => {
  const caret =
    document.activeElement === inputEl ? saveCaretOffset(inputEl) : undefined;
  updateInputDisplay(caret);
  updateOutputHighlight();
});

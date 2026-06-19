import { transform } from "./transform.js";
import { renderHighlighted } from "./highlight.js";
import { DEFAULT_EXAMPLE } from "./example.js";
import {
  saveCaretOffset,
  getSelectionOffsets,
  restoreCaretOffset,
  readPlainText,
  lineNumbersText,
} from "./editor.js";

const inputEl = document.getElementById("input");
const inputGutterEl = document.getElementById("input-gutter");
const outputHighlightEl = document.getElementById("output-highlight");
const outputGutterEl = document.getElementById("output-gutter");
const exampleBtn = document.getElementById("example-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const bannerEl = document.getElementById("banner");
const mappingInfoEl = document.getElementById("mapping-info");

let mapping = {};
let lastRenames = null;
let inputText = "";
let outputText = "";
let isComposing = false;
let skipNextInput = false;

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
  inputEl.innerHTML = renderHighlighted(inputText, "input", lastRenames);

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
    lastRenames
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

exampleBtn.addEventListener("click", () => {
  setInputText(DEFAULT_EXAMPLE);
  inputEl.focus();
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

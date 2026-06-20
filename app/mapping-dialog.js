import { renderJsonHighlighted } from "./highlight.js";
import {
  getSelectionOffsets,
  readPlainText,
  restoreCaretOffset,
  saveCaretOffset,
} from "./editor.js";
import {
  clearStoredMapping,
  formatMappingJson,
  getDefaultMapping,
  getEffectiveMapping,
  hasStoredMapping,
  parseMappingJson,
  saveMapping,
} from "./mapping-store.js";

let dialogEl = null;
let editorEl = null;
let errorEl = null;
let openBtn = null;
let isOpen = false;
let onMappingChange = null;
let previouslyFocused = null;
let skipNextInput = false;

const FOCUSABLE =
  'button:not([disabled]), [contenteditable="true"]:not([contenteditable="false"]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function syncOpenButtonState() {
  if (!openBtn) return;

  if (hasStoredMapping()) {
    openBtn.title = "Custom mapping active — click to edit";
  } else {
    openBtn.title = "Edit step name mapping";
  }
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

function getEditorText() {
  return readPlainText(editorEl);
}

function updateEditorDisplay(caret) {
  const text = getEditorText();
  editorEl.innerHTML = renderJsonHighlighted(text);

  if (caret !== undefined) {
    restoreCaretOffset(editorEl, caret);
  }
}

function populateEditor(mapping) {
  const text = formatMappingJson(mapping);
  editorEl.innerHTML = renderJsonHighlighted(text);
}

function getFocusableElements() {
  return [...dialogEl.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null
  );
}

function trapFocus(e) {
  if (!isOpen || e.key !== "Tab") return;

  const focusable = getFocusableElements();
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function handleEscape(e) {
  if (!isOpen || e.key !== "Escape") return;
  e.preventDefault();
  e.stopPropagation();
  closeDialog();
}

function handleEditorInput() {
  if (skipNextInput) {
    skipNextInput = false;
    return;
  }

  const caret = saveCaretOffset(editorEl);
  updateEditorDisplay(caret);
}

function handleEditorPaste(e) {
  e.preventDefault();
  skipNextInput = true;

  const pasted = e.clipboardData.getData("text/plain");
  const { start, end } = getSelectionOffsets(editorEl);
  const text = getEditorText();
  const nextText = text.slice(0, start) + pasted + text.slice(end);

  editorEl.textContent = nextText;
  updateEditorDisplay(start + pasted.length);
}

function openDialog() {
  if (isOpen) return;

  previouslyFocused = document.activeElement;
  populateEditor(getEffectiveMapping());
  clearError();
  dialogEl.classList.remove("hidden");
  document.body.classList.add("modal-open");
  isOpen = true;
  editorEl.focus();
  restoreCaretOffset(editorEl, getEditorText().length);
}

function closeDialog() {
  if (!isOpen) return;

  dialogEl.classList.add("hidden");
  document.body.classList.remove("modal-open");
  isOpen = false;
  clearError();

  if (previouslyFocused?.focus) {
    previouslyFocused.focus();
  }
}

function applyMapping(mapping, persist) {
  if (persist) saveMapping(mapping);
  onMappingChange?.(mapping);
  syncOpenButtonState();
}

function handleApply() {
  const result = parseMappingJson(getEditorText());
  if (result.error) {
    showError(result.error);
    return;
  }

  applyMapping(result.mapping, true);
  closeDialog();
}

function handleReset() {
  clearStoredMapping();
  const defaultMapping = getDefaultMapping();
  if (!defaultMapping) return;

  populateEditor(defaultMapping);
  clearError();
  applyMapping(defaultMapping, false);
  editorEl.focus();
}

export function isMappingDialogOpen() {
  return isOpen;
}

export function refreshMappingEditorHighlight() {
  if (!isOpen || !editorEl) return;

  const caret =
    document.activeElement === editorEl ? saveCaretOffset(editorEl) : undefined;
  updateEditorDisplay(caret);
}

export function initMappingDialog({ onMappingChange: mappingChangeHandler } = {}) {
  onMappingChange = mappingChangeHandler;

  dialogEl = document.getElementById("mapping-dialog");
  editorEl = document.getElementById("mapping-editor");
  errorEl = document.getElementById("mapping-dialog-error");
  openBtn = document.getElementById("mapping-edit-btn");

  const closeBtn = dialogEl.querySelector(".modal-close");
  const backdrop = dialogEl.querySelector(".modal-backdrop");
  const cancelBtn = document.getElementById("mapping-cancel-btn");
  const applyBtn = document.getElementById("mapping-apply-btn");
  const resetBtn = document.getElementById("mapping-reset-btn");

  openBtn.addEventListener("click", openDialog);
  closeBtn.addEventListener("click", closeDialog);
  backdrop.addEventListener("click", closeDialog);
  cancelBtn.addEventListener("click", closeDialog);
  applyBtn.addEventListener("click", handleApply);
  resetBtn.addEventListener("click", handleReset);

  editorEl.addEventListener("input", handleEditorInput);
  editorEl.addEventListener("paste", handleEditorPaste);

  dialogEl.addEventListener("keydown", trapFocus);
  document.addEventListener("keydown", handleEscape, true);

  document.addEventListener("pqm-theme-change", refreshMappingEditorHighlight);

  syncOpenButtonState();
}

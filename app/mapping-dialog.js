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
  getDefaultVersion,
  getEffectiveMapping,
  hasCustomMapping,
  isDefaultMapping,
  isDefaultMappingReady,
  parseMappingJson,
  resetToDefaultMapping,
  saveMapping,
} from "./mapping-store.js";

let dialogEl = null;
let editorEl = null;
let errorEl = null;
let openBtn = null;
let versionLabelEl = null;
let isOpen = false;
let onMappingChange = null;
let onMappingReset = null;
let previouslyFocused = null;

const FOCUSABLE =
  'button:not([disabled]), [contenteditable="true"]:not([contenteditable="false"]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function syncMappingVersionLabel() {
  if (!versionLabelEl) return;

  if (hasCustomMapping()) {
    versionLabelEl.textContent = "(custom)";
  } else {
    versionLabelEl.textContent = `(v${getDefaultVersion()})`;
  }
}

function syncOpenButtonState() {
  if (!openBtn) return;

  if (!isDefaultMappingReady()) {
    openBtn.disabled = true;
    openBtn.title = "Mapping unavailable — default mapping failed to load";
    if (versionLabelEl) versionLabelEl.textContent = "";
    return;
  }

  openBtn.disabled = false;

  if (hasCustomMapping()) {
    openBtn.title = "Custom mapping active — click to edit";
  } else {
    openBtn.title = "Edit step name mapping";
  }

  syncMappingVersionLabel();
}

/** Refresh open-button state after default mapping load succeeds or fails. */
export function refreshMappingEditorAvailability() {
  if (!isDefaultMappingReady() && isOpen) {
    closeDialog();
  }
  syncOpenButtonState();
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
  const caret = saveCaretOffset(editorEl);
  updateEditorDisplay(caret);
}

function handleEditorPaste(e) {
  e.preventDefault();

  const pasted = e.clipboardData.getData("text/plain");
  const { start, end } = getSelectionOffsets(editorEl);
  const text = getEditorText();
  const nextText = text.slice(0, start) + pasted + text.slice(end);

  editorEl.textContent = nextText;
  updateEditorDisplay(start + pasted.length);
}

function openDialog() {
  if (isOpen) return;
  if (!isDefaultMappingReady()) {
    syncOpenButtonState();
    return;
  }

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
  if (!isDefaultMappingReady()) {
    throw new Error("Default mapping is not loaded; cannot apply changes.");
  }

  if (persist) {
    if (isDefaultMapping(mapping)) {
      clearStoredMapping();
    } else {
      saveMapping(mapping);
    }
  }

  const effective = isDefaultMapping(mapping)
    ? getDefaultMapping() ?? mapping
    : mapping;
  onMappingChange?.(effective);
  syncOpenButtonState();
  onMappingReset?.();
}

function handleApply() {
  if (!isDefaultMappingReady()) {
    showError("Default mapping is not loaded; cannot apply changes.");
    return;
  }

  const result = parseMappingJson(getEditorText());
  if (result.error) {
    showError(result.error);
    return;
  }

  try {
    applyMapping(result.mapping, true);
  } catch (err) {
    showError(err.message);
    return;
  }
  closeDialog();
}

export function resetMappingToDefault() {
  const defaultMapping = resetToDefaultMapping();
  if (!defaultMapping || !Object.keys(defaultMapping).length) return null;

  if (isOpen) {
    populateEditor(defaultMapping);
    clearError();
    editorEl.focus();
  }

  onMappingChange?.(defaultMapping);
  syncOpenButtonState();
  onMappingReset?.();
  return defaultMapping;
}

function handleReset() {
  resetMappingToDefault();
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

export function initMappingDialog({
  onMappingChange: mappingChangeHandler,
  onMappingReset: mappingResetHandler,
} = {}) {
  onMappingChange = mappingChangeHandler;
  onMappingReset = mappingResetHandler;

  dialogEl = document.getElementById("mapping-dialog");
  editorEl = document.getElementById("mapping-editor");
  errorEl = document.getElementById("mapping-dialog-error");
  openBtn = document.getElementById("mapping-edit-btn");
  versionLabelEl = document.getElementById("mapping-version-label");

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

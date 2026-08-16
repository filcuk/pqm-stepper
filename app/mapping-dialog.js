import { APP_CONFIG } from "./config.js";
import { initDialog } from "./components/dialog.js";
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

let dialogControl = null;
let dialogEl = null;
let editorEl = null;
let errorEl = null;
let openBtn = null;
let versionLabelEl = null;
let onMappingChange = null;
let onMappingReset = null;

function isOpen() {
  return dialogControl?.isDialogOpen() ?? false;
}

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
  if (!isDefaultMappingReady() && isOpen()) {
    dialogControl.closeDialog();
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
  dialogControl.closeDialog();
}

export function resetMappingToDefault() {
  const defaultMapping = resetToDefaultMapping();
  if (!defaultMapping || !Object.keys(defaultMapping).length) return null;

  if (isOpen()) {
    populateEditor(defaultMapping);
    clearError();
    editorEl.focus();
  }

  onMappingChange?.(defaultMapping);
  syncOpenButtonState();
  onMappingReset?.();
  return defaultMapping;
}

export function isMappingDialogOpen() {
  return isOpen();
}

export function refreshMappingEditorHighlight() {
  if (!isOpen() || !editorEl) return;

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

  const applyBtn = document.getElementById("mapping-apply-btn");
  const resetBtn = document.getElementById("mapping-reset-btn");

  // Focus trap, Escape, backdrop / close / cancel ([data-dialog-close]), and
  // the Enter → Apply default all come from the template dialog.
  dialogControl = initDialog({
    dialogEl,
    openTriggers: [openBtn],
    onOpen: () => {
      populateEditor(getEffectiveMapping());
      clearError();
      editorEl.focus();
      restoreCaretOffset(editorEl, getEditorText().length);
    },
    onClose: clearError,
  });

  applyBtn.addEventListener("click", handleApply);
  resetBtn.addEventListener("click", resetMappingToDefault);

  editorEl.addEventListener("input", handleEditorInput);
  editorEl.addEventListener("paste", handleEditorPaste);

  document.addEventListener(
    APP_CONFIG.themeChangeEvent,
    refreshMappingEditorHighlight
  );

  syncOpenButtonState();
}

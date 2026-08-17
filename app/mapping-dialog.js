import { initDialog } from "./components/dialog.js";
import { initCodeBlock } from "./components/code-block.js";
import { ensureJsonGrammar } from "./highlight.js";
import { setPageInert } from "./utils/dom.js";
import { onDocumentEscape } from "./utils/document-listeners.js";
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
let confirmControl = null;
let dialogEl = null;
let editorCodeBlock = null;
let editorEl = null;
let errorEl = null;
let openBtn = null;
let resetBtn = null;
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

function getEditorText() {
  return editorCodeBlock?.getSource() ?? "";
}

/** Nothing to reset when the default is already stored and shown unedited. */
function canResetMapping() {
  if (!isDefaultMappingReady()) return false;
  if (hasCustomMapping()) return true;
  if (!isOpen()) return false;

  // Unapplied edits count as resettable, including JSON that no longer parses.
  const result = parseMappingJson(getEditorText());
  return result.error ? true : !isDefaultMapping(result.mapping);
}

function syncResetButtonState() {
  if (!resetBtn) return;

  const canReset = canResetMapping();
  resetBtn.disabled = !canReset;
  resetBtn.title = canReset
    ? "Discard the custom mapping and restore the default"
    : "Already using the default mapping";
}

function syncOpenButtonState() {
  if (!openBtn) return;

  if (!isDefaultMappingReady()) {
    openBtn.disabled = true;
    openBtn.title = "Mapping unavailable — default mapping failed to load";
    if (versionLabelEl) versionLabelEl.textContent = "";
    syncResetButtonState();
    return;
  }

  openBtn.disabled = false;

  if (hasCustomMapping()) {
    openBtn.title = "Custom mapping active — click to edit";
  } else {
    openBtn.title = "Edit step name mapping";
  }

  syncMappingVersionLabel();
  syncResetButtonState();
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

function populateEditor(mapping) {
  editorCodeBlock.setSource(formatMappingJson(mapping));
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

/** Reset is destructive — always route it through the confirmation dialog. */
export function requestMappingReset() {
  if (!canResetMapping()) return;
  confirmControl?.openDialog();
}

export function isMappingDialogOpen() {
  return isOpen();
}

export function initMappingDialog({
  onMappingChange: mappingChangeHandler,
  onMappingReset: mappingResetHandler,
} = {}) {
  onMappingChange = mappingChangeHandler;
  onMappingReset = mappingResetHandler;

  dialogEl = document.getElementById("mapping-dialog");
  errorEl = document.getElementById("mapping-dialog-error");
  openBtn = document.getElementById("mapping-edit-btn");
  versionLabelEl = document.getElementById("mapping-version-label");
  resetBtn = document.getElementById("mapping-reset-btn");

  const applyBtn = document.getElementById("mapping-apply-btn");
  const codeBlockEl = document.getElementById("mapping-code-block");
  const confirmDialogEl = document.getElementById("mapping-reset-dialog");
  const confirmBtn = document.getElementById("mapping-reset-confirm-btn");
  const confirmCancelBtn = document.getElementById("mapping-reset-cancel-btn");

  ensureJsonGrammar();
  editorCodeBlock = initCodeBlock(codeBlockEl);
  editorEl = codeBlockEl.querySelector(".code-block-editor");

  // Focus trap, Escape, backdrop / close / cancel ([data-dialog-close]), and
  // the Enter → Apply default all come from the template dialog.
  dialogControl = initDialog({
    dialogEl,
    openTriggers: [openBtn],
    onOpen: () => {
      populateEditor(getEffectiveMapping());
      clearError();
      syncResetButtonState();
      editorEl.focus();
      editorEl.setSelectionRange(editorEl.value.length, editorEl.value.length);
    },
    onClose: () => {
      clearError();
      syncResetButtonState();
    },
  });

  confirmControl = initDialog({
    dialogEl: confirmDialogEl,
    onOpen: () => confirmCancelBtn?.focus(),
    onClose: () => {
      // Opened on top of the mapping dialog, which still needs its page chrome.
      if (isOpen()) {
        document.body.classList.add("modal-open");
        setPageInert(true);
      }
    },
  });

  // Both dialogs register Escape at the same priority, so the confirmation
  // needs to win while it is on top.
  onDocumentEscape(
    () => {
      if (!confirmControl.isDialogOpen()) return false;
      confirmControl.closeDialog();
      return true;
    },
    { priority: 200 }
  );

  confirmBtn.addEventListener("click", () => {
    confirmControl.closeDialog();
    resetMappingToDefault();
  });

  applyBtn.addEventListener("click", handleApply);
  resetBtn.addEventListener("click", requestMappingReset);
  editorEl.addEventListener("input", syncResetButtonState);

  syncOpenButtonState();
}

import {
  getFocusableElements,
  resolveElements,
  setHidden,
  setPageInert,
  trapTabKey,
} from "../utils/dom.js";
import { onDocumentEscape } from "../utils/document-listeners.js";

function getDefaultAction(dialogEl) {
  return (
    dialogEl.querySelector("[data-dialog-default]") ||
    dialogEl.querySelector(".modal-footer-actions .btn-primary") ||
    null
  );
}

function shouldDeferEnterToTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest("textarea, select, [contenteditable='true']")) return true;
  return Boolean(
    target.closest(
      "button, a[href], input[type='button'], input[type='submit'], input[type='reset'], summary",
    ),
  );
}

export function initDialog({ dialogEl, openTriggers = [], onOpen, onClose }) {
  if (!dialogEl) return null;

  let isOpen = false;
  let previouslyFocused = null;

  const closeElements = dialogEl.querySelectorAll("[data-dialog-close]");
  const triggers = resolveElements(openTriggers);

  function onDialogKeyDown(e) {
    if (!isOpen) return;
    trapTabKey(e, dialogEl);

    if (e.key !== "Enter" || e.defaultPrevented || e.isComposing) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (shouldDeferEnterToTarget(e.target)) return;

    const defaultAction = getDefaultAction(dialogEl);
    if (!(defaultAction instanceof HTMLElement) || defaultAction.disabled) return;

    e.preventDefault();
    defaultAction.click();
  }

  function openDialog() {
    if (isOpen) return;

    previouslyFocused = document.activeElement;
    setHidden(dialogEl, false);
    document.body.classList.add("modal-open");
    setPageInert(true);
    isOpen = true;

    const focusable = getFocusableElements(dialogEl);
    const defaultAction = getDefaultAction(dialogEl);
    const closeBtn = dialogEl.querySelector(".modal-close");
    const initialFocus =
      (defaultAction instanceof HTMLElement &&
        focusable.includes(defaultAction) &&
        defaultAction) ||
      focusable.find((el) => el === closeBtn) ||
      focusable[0] ||
      dialogEl;
    initialFocus.focus();

    onOpen?.();
  }

  function closeDialog() {
    if (!isOpen) return;

    setHidden(dialogEl, true);
    document.body.classList.remove("modal-open");
    setPageInert(false);
    isOpen = false;

    if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
      previouslyFocused.focus();
    }

    onClose?.();
  }

  const onTriggerClick = () => openDialog();
  const onCloseClick = () => closeDialog();

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", onTriggerClick);
  });

  closeElements.forEach((el) => {
    el.addEventListener("click", onCloseClick);
  });

  dialogEl.addEventListener("keydown", onDialogKeyDown);

  const removeEscape = onDocumentEscape(() => {
    if (!isOpen) return false;
    closeDialog();
    return true;
  }, { priority: 100 });

  return {
    openDialog,
    closeDialog,
    isDialogOpen: () => isOpen,
    destroy() {
      removeEscape();
      dialogEl.removeEventListener("keydown", onDialogKeyDown);
      triggers.forEach((trigger) => {
        trigger.removeEventListener("click", onTriggerClick);
      });
      closeElements.forEach((el) => {
        el.removeEventListener("click", onCloseClick);
      });
      if (isOpen) closeDialog();
    },
  };
}

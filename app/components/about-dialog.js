/**
 * About / “What?” dialog — tagline opener plus optional progressive
 * simplification stages (Huh? → simpler copy → …).
 *
 * All copy lives in the markup so it can be edited without touching JS:
 *
 *   [data-about-confused]          the “Huh?” button (initial label = its text)
 *   [data-about-stage]             one block per stage, revealed in DOM order;
 *                                  optional data-about-next-label re-labels the
 *                                  button once that stage is showing
 *   [data-about-final]             optional element (usually an <a href>) shown
 *                                  after the last stage; the button hides
 *
 * While stages are showing, the dialog carries `data-about-dimmed` and the
 * newest stage `data-about-current`, so earlier copy can recede.
 *
 * Built on `initDialog` (focus trap, Escape, backdrop, Enter default).
 */

import { getFocusableElements, setHidden } from "../utils/dom.js";
import { initDialog } from "./dialog.js";

/**
 * @typedef {Object} AboutDialogOptions
 * @property {HTMLElement | null} dialogEl
 * @property {string | Element | Iterable<Element> | ArrayLike<Element>} [openTriggers]
 * @property {() => void} [onOpen]
 * @property {() => void} [onClose]
 */

/**
 * Prefer the final CTA when visible, else dialog close, else first focusable / root.
 * @param {HTMLElement} dialogEl
 * @param {Element | null} [preferred]
 */
function focusAboutDialog(dialogEl, preferred = null) {
  const focusable = getFocusableElements(dialogEl);
  const closeBtn =
    dialogEl.querySelector(".modal-close") ||
    dialogEl.querySelector("[data-dialog-close]");
  const preferredFocus =
    preferred instanceof HTMLElement &&
    focusable.find(
      (el) => el === preferred || preferred.contains(el)
    );
  const next =
    preferredFocus ||
    (closeBtn instanceof HTMLElement && focusable.includes(closeBtn)
      ? closeBtn
      : null) ||
    focusable[0] ||
    dialogEl;
  next.focus({ preventScroll: true });
}

/**
 * @param {AboutDialogOptions} options
 */
export function initAboutDialog({
  dialogEl,
  openTriggers = [],
  onOpen,
  onClose,
} = {}) {
  if (!(dialogEl instanceof HTMLElement)) return null;

  const confusedBtn = dialogEl.querySelector("[data-about-confused]");
  const stages = /** @type {HTMLElement[]} */ ([
    ...dialogEl.querySelectorAll("[data-about-stage]"),
  ]);
  const finalEl = dialogEl.querySelector("[data-about-final]");

  const initialLabel = confusedBtn?.textContent?.trim() ?? "";
  /** Index of the next stage to reveal. */
  let stage = 0;

  function reset() {
    stage = 0;

    delete dialogEl.dataset.aboutDimmed;
    for (const el of stages) {
      delete el.dataset.aboutCurrent;
      setHidden(el, true);
    }
    if (finalEl instanceof HTMLElement) {
      setHidden(finalEl, true);
    }
    if (confusedBtn instanceof HTMLElement) {
      confusedBtn.textContent = initialLabel;
      // Nothing to progress through — the button would be a dead end.
      setHidden(confusedBtn, stages.length === 0);
    }
  }

  function revealNextStage() {
    if (!(confusedBtn instanceof HTMLElement)) return;
    if (stage >= stages.length) return;

    const current = stages[stage];
    setHidden(current, false);
    stage += 1;

    // Everything but the newest block dims (see overlays.css).
    for (const el of stages) {
      delete el.dataset.aboutCurrent;
    }
    current.dataset.aboutCurrent = "";
    dialogEl.dataset.aboutDimmed = "";

    const nextLabel = current.dataset.aboutNextLabel;
    if (nextLabel) {
      confusedBtn.textContent = nextLabel;
    }

    if (stage < stages.length) return;

    // Out of stages — hand over to the final link, or retire the button.
    setHidden(confusedBtn, true);
    if (finalEl instanceof HTMLElement) {
      setHidden(finalEl, false);
    }
    focusAboutDialog(dialogEl, finalEl instanceof HTMLElement ? finalEl : null);
  }

  const dialog = initDialog({
    dialogEl,
    openTriggers,
    onOpen: () => {
      reset();
      onOpen?.();
    },
    onClose: () => {
      reset();
      onClose?.();
    },
  });

  if (!dialog) return null;

  confusedBtn?.addEventListener("click", revealNextStage);

  reset();

  return {
    openDialog: () => dialog.openDialog(),
    closeDialog: () => dialog.closeDialog(),
    isDialogOpen: () => dialog.isDialogOpen(),
    reset,
    destroy() {
      confusedBtn?.removeEventListener("click", revealNextStage);
      dialog.destroy();
    },
  };
}

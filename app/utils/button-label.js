/**
 * In-place button label flashes (Copy → Copied / Failed).
 *
 * Pair `.btn-label-flash` with a `.btn-label-flash__label` span (icon optional).
 * Call `prepareButtonLabelFlash()` once, then `flashButtonLabel()` on action.
 * Use `setButtonLabelFlash()` for other temporary labels (e.g. Ctrl+V).
 */

/** @typedef {{ idle: string, success: string, fail: string, timer: ReturnType<typeof setTimeout> | null, widthLocked: boolean }} ButtonLabelFlashState */

/** @type {WeakMap<HTMLButtonElement, ButtonLabelFlashState>} */
const stateByButton = new WeakMap();

export const BUTTON_LABEL_FLASH_LABEL_CLASS = "btn-label-flash__label";

/**
 * Collect unique label strings used for optional width locking.
 * @param {{ idle: string, success: string, fail: string, measureLabels?: string[] }} options
 * @returns {string[]}
 */
export function collectButtonLabelFlashMeasureLabels({
  idle,
  success,
  fail,
  measureLabels = [],
}) {
  const seen = new Set();
  /** @type {string[]} */
  const labels = [];
  for (const text of [idle, success, fail, ...measureLabels]) {
    if (seen.has(text)) continue;
    seen.add(text);
    labels.push(text);
  }
  return labels;
}

/**
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} labelEl
 * @param {string[]} labels
 */
function lockButtonLabelFlashWidth(button, labelEl, labels) {
  const saved = labelEl.textContent ?? "";
  let maxWidth = 0;
  for (const text of labels) {
    labelEl.textContent = text;
    maxWidth = Math.max(maxWidth, button.offsetWidth);
  }
  labelEl.textContent = saved;
  button.style.minWidth = `${maxWidth}px`;
}

/**
 * Ensure a button has the label-flash structure and optional locked width.
 * @param {HTMLButtonElement} button
 * @param {{
 *   idle: string,
 *   success?: string,
 *   fail?: string,
 *   lockWidth?: boolean,
 *   measureLabels?: string[],
 * }} options
 */
export function prepareButtonLabelFlash(
  button,
  {
    idle,
    success = "Copied",
    fail = "Failed",
    lockWidth = true,
    measureLabels = [],
  } = {}
) {
  button.classList.add("btn-label-flash");

  let labelEl = button.querySelector(`.${BUTTON_LABEL_FLASH_LABEL_CLASS}`);
  if (!(labelEl instanceof HTMLElement)) {
    labelEl = document.createElement("span");
    labelEl.className = BUTTON_LABEL_FLASH_LABEL_CLASS;
    button.append(labelEl);
  }

  labelEl.textContent = idle;

  const existing = stateByButton.get(button);
  const widthLocked = existing?.widthLocked ?? false;
  stateByButton.set(button, {
    idle,
    success,
    fail,
    timer: existing?.timer ?? null,
    widthLocked,
  });

  if (lockWidth && !widthLocked) {
    const labels = collectButtonLabelFlashMeasureLabels({
      idle,
      success,
      fail,
      measureLabels,
    });
    lockButtonLabelFlashWidth(button, labelEl, labels);
    const next = stateByButton.get(button);
    if (next) next.widthLocked = true;
  }
}

/**
 * Set the visible label text on a prepared button.
 * @param {HTMLButtonElement} button
 * @param {string} text
 */
export function setButtonLabelFlash(button, text) {
  const labelEl = button.querySelector(`.${BUTTON_LABEL_FLASH_LABEL_CLASS}`);
  if (labelEl) labelEl.textContent = text;
}

/**
 * Flash success or failure label text, then call `reset()` after a timeout.
 * @param {HTMLButtonElement} button
 * @param {boolean} ok
 * @param {{
 *   durationMs?: number,
 *   reset?: () => void,
 *   success?: string,
 *   fail?: string,
 * }} [options]
 */
export function flashButtonLabel(
  button,
  ok,
  { durationMs = 1500, reset, success, fail } = {}
) {
  const state = stateByButton.get(button);
  const flashText = ok
    ? success ?? state?.success ?? "Copied"
    : fail ?? state?.fail ?? "Failed";

  if (state?.timer !== null && state?.timer !== undefined) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  setButtonLabelFlash(button, flashText);
  button.setAttribute("aria-label", flashText);

  const timer = setTimeout(() => {
    const current = stateByButton.get(button);
    if (current) current.timer = null;
    reset?.();
  }, durationMs);

  if (state) state.timer = timer;
}

/**
 * Cancel an in-flight label flash timer on a button.
 * @param {HTMLButtonElement} button
 */
export function cancelButtonLabelFlash(button) {
  const state = stateByButton.get(button);
  if (state?.timer !== null && state?.timer !== undefined) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

/**
 * Toggle button — switches a button between two pressed states.
 *
 * Markup:
 *   <button type="button" class="btn btn-toggle" aria-pressed="false"
 *     data-toggle-button
 *     data-toggle-button-label-off="Enable"
 *     data-toggle-button-label-on="Disable"></button>
 *
 * Add `data-toggle-button-always-active` when both states represent available
 * actions rather than on / off: the pressed accent styling is dropped so the
 * button keeps its default appearance, and state-specific labels and icons
 * describe the next action.
 *
 * data-toggle-button-label-off / -on — visible label for each pressed state
 * data-toggle-button-aria-label-off / -on — accessible label for each state
 * data-toggle-button-icon-off / -on — icon id for each state
 * data-toggle-button-icon-class — class applied to mounted icons
 * data-toggle-button-always-active — keep the default button look in both states
 */

import { parseBooleanAttr } from "../utils/dom.js";
import { mountIcon } from "../utils/icons.js";

function readStateValue(option, datasetValue) {
  return option !== undefined ? option : datasetValue;
}

/**
 * @param {HTMLButtonElement | null} buttonEl
 * @param {{
 *   defaultPressed?: boolean,
 *   alwaysActive?: boolean,
 *   labelOff?: string,
 *   labelOn?: string,
 *   ariaLabelOff?: string,
 *   ariaLabelOn?: string,
 *   iconOff?: string,
 *   iconOn?: string,
 *   iconClass?: string,
 *   onChange?: Function
 * }} [options]
 */
export function initToggleButton(buttonEl, options = {}) {
  if (!buttonEl) return null;

  const labelOff = readStateValue(options.labelOff, buttonEl.dataset.toggleButtonLabelOff);
  const labelOn = readStateValue(options.labelOn, buttonEl.dataset.toggleButtonLabelOn);
  const ariaLabelOff = readStateValue(
    options.ariaLabelOff,
    buttonEl.dataset.toggleButtonAriaLabelOff,
  );
  const ariaLabelOn = readStateValue(
    options.ariaLabelOn,
    buttonEl.dataset.toggleButtonAriaLabelOn,
  );
  const iconOff = readStateValue(options.iconOff, buttonEl.dataset.toggleButtonIconOff);
  const iconOn = readStateValue(options.iconOn, buttonEl.dataset.toggleButtonIconOn);
  const iconClass =
    readStateValue(options.iconClass, buttonEl.dataset.toggleButtonIconClass) ||
    buttonEl.dataset.iconClass ||
    "btn-icon-svg";
  const alwaysActive =
    typeof options.alwaysActive === "boolean"
      ? options.alwaysActive
      : parseBooleanAttr(buttonEl.dataset.toggleButtonAlwaysActive) ?? false;
  const hasDynamicContent =
    labelOff !== undefined ||
    labelOn !== undefined ||
    iconOff !== undefined ||
    iconOn !== undefined;

  let pressed =
    typeof options.defaultPressed === "boolean"
      ? options.defaultPressed
      : buttonEl.getAttribute("aria-pressed") === "true";

  function syncContent() {
    if (!hasDynamicContent) return;

    const label = pressed ? labelOn : labelOff;
    const icon = pressed ? iconOn : iconOff;
    const children = [];

    if (icon) {
      const iconHost = document.createElement("span");
      mountIcon(iconHost, icon, { className: iconClass });
      children.push(iconHost.firstElementChild);
    }

    if (label !== undefined) {
      const labelEl = document.createElement("span");
      labelEl.className = "btn-toggle-label";
      labelEl.textContent = label;
      children.push(labelEl);
    }

    buttonEl.replaceChildren(...children.filter(Boolean));
  }

  function syncDom({ emit = true, source = "init" } = {}) {
    buttonEl.setAttribute("aria-pressed", pressed ? "true" : "false");
    buttonEl.classList.toggle("btn-toggle--always-active", alwaysActive);

    const ariaLabel = pressed ? ariaLabelOn : ariaLabelOff;
    if (ariaLabel !== undefined) {
      buttonEl.setAttribute("aria-label", ariaLabel);
    }

    syncContent();

    if (emit) {
      options.onChange?.({
        buttonEl,
        pressed,
        source,
      });
    }
  }

  function setPressed(nextPressed, { emit = true, source = "api" } = {}) {
    pressed = Boolean(nextPressed);
    syncDom({ emit, source });
  }

  function onClick() {
    setPressed(!pressed, { source: "click" });
  }

  buttonEl.addEventListener("click", onClick);
  syncDom({ emit: Boolean(options.onChange) });

  return {
    getPressed() {
      return pressed;
    },
    setPressed(nextPressed, { emit = true } = {}) {
      setPressed(nextPressed, { emit, source: "api" });
    },
    toggle({ emit = true } = {}) {
      setPressed(!pressed, { emit, source: "api" });
    },
    destroy() {
      buttonEl.removeEventListener("click", onClick);
    },
  };
}

/** Wire every `[data-toggle-button]` in `root`. */
export function initToggleButtons(root = document) {
  const instances = [];
  root.querySelectorAll("[data-toggle-button]").forEach((buttonEl) => {
    const instance = initToggleButton(buttonEl);
    if (instance) instances.push(instance);
  });
  return instances;
}

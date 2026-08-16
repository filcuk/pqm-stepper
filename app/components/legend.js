/**
 * Legend — coloured category chips for charts, code highlights, and similar.
 *
 * Palette slots (optional modifiers `.legend-chip--1` … `--8`):
 *   tokens `--legend-N` / `--legend-N-border`
 *
 * Static (display only):
 *   <div class="legend" role="list" aria-label="Legend">
 *     <span class="legend-chip legend-chip--1" role="listitem">Series A</span>
 *   </div>
 *
 * Interactive (toggle category on/off):
 *   <div class="legend" role="group" aria-label="Highlight categories">
 *     <button type="button" class="legend-chip legend-chip--1"
 *       aria-pressed="true" data-legend-value="a"
 *       data-tooltip="Series A">Series A</button>
 *   </div>
 *
 * Custom colour: set `--legend-color` (and optionally `--legend-border`) on the chip.
 */

function readLegendValue(chipEl) {
  return chipEl.dataset.legendValue ?? chipEl.textContent.trim();
}

function readLegendLabel(chipEl) {
  const labelEl = chipEl.querySelector(".legend-chip-label");
  return (labelEl?.textContent ?? chipEl.textContent).trim();
}

function isInteractiveChip(chip) {
  return chip instanceof HTMLButtonElement;
}

/**
 * Legend group — optional toggleable coloured chips.
 * Only `button.legend-chip` items toggle; static spans stay inert.
 * @param {HTMLElement | null} legendEl
 */
export function initLegend(legendEl, { onChange } = {}) {
  if (!legendEl) return null;

  const chips = () =>
    [...legendEl.querySelectorAll(":scope > .legend-chip")].filter(isInteractiveChip);

  function getSelected() {
    return chips()
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => ({
        value: readLegendValue(chip),
        label: readLegendLabel(chip),
        element: chip,
      }));
  }

  function emit(source) {
    const selected = getSelected();
    onChange?.({
      legendEl,
      selected,
      values: selected.map((item) => item.value),
      labels: selected.map((item) => item.label),
      source,
    });
  }

  function setPressed(chip, pressed, { emitEvent = true, source = "api" } = {}) {
    if (!isInteractiveChip(chip)) return;
    chip.setAttribute("aria-pressed", pressed ? "true" : "false");
    chip.classList.toggle("is-active", pressed);
    chip.classList.toggle("is-inactive", !pressed);
    if (emitEvent) emit(source);
  }

  function onChipClick(event) {
    const chip = event.target.closest("button.legend-chip");
    if (!chip || !legendEl.contains(chip) || chip.disabled) return;
    const next = chip.getAttribute("aria-pressed") !== "true";
    setPressed(chip, next, { source: "click" });
  }

  for (const chip of chips()) {
    if (!chip.hasAttribute("aria-pressed")) {
      chip.setAttribute("aria-pressed", "true");
    }
    const pressed = chip.getAttribute("aria-pressed") === "true";
    chip.classList.toggle("is-active", pressed);
    chip.classList.toggle("is-inactive", !pressed);
  }

  legendEl.addEventListener("click", onChipClick);

  return {
    getSelected,
    getValues() {
      return getSelected().map((item) => item.value);
    },
    setSelected(values, { emitEvent = true } = {}) {
      const wanted = new Set((values ?? []).map(String));
      for (const chip of chips()) {
        setPressed(chip, wanted.has(String(readLegendValue(chip))), {
          emitEvent: false,
        });
      }
      if (emitEvent) emit("api");
    },
    clear({ emitEvent = true } = {}) {
      for (const chip of chips()) {
        setPressed(chip, false, { emitEvent: false });
      }
      if (emitEvent) emit("clear");
    },
    destroy() {
      legendEl.removeEventListener("click", onChipClick);
    },
  };
}

/** Wire every `.legend` in `root`. */
export function initLegends(root = document) {
  const instances = [];
  root.querySelectorAll(".legend").forEach((el) => {
    const instance = initLegend(el);
    if (instance) instances.push(instance);
  });
  return instances;
}

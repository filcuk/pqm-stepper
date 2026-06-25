const GAP = 8;
const TOOLTIP_ID = "tooltip";

let tooltipEl = null;
let activeTarget = null;
/** @type {string | null} */
let savedDescribedBy = null;
const boundRoots = new WeakSet();
let globalListenersBound = false;

function ensureTooltipElement() {
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement("div");
  tooltipEl.id = TOOLTIP_ID;
  tooltipEl.className = "tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function linkDescribedBy(target) {
  savedDescribedBy = target.getAttribute("aria-describedby");
  const ids = new Set(
    (savedDescribedBy || "").split(/\s+/).filter(Boolean)
  );
  ids.add(TOOLTIP_ID);
  target.setAttribute("aria-describedby", [...ids].join(" "));
}

function unlinkDescribedBy(target) {
  if (savedDescribedBy) {
    target.setAttribute("aria-describedby", savedDescribedBy);
  } else {
    target.removeAttribute("aria-describedby");
  }
  savedDescribedBy = null;
}

function getPosition(target) {
  const value = target.dataset.tooltipPosition;
  if (value === "bottom" || value === "left" || value === "right") {
    return value;
  }
  return "top";
}

function positionTooltip(target, text, position) {
  const el = ensureTooltipElement();
  el.textContent = text;

  el.classList.add("is-visible");
  el.hidden = false;

  const rect = target.getBoundingClientRect();
  const tipRect = el.getBoundingClientRect();
  let top = 0;
  let left = 0;

  switch (position) {
    case "bottom":
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.left - tipRect.width - GAP;
      break;
    case "right":
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.right + GAP;
      break;
    default:
      top = rect.top - tipRect.height - GAP;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
  }

  const maxLeft = window.innerWidth - tipRect.width - GAP;
  const maxTop = window.innerHeight - tipRect.height - GAP;
  left = Math.max(GAP, Math.min(left, maxLeft));
  top = Math.max(GAP, Math.min(top, maxTop));

  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

function hideTooltip() {
  if (activeTarget) {
    unlinkDescribedBy(activeTarget);
    activeTarget = null;
  }

  if (!tooltipEl) return;

  tooltipEl.classList.remove("is-visible");
  tooltipEl.hidden = true;
  tooltipEl.textContent = "";
}

function showTooltip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;

  if (activeTarget && activeTarget !== target) {
    hideTooltip();
  }

  activeTarget = target;
  linkDescribedBy(target);
  positionTooltip(target, text, getPosition(target));
}

function handlePointerOver(e) {
  const target = e.target.closest("[data-tooltip]");
  if (!target || !e.currentTarget.contains(target)) return;
  showTooltip(target);
}

function handlePointerOut(e) {
  const from = e.target.closest("[data-tooltip]");
  if (!from) return;

  const to = e.relatedTarget?.closest?.("[data-tooltip]");
  if (to === from) return;

  if (activeTarget === from) {
    hideTooltip();
  }
}

function handleFocusIn(e) {
  const target = e.target.closest?.("[data-tooltip]");
  if (!target || !e.currentTarget.contains(target)) return;
  showTooltip(target);
}

function handleFocusOut(e) {
  const from = e.target.closest?.("[data-tooltip]");
  if (!from) return;

  const to = e.relatedTarget?.closest?.("[data-tooltip]");
  if (to === from) return;

  if (activeTarget === from) {
    hideTooltip();
  }
}

function repositionActiveTooltip() {
  if (!activeTarget) return;
  positionTooltip(
    activeTarget,
    activeTarget.dataset.tooltip,
    getPosition(activeTarget)
  );
}

export function initTooltips(root = document) {
  if (boundRoots.has(root)) return;

  ensureTooltipElement();

  root.addEventListener("mouseover", handlePointerOver);
  root.addEventListener("mouseout", handlePointerOut);
  root.addEventListener("focusin", handleFocusIn);
  root.addEventListener("focusout", handleFocusOut);

  if (!globalListenersBound) {
    window.addEventListener("scroll", repositionActiveTooltip, true);
    window.addEventListener("resize", repositionActiveTooltip);
    globalListenersBound = true;
  }

  boundRoots.add(root);
}

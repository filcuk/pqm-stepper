import { setHidden } from "./dom.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
  registerOpenPopup,
  unregisterOpenPopup,
} from "./document-listeners.js";

const DEFAULT_DROPDOWN_GRID_MIN = 6;
const DEFAULT_DROPDOWN_GRID_COLS = 2;

/** Default item-count threshold before a dropdown menu switches to grid layout. */
export const DROPDOWN_GRID_DEFAULT_MIN = DEFAULT_DROPDOWN_GRID_MIN;

/** Default column count for dropdown menu grid layout. */
export const DROPDOWN_GRID_DEFAULT_COLS = DEFAULT_DROPDOWN_GRID_COLS;

function readListGridCols(containerEl) {
  const colsRaw =
    containerEl?.dataset.comboboxGridCols ??
    containerEl?.dataset.dropdownGridCols;
  const cols =
    colsRaw !== undefined
      ? Number.parseInt(colsRaw, 10)
      : DEFAULT_DROPDOWN_GRID_COLS;
  return Number.isFinite(cols) && cols >= 1 ? cols : DEFAULT_DROPDOWN_GRID_COLS;
}

/** Disabled grid config returned when auto grid is off. */
export function disabledDropdownGridConfig() {
  return {
    enabled: false,
    min: DEFAULT_DROPDOWN_GRID_MIN,
    cols: DEFAULT_DROPDOWN_GRID_COLS,
  };
}

/**
 * Read auto-grid settings from a list host (`.dropdown` or `.combobox`).
 *
 * Markup uses `data-dropdown-grid*` or `data-combobox-grid*` (same semantics):
 *
 * - `data-*-grid="8"` — enable; switch when item count exceeds `8`
 * - `data-*-grid` / `data-*-grid="true"` — enable with default threshold ({@link DROPDOWN_GRID_DEFAULT_MIN})
 * - `data-*-grid="false"` — force list layout
 * - `data-*-grid-min="8"` — same as numeric `data-*-grid` (explicit name)
 * - `data-*-grid-cols="2"` — column count in grid mode
 */
export function readListGridConfig(containerEl) {
  if (!containerEl) return disabledDropdownGridConfig();

  const gridAttr =
    containerEl.dataset.comboboxGrid ?? containerEl.dataset.dropdownGrid;
  if (gridAttr !== undefined) {
    if (gridAttr === "false") return disabledDropdownGridConfig();
    if (gridAttr === "" || gridAttr === "true") {
      return {
        enabled: true,
        min: DEFAULT_DROPDOWN_GRID_MIN,
        cols: readListGridCols(containerEl),
      };
    }
    const parsedMin = Number.parseInt(gridAttr, 10);
    if (Number.isFinite(parsedMin) && parsedMin >= 0) {
      return {
        enabled: true,
        min: parsedMin,
        cols: readListGridCols(containerEl),
      };
    }
  }

  const minAttr =
    containerEl.dataset.comboboxGridMin ?? containerEl.dataset.dropdownGridMin;
  if (minAttr !== undefined) {
    const min = Number.parseInt(minAttr, 10);
    return {
      enabled: true,
      min: Number.isFinite(min) && min >= 0 ? min : DEFAULT_DROPDOWN_GRID_MIN,
      cols: readListGridCols(containerEl),
    };
  }

  return disabledDropdownGridConfig();
}

/** @deprecated Alias for {@link readListGridConfig}. */
export const readDropdownGridConfig = readListGridConfig;

/** @deprecated Alias for {@link readListGridConfig}. */
export const readComboboxGridConfig = readListGridConfig;

/**
 * Merge markup grid `data-*` with init / runtime options.
 *
 * @param {HTMLElement | null | undefined} containerEl
 * @param {{ gridMin?: number | false; gridCols?: number }} [options]
 */
export function resolveListGridConfig(containerEl, { gridMin, gridCols } = {}) {
  if (gridMin === false) return disabledDropdownGridConfig();

  let config = readListGridConfig(containerEl);

  if (typeof gridMin === "number" && Number.isFinite(gridMin) && gridMin >= 0) {
    config = {
      ...config,
      enabled: true,
      min: gridMin,
    };
  }

  if (typeof gridCols === "number" && Number.isFinite(gridCols) && gridCols >= 1) {
    config = { ...config, cols: gridCols };
  }

  return config;
}

/** @deprecated Alias for {@link resolveListGridConfig}. */
export const resolveDropdownGridConfig = resolveListGridConfig;

function countListGridItems(listEl, itemSelector) {
  return [...listEl.querySelectorAll(itemSelector)].filter((item) => {
    if (item.disabled) return false;
    const row = item.closest("li");
    if (row?.hidden || row?.classList.contains("hidden")) return false;
    return true;
  }).length;
}

const POPUP_LIST_GRID_CLASS = {
  "dropdown-menu": "dropdown-menu--grid",
  "combobox-list": "combobox-list--grid",
};

const GRID_SELECTION_JOIN_CLASS = [
  "is-selection-join-top",
  "is-selection-join-right",
  "is-selection-join-bottom",
  "is-selection-join-left",
  "is-selection-corner-tl",
  "is-selection-corner-tr",
  "is-selection-corner-bl",
  "is-selection-corner-br",
];

const GRID_SELECTION_RADIUS = 6;
const GRID_SELECTION_OUTLINE_CLASS = "list-grid-selection-outline";
const gridSelectionOutlineObservers = new WeakMap();

function isPopupListGrid(listEl) {
  return (
    listEl?.classList.contains("dropdown-menu--grid") ||
    listEl?.classList.contains("combobox-list--grid")
  );
}

/**
 * Rows that span every column in grid mode (group headers, separators, empty).
 * @param {Element} li
 * @returns {boolean}
 */
export function isFullSpanGridRow(li) {
  if (!li) return false;
  if (li.classList?.contains?.("footer-also-see-section-break")) return true;
  return Boolean(
    li.querySelector?.(
      ".dropdown-menu-group, .dropdown-menu-separator, .combobox-empty",
    ),
  );
}

function isSelectableGridRow(li, itemSelector) {
  if (li.hidden || li.classList.contains("hidden")) return false;
  if (isFullSpanGridRow(li)) return false;
  const item = li.querySelector(itemSelector);
  if (!item || item.disabled) return false;
  return true;
}

/**
 * Map selectable items to CSS-grid auto-placement slots, accounting for
 * full-span rows so a short last topic row does not shift later columns.
 *
 * @param {ParentNode | null | undefined} listEl
 * @param {string} itemSelector
 * @param {number} cols
 * @returns {{ item: Element, index: number, col: number, row: number }[]}
 */
export function buildListGridSlots(listEl, itemSelector, cols) {
  /** @type {{ item: Element, index: number, col: number, row: number }[]} */
  const slots = [];
  if (!listEl?.children || !itemSelector) return slots;
  const columnCount =
    Number.isFinite(cols) && cols >= 1 ? Math.trunc(cols) : DEFAULT_DROPDOWN_GRID_COLS;

  let col = 0;
  let row = 0;
  for (const li of listEl.children) {
    if (li.hidden || li.classList?.contains?.("hidden")) continue;

    if (isFullSpanGridRow(li)) {
      if (col > 0) {
        row += 1;
        col = 0;
      }
      row += 1;
      col = 0;
      continue;
    }

    if (!isSelectableGridRow(li, itemSelector)) continue;
    const item = li.querySelector(itemSelector);
    if (!item) continue;
    const index = slots.length;
    slots.push({ item, index, col, row });
    col += 1;
    if (col >= columnCount) {
      col = 0;
      row += 1;
    }
  }
  return slots;
}

function isListItemSelected(item) {
  return (
    item.classList.contains("is-selected") ||
    item.getAttribute("aria-checked") === "true"
  );
}

function clearGridSelectionJoinClasses(listEl, itemSelector) {
  if (!listEl.querySelectorAll) return;
  for (const item of listEl.querySelectorAll(itemSelector)) {
    item.classList?.remove?.(...GRID_SELECTION_JOIN_CLASS);
  }
}

function snapOutlineCoord(value) {
  return Math.round(value * 100) / 100;
}

function formatOutlineCoord(value) {
  return String(snapOutlineCoord(value));
}

function pointInRects(x, y, rects) {
  return rects.some(
    (rect) =>
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
  );
}

function unionOutlineLoops(rects) {
  const edgeCounts = new Map();

  const addEdge = (x1, y1, x2, y2) => {
    x1 = snapOutlineCoord(x1);
    y1 = snapOutlineCoord(y1);
    x2 = snapOutlineCoord(x2);
    y2 = snapOutlineCoord(y2);
    const forward = x1 < x2 || (x1 === x2 && y1 < y2);
    const key = forward ? `${x1},${y1}|${x2},${y2}` : `${x2},${y2}|${x1},${y1}`;
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
  };

  for (const rect of rects) {
    const left = rect.x;
    const top = rect.y;
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    addEdge(left, top, right, top);
    addEdge(right, top, right, bottom);
    addEdge(right, bottom, left, bottom);
    addEdge(left, bottom, left, top);
  }

  const segments = [];
  for (const [key, count] of edgeCounts) {
    if (count !== 1) continue;
    const [start, end] = key.split("|");
    const [x1, y1] = start.split(",").map(Number);
    const [x2, y2] = end.split(",").map(Number);
    segments.push({ x1, y1, x2, y2 });
  }

  const adjacency = new Map();
  const addAdjacency = (x, y, index) => {
    const key = `${x},${y}`;
    const list = adjacency.get(key);
    if (list) list.push(index);
    else adjacency.set(key, [index]);
  };
  segments.forEach((segment, index) => {
    addAdjacency(segment.x1, segment.y1, index);
    addAdjacency(segment.x2, segment.y2, index);
  });

  const otherEnd = (segment, x, y) =>
    segment.x1 === x && segment.y1 === y
      ? { x: segment.x2, y: segment.y2 }
      : { x: segment.x1, y: segment.y1 };

  const used = new Array(segments.length).fill(false);
  const loops = [];

  for (let startIndex = 0; startIndex < segments.length; startIndex += 1) {
    if (used[startIndex]) continue;
    const loop = [];
    let segmentIndex = startIndex;
    let x = segments[startIndex].x1;
    let y = segments[startIndex].y1;
    const originX = x;
    const originY = y;
    let guard = 0;
    while (guard < segments.length + 2) {
      guard += 1;
      used[segmentIndex] = true;
      loop.push({ x, y });
      const next = otherEnd(segments[segmentIndex], x, y);
      x = next.x;
      y = next.y;
      if (x === originX && y === originY) break;
      const nextIndex = (adjacency.get(`${x},${y}`) || []).find((index) => !used[index]);
      if (nextIndex === undefined) break;
      segmentIndex = nextIndex;
    }
    if (loop.length >= 3) loops.push(loop);
  }

  for (const loop of loops) {
    const first = loop[0];
    const second = loop[1];
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const length = Math.hypot(dx, dy) || 1;
    const midX = (first.x + second.x) / 2;
    const midY = (first.y + second.y) / 2;
    const rightX = midX + (-dy / length) * 0.75;
    const rightY = midY + (dx / length) * 0.75;
    if (!pointInRects(rightX, rightY, rects)) loop.reverse();
  }

  return loops;
}

function roundedLoopPath(points, radius) {
  const count = points.length;
  if (count < 3) return "";
  const commands = [];

  for (let index = 0; index < count; index += 1) {
    const previous = points[(index + count - 1) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const inX = current.x - previous.x;
    const inY = current.y - previous.y;
    const outX = next.x - current.x;
    const outY = next.y - current.y;
    const inLength = Math.hypot(inX, inY);
    const outLength = Math.hypot(outX, outY);
    if (inLength < 0.001 || outLength < 0.001) continue;

    const inNx = inX / inLength;
    const inNy = inY / inLength;
    const outNx = outX / outLength;
    const outNy = outY / outLength;
    const cross = inNx * outNy - inNy * outNx;
    if (Math.abs(cross) < 0.001) continue;

    const cornerRadius = Math.min(radius, inLength / 2, outLength / 2);
    const startX = current.x - inNx * cornerRadius;
    const startY = current.y - inNy * cornerRadius;
    const endX = current.x + outNx * cornerRadius;
    const endY = current.y + outNy * cornerRadius;
    const sweep = cross > 0 ? 1 : 0;

    if (!commands.length) {
      commands.push(`M ${formatOutlineCoord(startX)} ${formatOutlineCoord(startY)}`);
    } else {
      commands.push(`L ${formatOutlineCoord(startX)} ${formatOutlineCoord(startY)}`);
    }
    commands.push(
      `A ${formatOutlineCoord(cornerRadius)} ${formatOutlineCoord(cornerRadius)} 0 0 ${sweep} ${formatOutlineCoord(endX)} ${formatOutlineCoord(endY)}`
    );
  }

  if (!commands.length) return "";
  commands.push("Z");
  return commands.join(" ");
}

/**
 * SVG path for the rounded union of axis-aligned rectangles (grid selection blob).
 * Convex corners sweep clockwise; re-entrant corners sweep the other way.
 *
 * @param {{ x: number, y: number, width: number, height: number }[]} rects
 * @param {number} [radius]
 */
export function roundedUnionOutlinePath(rects, radius = GRID_SELECTION_RADIUS) {
  if (!rects?.length) return "";
  return unionOutlineLoops(rects)
    .map((loop) => roundedLoopPath(loop, radius))
    .filter(Boolean)
    .join(" ");
}

function canDrawGridSelectionOutline(listEl) {
  return (
    typeof document !== "undefined" &&
    typeof listEl.getBoundingClientRect === "function" &&
    typeof listEl.appendChild === "function" &&
    typeof listEl.querySelector === "function"
  );
}

function clearGridSelectionOutline(listEl) {
  listEl.classList?.remove?.("is-selection-outlined");
  listEl.querySelector?.(`:scope > svg.${GRID_SELECTION_OUTLINE_CLASS}`)?.remove?.();
}

function disconnectGridSelectionOutlineObserver(listEl) {
  const observer = gridSelectionOutlineObservers.get(listEl);
  if (!observer) return;
  observer.disconnect();
  gridSelectionOutlineObservers.delete(listEl);
}

function ensureGridSelectionOutlineSvg(listEl) {
  let svg = listEl.querySelector(`:scope > svg.${GRID_SELECTION_OUTLINE_CLASS}`);
  if (svg) return svg;
  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add(GRID_SELECTION_OUTLINE_CLASS);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.append(path);
  listEl.append(svg);
  return svg;
}

function drawGridSelectionOutline(listEl, items) {
  if (!canDrawGridSelectionOutline(listEl)) return false;
  if (!items.length || !listEl.clientWidth || !listEl.clientHeight) {
    clearGridSelectionOutline(listEl);
    return false;
  }

  const listRect = listEl.getBoundingClientRect();
  const offsetX = listRect.left + (listEl.clientLeft || 0);
  const offsetY = listRect.top + (listEl.clientTop || 0);
  const rects = items.map((item) => {
    const rect = item.getBoundingClientRect();
    return {
      x: rect.left - offsetX,
      y: rect.top - offsetY,
      width: rect.width,
      height: rect.height,
    };
  });
  const pathData = roundedUnionOutlinePath(rects, GRID_SELECTION_RADIUS);
  if (!pathData) {
    clearGridSelectionOutline(listEl);
    return false;
  }

  const svg = ensureGridSelectionOutlineSvg(listEl);
  svg.setAttribute("viewBox", `0 0 ${listEl.clientWidth} ${listEl.clientHeight}`);
  svg.querySelector("path")?.setAttribute("d", pathData);
  listEl.classList.add("is-selection-outlined");
  return true;
}

function observeGridSelectionOutline(listEl, itemSelector) {
  if (typeof ResizeObserver === "undefined") return;
  if (gridSelectionOutlineObservers.has(listEl)) return;
  const observer = new ResizeObserver(() => {
    syncListGridSelectionJoins(listEl, itemSelector);
  });
  observer.observe(listEl);
  gridSelectionOutlineObservers.set(listEl, observer);
}

/**
 * Join selected cells in a grid popup list into one continuous outline.
 * Adds join / corner classes for fill fallback, then paints a rounded SVG stroke
 * that handles both outer and re-entrant corners.
 */
export function syncListGridSelectionJoins(listEl, itemSelector) {
  if (!listEl || !itemSelector) return;
  clearGridSelectionJoinClasses(listEl, itemSelector);
  if (!isPopupListGrid(listEl)) {
    clearGridSelectionOutline(listEl);
    disconnectGridSelectionOutlineObserver(listEl);
    return;
  }

  const cols = getListGridColumns(listEl);
  const slots = buildListGridSlots(listEl, itemSelector, cols);

  const selectedIndexes = new Set(
    slots.filter(({ item }) => isListItemSelected(item)).map(({ index }) => index)
  );
  if (!selectedIndexes.size) {
    clearGridSelectionOutline(listEl);
    return;
  }

  const slotAt = (row, col) =>
    slots.find((slot) => slot.row === row && slot.col === col) ?? null;

  const slotSelected = (row, col) => {
    const slot = slotAt(row, col);
    return Boolean(slot && selectedIndexes.has(slot.index));
  };

  for (const { item, col, row, index } of slots) {
    if (!selectedIndexes.has(index)) continue;

    const joinTop = slotSelected(row - 1, col);
    const joinRight = slotSelected(row, col + 1);
    const joinBottom = slotSelected(row + 1, col);
    const joinLeft = slotSelected(row, col - 1);

    if (joinTop) item.classList.add("is-selection-join-top");
    if (joinRight) item.classList.add("is-selection-join-right");
    if (joinBottom) item.classList.add("is-selection-join-bottom");
    if (joinLeft) item.classList.add("is-selection-join-left");

    if (!joinTop && !joinLeft) item.classList.add("is-selection-corner-tl");
    if (!joinTop && !joinRight) item.classList.add("is-selection-corner-tr");
    if (!joinBottom && !joinLeft) item.classList.add("is-selection-corner-bl");
    if (!joinBottom && !joinRight) item.classList.add("is-selection-corner-br");
  }

  const selectedItems = slots
    .filter(({ index }) => selectedIndexes.has(index))
    .map(({ item }) => item);
  drawGridSelectionOutline(listEl, selectedItems);
  observeGridSelectionOutline(listEl, itemSelector);
}

/**
 * Toggle grid layout on a popup list (`.dropdown-menu` or `.combobox-list`).
 * Group headers, separators, and empty states span the full list width in grid mode.
 *
 * @param {ReturnType<typeof resolveListGridConfig>} [config]
 */
export function syncPopupListGrid(listEl, containerEl, itemSelector, config) {
  const listKind = listEl?.classList.contains("dropdown-menu")
    ? "dropdown-menu"
    : listEl?.classList.contains("combobox-list")
      ? "combobox-list"
      : null;
  if (!listKind) return false;

  const resolved = config ?? resolveListGridConfig(containerEl, {});
  const itemCount = countListGridItems(listEl, itemSelector);
  const useGrid = resolved.enabled && itemCount > resolved.min;
  const gridClass = POPUP_LIST_GRID_CLASS[listKind];

  listEl.classList.toggle(gridClass, useGrid);
  if (useGrid) {
    /* Prefer a data attribute over an inline custom property so CSS media
       queries (e.g. also-see narrow single-column) can override the count. */
    listEl.dataset.gridCols = String(resolved.cols);
    listEl.style.removeProperty("--dropdown-menu-grid-cols");
  } else {
    delete listEl.dataset.gridCols;
    listEl.style.removeProperty("--dropdown-menu-grid-cols");
  }

  syncListGridSelectionJoins(listEl, itemSelector);

  return useGrid;
}

/**
 * Toggle `.dropdown-menu--grid` when a dropdown has more than `min` items.
 *
 * @param {ReturnType<typeof resolveListGridConfig>} [config]
 */
export function syncDropdownMenuGrid(menuEl, containerEl, itemSelector, config) {
  return syncPopupListGrid(menuEl, containerEl, itemSelector, config);
}

/** @deprecated Alias for {@link syncPopupListGrid}. */
export const syncComboboxListGrid = syncPopupListGrid;

export function getListGridColumns(listEl) {
  if (typeof getComputedStyle === "function" && listEl) {
    const computed = Number.parseInt(
      getComputedStyle(listEl).getPropertyValue("--dropdown-menu-grid-cols"),
      10,
    );
    if (Number.isFinite(computed) && computed >= 1) return computed;
  }
  const fromData = Number.parseInt(listEl?.dataset?.gridCols ?? "", 10);
  if (Number.isFinite(fromData) && fromData >= 1) return fromData;
  const fromInline = Number.parseInt(
    listEl?.style?.getPropertyValue?.("--dropdown-menu-grid-cols") ?? "",
    10,
  );
  if (Number.isFinite(fromInline) && fromInline >= 1) return fromInline;
  return DEFAULT_DROPDOWN_GRID_COLS;
}

/** @deprecated Alias for {@link getListGridColumns}. */
export const getDropdownGridColumns = getListGridColumns;

/**
 * Move within a grid of items. When `positions` is provided (from
 * {@link buildListGridSlots}), Up/Down stay in the visual column across
 * full-span group rows; otherwise items are treated as a dense `cols` matrix.
 *
 * @param {unknown[]} items
 * @param {number} currentIndex
 * @param {string} key
 * @param {number} cols
 * @param {{ row: number, col: number }[] | null | undefined} [positions]
 * @returns {number}
 */
export function gridMenuIndexForKey(items, currentIndex, key, cols, positions) {
  const len = items.length;
  if (currentIndex < 0) return 0;

  const columnCount =
    Number.isFinite(cols) && cols >= 1 ? Math.trunc(cols) : DEFAULT_DROPDOWN_GRID_COLS;
  const posFor = (index) => {
    const fromSlots = positions?.[index];
    if (fromSlots && Number.isFinite(fromSlots.row) && Number.isFinite(fromSlots.col)) {
      return { row: fromSlots.row, col: fromSlots.col };
    }
    return {
      row: Math.floor(index / columnCount),
      col: index % columnCount,
    };
  };

  const { col, row } = posFor(currentIndex);

  switch (key) {
    case "ArrowRight":
      return currentIndex < len - 1 ? currentIndex + 1 : currentIndex;
    case "ArrowLeft":
      return currentIndex > 0 ? currentIndex - 1 : currentIndex;
    case "ArrowDown": {
      let best = -1;
      let bestRow = Infinity;
      for (let i = 0; i < len; i += 1) {
        const next = posFor(i);
        if (next.col === col && next.row > row && next.row < bestRow) {
          best = i;
          bestRow = next.row;
        }
      }
      return best >= 0 ? best : currentIndex;
    }
    case "ArrowUp": {
      let best = -1;
      let bestRow = -Infinity;
      for (let i = 0; i < len; i += 1) {
        const prev = posFor(i);
        if (prev.col === col && prev.row < row && prev.row > bestRow) {
          best = i;
          bestRow = prev.row;
        }
      }
      return best >= 0 ? best : currentIndex;
    }
    default:
      return currentIndex;
  }
}

/** Primary label for a menu item (ignores `.dropdown-menu-item-subtitle`). */
export function menuItemLabel(item) {
  if (!item) return "";
  return (
    item.querySelector(".dropdown-menu-item-label")?.textContent.trim() ??
    item.textContent.trim()
  );
}

/**
 * Shared open/close behaviour for anchored popup menus (combo chevron, dropdown).
 *
 * Only one popup menu is open at a time: opening one closes any other.
 *
 * @param {object} options
 * @param {boolean} [options.fixed=false] Position with `position: fixed` so the
 *   menu escapes overflow clipping (e.g. inside `.table-wrap`).
 * @param {"start" | "end"} [options.fixedAlign="start"] Horizontal align to the
 *   toggle when `fixed` is true (`end` = right edges line up).
 * @param {number | false} [options.gridMin] Item-count threshold before grid
 *   layout; a number enables auto grid and overrides `data-dropdown-grid*`.
 *   Pass `false` to force a single-column list.
 * @param {number} [options.gridCols] Column count in grid mode (overrides markup).
 */
export function initPopupMenu({
  containerEl,
  menuEl,
  toggleEl,
  itemSelector,
  onSelect,
  closeOnSelect = true,
  fixed = false,
  fixedAlign = "start",
  gridMin,
  gridCols,
}) {
  if (!containerEl || !menuEl) return null;

  let isOpen = false;
  const gridOverrides = {};
  if (gridMin !== undefined) gridOverrides.gridMin = gridMin;
  if (gridCols !== undefined) gridOverrides.gridCols = gridCols;

  function getGridConfig() {
    return resolveDropdownGridConfig(containerEl, gridOverrides);
  }

  function getItems() {
    return [...menuEl.querySelectorAll(itemSelector)].filter((item) => {
      if (item.disabled) return false;
      // `position: fixed` items have a null offsetParent — use layout boxes instead.
      if (item.offsetParent !== null) return true;
      return item.getClientRects().length > 0;
    });
  }

  function focusItem(item) {
    if (item instanceof HTMLElement) item.focus();
  }

  function focusFirstItem() {
    const items = getItems();
    if (items.length) focusItem(items[0]);
  }

  function setContainerOpen(open) {
    containerEl?.classList.toggle("is-popup-open", open);
  }

  function clearFixedPosition() {
    if (!fixed) return;
    menuEl.style.position = "";
    menuEl.style.top = "";
    menuEl.style.left = "";
    menuEl.style.right = "";
    menuEl.style.bottom = "";
    menuEl.style.zIndex = "";
    menuEl.style.width = "";
    menuEl.style.minWidth = "";
    menuEl.style.maxHeight = "";
    menuEl.style.overflowY = "";
  }

  function positionFixedMenu() {
    if (!fixed || !toggleEl) return;
    const rect = toggleEl.getBoundingClientRect();
    const gap = 4;
    const viewportPadding = 8;
    const viewportWidth = document.documentElement.clientWidth;

    menuEl.style.position = "fixed";
    menuEl.style.zIndex = "200";
    menuEl.style.bottom = "auto";
    menuEl.style.width = "max-content";
    // Percentage min-width is viewport-relative when position is fixed.
    menuEl.style.minWidth = `${rect.width}px`;
    menuEl.style.maxHeight = "";
    menuEl.style.overflowY = "";
    menuEl.style.top = `${rect.bottom + gap}px`;

    if (fixedAlign === "end") {
      menuEl.style.left = "auto";
      menuEl.style.right = `${viewportWidth - rect.right}px`;
    } else {
      menuEl.style.right = "auto";
      menuEl.style.left = `${rect.left}px`;
    }

    const menuRect = menuEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    if (menuRect.height > spaceBelow && spaceAbove > spaceBelow) {
      menuEl.style.top = `${Math.max(viewportPadding, rect.top - menuRect.height - gap)}px`;
    }

    const top = Number.parseFloat(menuEl.style.top) || viewportPadding;
    const maxHeight = window.innerHeight - top - viewportPadding;
    if (menuEl.getBoundingClientRect().height > maxHeight) {
      menuEl.style.maxHeight = `${Math.max(8 * 16, maxHeight)}px`;
      menuEl.style.overflowY = "auto";
    }

    const placed = menuEl.getBoundingClientRect();
    if (placed.left < viewportPadding) {
      menuEl.style.right = "auto";
      menuEl.style.left = `${viewportPadding}px`;
    } else if (placed.right > viewportWidth - viewportPadding) {
      menuEl.style.left = "auto";
      menuEl.style.right = `${viewportPadding}px`;
    }
  }

  /**
   * @param {{ restoreFocus?: boolean }} [options]
   */
  function closeMenu({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    unregisterOpenPopup(closeMenu);
    setContainerOpen(false);
    setHidden(menuEl, true);
    clearFixedPosition();
    toggleEl?.setAttribute("aria-expanded", "false");
    if (restoreFocus && toggleEl?.isConnected) {
      toggleEl.focus();
    }
  }

  function syncMenuGrid() {
    return syncDropdownMenuGrid(menuEl, containerEl, itemSelector, getGridConfig());
  }

  syncMenuGrid();

  function openMenu() {
    isOpen = true;
    registerOpenPopup(closeMenu);
    setContainerOpen(true);
    setHidden(menuEl, false);
    syncMenuGrid();
    toggleEl?.setAttribute("aria-expanded", "true");
    positionFixedMenu();
    focusFirstItem();
  }

  function toggleMenu() {
    if (isOpen) closeMenu();
    else openMenu();
  }

  function activateItem(item) {
    // Close the panel before onSelect so handlers can tear down the DOM, but
    // defer focus restore until afterward — focusing a trigger that is about
    // to be destroyed (e.g. remove column) would flash its tooltip.
    if (closeOnSelect) {
      closeMenu({ restoreFocus: false });
    }
    onSelect?.({
      containerEl,
      item,
      value: item.dataset.value,
      label: menuItemLabel(item),
    });
    if (closeOnSelect && toggleEl?.isConnected) {
      toggleEl.focus();
    }
  }

  function onToggleClick(e) {
    e.stopPropagation();
    toggleMenu();
  }

  function onMenuClick(e) {
    const item = e.target.closest(itemSelector);
    if (!item) return;

    if (item instanceof HTMLAnchorElement) {
      // Modified clicks: let the browser open a new tab; only close the menu.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        if (closeOnSelect) {
          closeMenu({ restoreFocus: false });
        }
        return;
      }
      // Plain primary click: onSelect handles navigation (e.g. same window).
      e.preventDefault();
    }

    activateItem(item);
  }

  function onMenuKeydown(e) {
    if (!isOpen) return;

    const items = getItems();
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex = currentIndex;

    const gridMode = menuEl.classList.contains("dropdown-menu--grid");
    const gridCols = gridMode ? getDropdownGridColumns(menuEl) : 0;
    const gridSlots = gridMode
      ? buildListGridSlots(menuEl, itemSelector, gridCols)
      : null;
    const gridPositions = gridSlots?.map(({ row, col }) => ({ row, col }));

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (gridMode) {
        nextIndex =
          currentIndex < 0
            ? 0
            : gridMenuIndexForKey(
                items,
                currentIndex,
                "ArrowDown",
                gridCols,
                gridPositions,
              );
      } else {
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      }
      focusItem(items[nextIndex]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (gridMode) {
        nextIndex =
          currentIndex < 0
            ? items.length - 1
            : gridMenuIndexForKey(
                items,
                currentIndex,
                "ArrowUp",
                gridCols,
                gridPositions,
              );
      } else {
        nextIndex =
          currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      }
      focusItem(items[nextIndex]);
    } else if (
      gridMode &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight")
    ) {
      e.preventDefault();
      nextIndex =
        currentIndex < 0
          ? 0
          : gridMenuIndexForKey(
              items,
              currentIndex,
              e.key,
              gridCols,
              gridPositions,
            );
      focusItem(items[nextIndex]);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(items[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items[items.length - 1]);
    } else if (e.key === "Enter" || e.key === " ") {
      const item = document.activeElement?.closest?.(itemSelector);
      if (!item || !menuEl.contains(item)) return;
      e.preventDefault();
      activateItem(item);
    }
  }

  function onViewportChange() {
    if (isOpen) closeMenu();
  }

  toggleEl?.addEventListener("click", onToggleClick);
  menuEl.addEventListener("click", onMenuClick);
  menuEl.addEventListener("keydown", onMenuKeydown);

  if (fixed) {
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
  }

  const removeClickOutside = onDocumentClickOutside((e) => {
    if (!containerEl.contains(e.target)) closeMenu();
  });

  const removeEscape = onDocumentEscape(() => {
    if (!isOpen) return false;
    closeMenu();
    return true;
  }, { priority: 50 });

  return {
    closeMenu,
    openMenu,
    toggleMenu,
    isOpen: () => isOpen,
    syncMenuGrid,
    getGridConfig,
    /** @param {number | false} min */
    setGridMin(min) {
      gridOverrides.gridMin = min;
      return syncMenuGrid();
    },
    /** @param {number} cols */
    setGridCols(cols) {
      gridOverrides.gridCols = cols;
      return syncMenuGrid();
    },
    destroy() {
      unregisterOpenPopup(closeMenu);
      setContainerOpen(false);
      toggleEl?.removeEventListener("click", onToggleClick);
      menuEl.removeEventListener("click", onMenuClick);
      menuEl.removeEventListener("keydown", onMenuKeydown);
      if (fixed) {
        window.removeEventListener("scroll", onViewportChange, true);
        window.removeEventListener("resize", onViewportChange);
      }
      clearFixedPosition();
      removeClickOutside();
      removeEscape();
    },
  };
}

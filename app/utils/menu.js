import { setHidden } from "./dom.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
  registerOpenPopup,
  unregisterOpenPopup,
} from "./document-listeners.js";

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
}) {
  if (!containerEl || !menuEl) return null;

  let isOpen = false;

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

  function openMenu() {
    isOpen = true;
    registerOpenPopup(closeMenu);
    setContainerOpen(true);
    setHidden(menuEl, false);
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

    if (e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      focusItem(items[nextIndex]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex =
        currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
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

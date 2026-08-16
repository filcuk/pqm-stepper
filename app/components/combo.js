import { initPopupMenu } from "../utils/menu.js";

export function initCombo(comboEl, { onMainClick, onSelect } = {}) {
  if (!comboEl) return null;

  const mainBtn = comboEl.querySelector(".combo-btn-main");
  const toggleBtn = comboEl.querySelector(".combo-btn-toggle");
  const menu = comboEl.querySelector(".combo-menu");

  const menuControl = initPopupMenu({
    containerEl: comboEl,
    menuEl: menu,
    toggleEl: toggleBtn,
    itemSelector: ".combo-menu-item",
    onSelect: (detail) => onSelect?.({ comboEl, ...detail }),
  });

  if (!menuControl) return null;

  const onMainBtnClick = () => {
    menuControl.closeMenu();
    onMainClick?.({
      comboEl,
      mainBtn,
      menuItems: menu ? [...menu.querySelectorAll(".combo-menu-item")] : [],
    });
  };

  mainBtn?.addEventListener("click", onMainBtnClick);

  return {
    ...menuControl,
    destroy() {
      mainBtn?.removeEventListener("click", onMainBtnClick);
      menuControl.destroy();
    },
  };
}

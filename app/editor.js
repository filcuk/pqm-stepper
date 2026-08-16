/**
 * Selection helpers for the read-only output pane.
 */

export function selectElementContents(root) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(root);
  selection.removeAllRanges();
  selection.addRange(range);
}

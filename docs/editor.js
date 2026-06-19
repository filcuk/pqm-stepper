/**
 * Caret helpers for contenteditable code editors.
 */

export function saveCaretOffset(root) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function restoreCaretOffset(root, offset) {
  const sel = window.getSelection();
  if (!sel) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node;

  while ((node = walker.nextNode())) {
    const next = count + node.length;
    if (next >= offset) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, offset - count));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    count = next;
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function readPlainText(el) {
  return el.innerText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function countLines(text) {
  if (!text) return 1;
  return text.split("\n").length;
}

export function lineNumbersText(text) {
  const count = countLines(text);
  return Array.from({ length: count }, (_, i) => i + 1).join("\n");
}

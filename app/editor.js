/**
 * Caret helpers for contenteditable code editors.
 */

export function saveCaretOffset(root) {
  return getSelectionOffsets(root).start;
}

export function getSelectionOffsets(root) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return { start: 0, end: 0 };

  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return { start: 0, end: 0 };

  const start = measureOffset(root, range.startContainer, range.startOffset);
  const end = measureOffset(root, range.endContainer, range.endOffset);

  return start <= end ? { start, end } : { start: end, end: start };
}

function measureOffset(root, container, offset) {
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(container, offset);
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

export function selectElementContents(root) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(root);
  selection.removeAllRanges();
  selection.addRange(range);
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

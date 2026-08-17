/**
 * Clipboard helpers with insecure-context / permission fallbacks.
 *
 * Prefer the Clipboard API in a secure context; fall back to `execCommand("copy")`
 * for write, and a one-shot document `paste` capture for read when needed.
 */

import { onDocumentEscape } from "./document-listeners.js";

/**
 * Copy plain text to the clipboard.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  /* focus()/select() otherwise scroll the viewport to the temp node (jump up). */
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();

  if (previouslyFocused?.isConnected) {
    previouslyFocused.focus({ preventScroll: true });
  }
  if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
    window.scrollTo(scrollX, scrollY);
  }
  return ok;
}

/**
 * Read plain text from the clipboard (Clipboard API only).
 * Returns `null` when unavailable or denied (caller may use `armPasteCapture`).
 * @returns {Promise<string | null>}
 */
export async function readText() {
  if (!window.isSecureContext || !navigator.clipboard) return null;

  if (typeof navigator.clipboard.readText === "function") {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // NotAllowedError / permission — try read() or paste-event fallback.
    }
  }

  if (typeof navigator.clipboard.read === "function") {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (!item.types.includes("text/plain")) continue;
        const blob = await item.getType("text/plain");
        return await blob.text();
      }
      return "";
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Arm a one-shot document `paste` listener (e.g. after Clipboard read fails).
 * Resolves with clipboard text, or `null` on Escape, timeout, or `cancel()`.
 *
 * @param {{ timeoutMs?: number }} [options]
 * @returns {{ promise: Promise<string | null>, cancel: () => void }}
 */
export function armPasteCapture({ timeoutMs = 15000 } = {}) {
  let finished = false;
  /** @type {(() => void) | null} */
  let runCleanup = null;

  /** @type {(value: string | null) => void} */
  let settle = () => {};

  const promise = new Promise((resolve) => {
    settle = resolve;
  });

  /**
   * @param {string | null} value
   */
  function finish(value) {
    if (finished) return;
    finished = true;
    runCleanup?.();
    runCleanup = null;
    settle(value);
  }

  /** @param {ClipboardEvent} event */
  function onPaste(event) {
    const next = event.clipboardData?.getData("text/plain") ?? "";
    event.preventDefault();
    event.stopImmediatePropagation();
    finish(next);
  }

  const removeEscape = onDocumentEscape(() => {
    finish(null);
    return true;
  }, { priority: 60 });

  const timer = window.setTimeout(() => {
    finish(null);
  }, timeoutMs);

  runCleanup = () => {
    window.clearTimeout(timer);
    document.removeEventListener("paste", onPaste, true);
    removeEscape();
  };

  document.addEventListener("paste", onPaste, true);

  return {
    promise,
    cancel() {
      finish(null);
    },
  };
}

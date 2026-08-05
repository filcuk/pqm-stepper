/** Shared Power Query M parsing helpers. */

export const QUOTED_TOKEN_RE = /#"([^"]+)"/g;

export const STEP_DECL_RE =
  /(?:^|\n)\s*(?:(#"([^"]+)")|([A-Za-z_][A-Za-z0-9_]*))\s*=/gm;

/** @typedef {0 | 1 | 2 | 3} MSpanKind */
export const M_SPAN_CODE = 0;
export const M_SPAN_STRING = 1;
export const M_SPAN_COMMENT = 2;
export const M_SPAN_QUOTED_ID = 3;

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Classify each character as code, string literal, comment, or quoted identifier.
 * String literals use `""` as an escaped quote. Quoted identifiers are `#"..."`.
 * @param {string} text
 * @returns {Uint8Array}
 */
export function buildMContextMask(text) {
  const mask = new Uint8Array(text.length);
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "/" && next === "/") {
      const start = i;
      i += 2;
      while (i < text.length && text[i] !== "\n") i++;
      mask.fill(M_SPAN_COMMENT, start, i);
      continue;
    }

    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      if (i < text.length) i += 2;
      mask.fill(M_SPAN_COMMENT, start, i);
      continue;
    }

    if (ch === "#" && next === '"') {
      const start = i;
      i += 2;
      while (i < text.length && text[i] !== '"') i++;
      if (i < text.length) i++;
      mask.fill(M_SPAN_QUOTED_ID, start, i);
      continue;
    }

    if (ch === '"') {
      const start = i;
      i++;
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (text[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      mask.fill(M_SPAN_STRING, start, i);
      continue;
    }

    mask[i] = M_SPAN_CODE;
    i++;
  }

  return mask;
}

/** True if index is inside a string literal or comment. */
export function isProtectedLiteral(mask, index) {
  const kind = mask[index];
  return kind === M_SPAN_STRING || kind === M_SPAN_COMMENT;
}

/** True if every index in [start, end) is ordinary code (not string/comment/quoted-id). */
export function isCodeRange(mask, start, end) {
  for (let i = start; i < end; i++) {
    if (mask[i] !== M_SPAN_CODE) return false;
  }
  return true;
}

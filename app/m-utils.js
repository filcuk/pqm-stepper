/** Shared Power Query M parsing helpers. */

export const QUOTED_TOKEN_RE = /#"([^"]+)"/g;

/** @deprecated Prefer findStepDeclarations — kept for callers that only need a rough pattern. */
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

/** Word-boundary keyword match at index (case-insensitive). */
export function isKeywordAt(text, index, keyword) {
  const len = keyword.length;
  if (index + len > text.length) return false;
  if (text.slice(index, index + len).toLowerCase() !== keyword.toLowerCase()) {
    return false;
  }
  const before = index === 0 ? "" : text[index - 1];
  const after = index + len < text.length ? text[index + len] : "";
  if (/[A-Za-z0-9_]/.test(before)) return false;
  if (/[A-Za-z0-9_]/.test(after)) return false;
  return true;
}

function skipWs(text, mask, i) {
  while (i < text.length) {
    if (mask[i] === M_SPAN_COMMENT) {
      i++;
      continue;
    }
    if (mask[i] === M_SPAN_CODE && /\s/.test(text[i])) {
      i++;
      continue;
    }
    break;
  }
  return i;
}

/**
 * Read a step declaration (quoted or regular) at or after index.
 * @returns {{ name: string, isQuoted: boolean, token: string, tokenStart: number, eqIndex: number, end: number } | null}
 */
function tryReadDecl(text, mask, index) {
  let i = skipWs(text, mask, index);
  if (i >= text.length) return null;

  if (mask[i] === M_SPAN_QUOTED_ID && text[i] === "#" && text[i + 1] === '"') {
    const tokenStart = i;
    i += 2;
    const nameStart = i;
    while (i < text.length && text[i] !== '"') i++;
    if (i >= text.length) return null;
    const name = text.slice(nameStart, i);
    i++; // closing "
    const afterName = skipWs(text, mask, i);
    if (afterName >= text.length || text[afterName] !== "=") return null;
    if (mask[afterName] !== M_SPAN_CODE) return null;
    return {
      name,
      isQuoted: true,
      token: text.slice(tokenStart, i),
      tokenStart,
      eqIndex: afterName,
      end: afterName + 1,
    };
  }

  if (mask[i] === M_SPAN_CODE && /[A-Za-z_]/.test(text[i])) {
    const tokenStart = i;
    i++;
    while (i < text.length && mask[i] === M_SPAN_CODE && /[A-Za-z0-9_]/.test(text[i])) {
      i++;
    }
    const name = text.slice(tokenStart, i);
    const afterName = skipWs(text, mask, i);
    if (afterName >= text.length || text[afterName] !== "=") return null;
    if (mask[afterName] !== M_SPAN_CODE) return null;
    return {
      name,
      isQuoted: false,
      token: name,
      tokenStart,
      eqIndex: afterName,
      end: afterName + 1,
    };
  }

  return null;
}

/**
 * Collect bindings from a `let` body starting just after the `let` keyword.
 * Nested `let` expressions are skipped (not returned as steps).
 */
function collectBindingsFromLet(text, mask, startAfterLet) {
  const steps = [];
  let i = startAfterLet;
  let depth = 0;
  let expectBinding = true;

  while (i < text.length) {
    if (mask[i] !== M_SPAN_CODE) {
      i++;
      continue;
    }

    if (depth === 0 && isKeywordAt(text, i, "in")) {
      return { steps, afterIn: i + 2 };
    }

    if (!expectBinding && depth === 0 && isKeywordAt(text, i, "let")) {
      const nested = collectBindingsFromLet(text, mask, i + 3);
      i = nested.afterIn;
      continue;
    }

    if (expectBinding && depth === 0) {
      const decl = tryReadDecl(text, mask, i);
      if (decl) {
        steps.push(decl);
        i = decl.end;
        expectBinding = false;
        continue;
      }
    }

    const ch = text[i];
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
    } else if (ch === "," && depth === 0) {
      expectBinding = true;
    }
    i++;
  }

  return { steps, afterIn: i };
}

/** Advance past a nested `let` … `in` starting just after the `let` keyword. */
export function indexAfterLetIn(text, mask, startAfterLet) {
  return collectBindingsFromLet(text, mask, startAfterLet).afterIn;
}

/**
 * Find step declarations in `let`…`in` blocks (including same-line).
 * Falls back to start-of-line declarations when no `let` bindings are found.
 * @returns {{ name: string, isQuoted: boolean, token: string, tokenStart: number, eqIndex: number }[]}
 */
export function findStepDeclarations(text) {
  const mask = buildMContextMask(text);
  const steps = [];
  let i = 0;

  while (i < text.length) {
    if (mask[i] !== M_SPAN_CODE) {
      i++;
      continue;
    }
    if (isKeywordAt(text, i, "let")) {
      const { steps: bindings, afterIn } = collectBindingsFromLet(
        text,
        mask,
        i + 3
      );
      steps.push(...bindings);
      i = afterIn;
      continue;
    }
    i++;
  }

  if (steps.length > 0) return steps;

  // Best-effort: newline-anchored declarations (no let block).
  STEP_DECL_RE.lastIndex = 0;
  let match;
  while ((match = STEP_DECL_RE.exec(text)) !== null) {
    const token = match[1] || match[3];
    const tokenStart = match.index + match[0].indexOf(token);
    if (isProtectedLiteral(mask, tokenStart)) continue;
    const afterToken = skipWs(text, mask, tokenStart + token.length);
    if (afterToken >= text.length || text[afterToken] !== "=") continue;
    if (match[2]) {
      steps.push({
        name: match[2],
        isQuoted: true,
        token,
        tokenStart,
        eqIndex: afterToken,
      });
    } else if (match[3]) {
      steps.push({
        name: match[3],
        isQuoted: false,
        token,
        tokenStart,
        eqIndex: afterToken,
      });
    }
  }

  return steps;
}

/** True if a `let` keyword appears in code (not strings/comments). */
export function hasLetKeyword(text) {
  const mask = buildMContextMask(text);
  for (let i = 0; i < text.length; i++) {
    if (mask[i] === M_SPAN_CODE && isKeywordAt(text, i, "let")) return true;
  }
  return false;
}

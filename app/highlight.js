import { parseSteps } from "./transform.js";
import { QUOTED_TOKEN_RE, STEP_DECL_RE, escapeRegExp } from "./m-utils.js";

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getPrism() {
  return typeof globalThis.Prism !== "undefined" ? globalThis.Prism : null;
}

/**
 * Collect step names for highlighting.
 */
function collectStepNames(mCode) {
  const steps = parseSteps(mCode);
  const quoted = new Set();
  const regular = new Set();

  for (const step of steps) {
    if (step.isQuoted) quoted.add(step.name);
    else regular.add(step.name);
  }

  for (const match of mCode.matchAll(QUOTED_TOKEN_RE)) {
    quoted.add(match[1]);
  }

  return { quoted, regular };
}

function getDeclarationRanges(text) {
  const ranges = [];

  STEP_DECL_RE.lastIndex = 0;
  let match;
  while ((match = STEP_DECL_RE.exec(text)) !== null) {
    const token = match[1] || match[3];
    const tokenStart = match.index + match[0].indexOf(token);
    ranges.push({ start: tokenStart, end: tokenStart + token.length });
  }

  return ranges;
}

function overlapsDeclaration(start, end, declRanges) {
  return declRanges.some((d) => start < d.end && end > d.start);
}

const REF_BEFORE = /[(,\[\{\s=]/;
const REF_AFTER = /[),\]\}\s,=]/;

function isInsideString(text, index) {
  let inString = false;
  let i = 0;
  while (i < index) {
    if (text[i] === "#" && text[i + 1] === '"') {
      i += 2;
      while (i < text.length && text[i] !== '"') i++;
      if (i < text.length) i++;
      continue;
    }
    if (text[i] === '"') {
      inString = !inString;
    }
    i++;
  }
  return inString;
}

function isStepReference(text, start, end, declRanges) {
  if (overlapsDeclaration(start, end, declRanges)) {
    return true;
  }

  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";

  if (before === "." || after === ".") return false;
  if (before === "#") return false;
  if (isInsideString(text, start)) return false;

  const validBefore = start === 0 || REF_BEFORE.test(before);
  const validAfter = end === text.length || REF_AFTER.test(after);
  return validBefore && validAfter;
}

function addRegularMatches(text, name, isRenamed, declRanges, ranges) {
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!isStepReference(text, start, end, declRanges)) continue;
    ranges.push({
      start,
      end,
      class: classForOccurrence(start, end, isRenamed, declRanges),
    });
  }
}

function classForOccurrence(start, end, isRenamed, declRanges) {
  const isDefinition = overlapsDeclaration(start, end, declRanges);
  if (isRenamed) {
    return isDefinition ? "hl-green" : "hl-red";
  }
  return isDefinition ? "hl-blue" : "hl-amber";
}

/**
 * Build highlight ranges for step names.
 * @param {"input"|"output"} mode
 */
function buildStepRanges(text, mode, renames) {
  const { quoted, regular } = collectStepNames(text);
  const declRanges = getDeclarationRanges(text);
  const ranges = [];

  const quotedAmber = mode === "input" ? renames?.fromQuoted : null;
  const regularAmber = mode === "input" ? renames?.fromRegular : renames?.to;
  const outputAmber = mode === "output" ? renames?.to : null;

  for (const match of text.matchAll(QUOTED_TOKEN_RE)) {
    const inner = match[1];
    const start = match.index;
    const end = start + match[0].length;
    const isRenamed = mode === "input" ? quotedAmber?.has(inner) : false;

    ranges.push({
      start,
      end,
      class: classForOccurrence(start, end, isRenamed, declRanges),
    });
  }

  const names = [...regular].sort((a, b) => b.length - a.length);
  for (const name of names) {
    const isRenamed =
      mode === "input"
        ? regularAmber?.has(name)
        : outputAmber?.has(name);

    addRegularMatches(text, name, isRenamed, declRanges, ranges);
  }

  if (mode === "output" && outputAmber) {
    for (const name of [...outputAmber].sort((a, b) => b.length - a.length)) {
      if (regular.has(name)) continue;
      addRegularMatches(text, name, true, declRanges, ranges);
    }
  }

  return mergeStepRanges(ranges, text.length);
}

function mergeStepRanges(ranges, textLength) {
  if (ranges.length === 0 || textLength === 0) return [];

  const classes = new Array(textLength).fill(null);

  for (const tier of ["hl-amber", "hl-blue", "hl-green", "hl-red"]) {
    for (const range of ranges) {
      if (range.class !== tier) continue;
      for (let i = range.start; i < range.end && i < textLength; i++) {
        classes[i] = tier;
      }
    }
  }

  const merged = [];
  let i = 0;
  while (i < textLength) {
    if (!classes[i]) {
      i++;
      continue;
    }
    const cls = classes[i];
    const start = i;
    while (i < textLength && classes[i] === cls) i++;
    merged.push({ start, end: i, class: cls });
  }

  return merged;
}

function tokenClassName(token) {
  const types = [token.type];
  if (token.alias) {
    const aliases = Array.isArray(token.alias) ? token.alias : [token.alias];
    types.push(...aliases);
  }
  return types.map((type) => `token ${type}`).join(" ");
}

/**
 * Map Prism tokenize output to character ranges with CSS classes.
 */
function prismSyntaxRanges(text) {
  const Prism = getPrism();
  const grammar = Prism?.languages?.powerquery;
  if (!grammar) return [];

  const ranges = [];
  let pos = 0;

  function walk(tokens) {
    for (const token of tokens) {
      if (typeof token === "string") {
        pos += token.length;
        continue;
      }

      const content = token.content;
      if (Array.isArray(content)) {
        walk(content);
        continue;
      }

      ranges.push({
        start: pos,
        end: pos + content.length,
        class: tokenClassName(token),
      });
      pos += content.length;
    }
  }

  walk(Prism.tokenize(text, grammar));
  return ranges;
}

function buildCombinedHtml(text, syntaxRanges, stepRanges) {
  const length = text.length;
  const syntax = new Array(length).fill("");
  const steps = new Array(length).fill("");

  for (const range of syntaxRanges) {
    for (let i = range.start; i < range.end && i < length; i++) {
      syntax[i] = range.class;
    }
  }
  for (const range of stepRanges) {
    for (let i = range.start; i < range.end && i < length; i++) {
      steps[i] = range.class;
    }
  }

  let html = "";
  let i = 0;
  while (i < length) {
    const syn = syntax[i];
    const stp = steps[i];
    let j = i + 1;
    while (j < length && syntax[j] === syn && steps[j] === stp) j++;

    const chunk = escapeHtml(text.slice(i, j));
    const classes = [syn, stp].filter(Boolean).join(" ");
    html += classes ? `<span class="${classes}">${chunk}</span>` : chunk;
    i = j;
  }

  return html;
}

function renderHighlighted(text, mode, renames, stepHighlightEnabled = true) {
  if (!text) return "";

  const stepRanges = stepHighlightEnabled
    ? buildStepRanges(text, mode, renames)
    : [];
  const syntaxRanges = prismSyntaxRanges(text);

  if (syntaxRanges.length === 0 && stepRanges.length === 0) {
    return escapeHtml(text);
  }

  if (syntaxRanges.length === 0) {
    return renderStepOnlyHtml(text, stepRanges);
  }

  return buildCombinedHtml(text, syntaxRanges, stepRanges);
}

function renderStepOnlyHtml(text, stepRanges) {
  let html = "";
  let pos = 0;

  for (const range of stepRanges) {
    if (range.start > pos) {
      html += escapeHtml(text.slice(pos, range.start));
    }
    html += `<span class="${range.class}">${escapeHtml(text.slice(range.start, range.end))}</span>`;
    pos = range.end;
  }

  html += escapeHtml(text.slice(pos));
  return html;
}

export { renderHighlighted };

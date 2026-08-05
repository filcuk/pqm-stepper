import { parseSteps } from "./transform.js";
import {
  QUOTED_TOKEN_RE,
  escapeRegExp,
  buildMContextMask,
  isProtectedLiteral,
} from "./m-utils.js";

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getPrism() {
  return typeof globalThis.Prism !== "undefined" ? globalThis.Prism : null;
}

function ensureJsonGrammar() {
  const Prism = getPrism();
  if (!Prism || Prism.languages.json) return Prism;

  Prism.languages.json = {
    property: {
      pattern: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
      greedy: true,
    },
    string: {
      pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
      greedy: true,
    },
    number: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
    punctuation: /[{}[\],]/,
    operator: /:/,
    boolean: /\b(?:false|true)\b/,
    null: {
      pattern: /\bnull\b/,
      alias: "keyword",
    },
  };

  return Prism;
}

function renderJsonHighlighted(text) {
  if (!text) return "";

  const Prism = ensureJsonGrammar();
  if (!Prism?.languages?.json) return escapeHtml(text);

  return Prism.highlight(text, Prism.languages.json, "json");
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
  return parseSteps(text).map((step) => ({
    start: step.tokenStart,
    end: step.tokenStart + step.token.length,
  }));
}

function overlapsDeclaration(start, end, declRanges) {
  return declRanges.some((d) => start < d.end && end > d.start);
}

const REF_BEFORE = /[(,\[\{\s=]/;
const REF_AFTER = /[),\]\}\s,=]/;

function isStepReference(text, start, end, declRanges, mask) {
  if (overlapsDeclaration(start, end, declRanges)) {
    return true;
  }

  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";

  if (before === "." || after === ".") return false;
  if (before === "#") return false;
  if (isProtectedLiteral(mask, start)) return false;

  const validBefore = start === 0 || REF_BEFORE.test(before);
  const validAfter = end === text.length || REF_AFTER.test(after);
  return validBefore && validAfter;
}

function addRegularMatches(text, name, mode, renamedTargets, declRanges, ranges, mask) {
  const isRenamed = mode === "output" && renamedTargets.has(name);
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!isStepReference(text, start, end, declRanges, mask)) continue;
    ranges.push({
      start,
      end,
      class: classForOccurrence(start, end, mode, declRanges, isRenamed),
    });
  }
}

function classForOccurrence(start, end, mode, declRanges, isRenamed = false) {
  const isDefinition = overlapsDeclaration(start, end, declRanges);
  if (mode === "input" || !isRenamed) {
    return isDefinition ? "hl-blue" : "hl-amber";
  }
  return isDefinition ? "hl-green" : "hl-red";
}

/**
 * Build highlight ranges for step names.
 * @param {"input"|"output"} mode
 */
function buildStepRanges(text, mode, renames) {
  const { regular } = collectStepNames(text);
  const declRanges = getDeclarationRanges(text);
  const mask = buildMContextMask(text);
  const ranges = [];
  const renamedTargets = renames?.to ?? new Set();

  for (const match of text.matchAll(QUOTED_TOKEN_RE)) {
    const start = match.index;
    const end = start + match[0].length;
    if (isProtectedLiteral(mask, start)) continue;
    ranges.push({
      start,
      end,
      class: classForOccurrence(start, end, mode, declRanges, false),
    });
  }

  const names = [...regular].sort((a, b) => b.length - a.length);
  for (const name of names) {
    addRegularMatches(text, name, mode, renamedTargets, declRanges, ranges, mask);
  }

  if (mode === "output") {
    for (const name of [...renamedTargets].sort((a, b) => b.length - a.length)) {
      if (regular.has(name)) continue;
      addRegularMatches(text, name, mode, renamedTargets, declRanges, ranges, mask);
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

function renderHighlighted(text, mode, renames, options = {}) {
  const stepHighlightEnabled = options.stepHighlightEnabled !== false;
  const syntaxHighlightEnabled = options.syntaxHighlightEnabled !== false;

  if (!text) return "";

  const stepRanges = stepHighlightEnabled
    ? buildStepRanges(text, mode, renames)
    : [];
  const syntaxRanges = syntaxHighlightEnabled ? prismSyntaxRanges(text) : [];

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

export { renderHighlighted, renderJsonHighlighted };

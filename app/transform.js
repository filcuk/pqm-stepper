/**
 * PQM Stepper — transform Power Query M step names using a mapping schema.
 */

import { STEP_DECL_RE, escapeRegExp } from "./m-utils.js";

const OBJECT_EXTRACTORS = {
  "Added Custom": extractAddColumnName,
  "Added Conditional Column": extractAddColumnName,
  "Duplicated Column": extractDuplicateColumnName,
  "Invoked Custom Function": extractInvokeFunctionName,
};

/**
 * Split a quoted step inner name into base key and optional numeric suffix.
 */
function parseQuotedName(innerName) {
  const spaceSuffix = innerName.match(/^(.+?) (\d+)$/);
  if (spaceSuffix) {
    return { base: spaceSuffix[1], suffix: spaceSuffix[2] };
  }
  const gluedSuffix = innerName.match(/^(.+?)(\d+)$/);
  if (gluedSuffix) {
    return { base: gluedSuffix[1], suffix: gluedSuffix[2] };
  }
  return { base: innerName, suffix: null };
}

/**
 * Convert a label (column name, function name) to a PascalCase identifier part.
 */
function toIdentifierPart(name) {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function isDynamicTemplate(template) {
  return template.includes("*");
}

function resolveDynamicName(template, objectName) {
  const part = toIdentifierPart(objectName);
  if (!part) return template.replace("*", "");
  return template.replace("*", part);
}

function extractAddColumnName(body) {
  const match = body.match(/Table\.AddColumn\s*\([^,]+,\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function extractDuplicateColumnName(body) {
  const match = body.match(/Table\.DuplicateColumn\s*\([^,]+,\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function extractInvokeFunctionName(body) {
  const match = body.match(/^(?:#shared\.)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  return match ? match[1] : null;
}

/**
 * Detect source-navigation steps from the step expression.
 * @returns {"Workbook"|"Sheet"|"Table"|"Navigate"|null}
 */
function detectNavigationType(body) {
  if (!body) return null;

  if (/Excel\.Workbook\s*\(/.test(body)) {
    return "Workbook";
  }

  if (/\{[^}]*Kind\s*=\s*"Sheet"[^}]*\}\s*\[Data\]/i.test(body)) {
    return "Sheet";
  }

  if (/\{[^}]*Schema\s*=/.test(body) && /\{[^}]*Item\s*=/.test(body)) {
    return "Navigate";
  }

  if (/\{[^}]*entity\s*=/.test(body)) {
    return "Table";
  }

  return null;
}

/**
 * Extract the RHS expression for a step declaration.
 * @param {string} mCode
 * @param {{ name: string, isQuoted: boolean }} step
 */
function getStepBody(mCode, step) {
  let eqIdx;

  if (step.isQuoted) {
    const token = `#"${step.name}"`;
    const tokenIdx = mCode.indexOf(token);
    if (tokenIdx === -1) return null;
    eqIdx = mCode.indexOf("=", tokenIdx + token.length);
  } else {
    const declRe = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(step.name)}\\s*=`,
      "m"
    );
    const match = declRe.exec(mCode);
    if (!match) return null;
    eqIdx = mCode.indexOf("=", match.index);
  }

  if (eqIdx === -1) return null;

  let start = eqIdx + 1;
  while (start < mCode.length && /\s/.test(mCode[start])) start++;

  const rest = mCode.slice(start);
  const nextStepRe =
    /\n\s*(?:(#"[^"]+")|([A-Za-z_][A-Za-z0-9_]*))\s*=/;
  const inClauseRe = /\n\s*in\b/;

  let end = rest.length;
  const nextMatch = nextStepRe.exec(rest);
  if (nextMatch && nextMatch.index > 0 && nextMatch.index < end) {
    end = nextMatch.index;
  }
  const inMatch = inClauseRe.exec(rest);
  if (inMatch && inMatch.index < end) {
    end = inMatch.index;
  }

  let body = rest.slice(0, end).trim();
  if (body.endsWith(",")) body = body.slice(0, -1).trim();
  return body;
}

function extractObjectName(baseStepName, stepBody) {
  const extractor = OBJECT_EXTRACTORS[baseStepName];
  if (!extractor || !stepBody) return null;
  return extractor(stepBody);
}

function sanitizeQuotedName(innerName) {
  return toIdentifierPart(innerName) || "Step";
}

function resolveMappedTargetName(step, mapping, stepBody, warnings) {
  const { base } = parseQuotedName(step.name);
  const template = mapping[base];
  if (!template) return sanitizeQuotedName(step.name);

  if (!isDynamicTemplate(template)) return template;

  const objectName = extractObjectName(base, stepBody);

  if (!objectName) {
    const fallback = template.replace("*", "");
    warnings.push(
      `Could not extract object name for #"${step.name}"; using "${fallback}".`
    );
    return fallback;
  }

  return resolveDynamicName(template, objectName);
}

/**
 * Resolve target name: navigation patterns first, then mapping (quoted steps only).
 */
function resolveStepTargetName(step, mapping, mCode, warnings) {
  const stepBody = getStepBody(mCode, step);
  const navigationType = detectNavigationType(stepBody);
  if (navigationType) return navigationType;

  if (step.isQuoted) {
    return resolveMappedTargetName(step, mapping, stepBody, warnings);
  }

  return null;
}

/**
 * Collect step declarations in document order.
 * @returns {{ name: string, isQuoted: boolean, token: string }[]}
 */
function parseSteps(mCode) {
  const steps = [];

  STEP_DECL_RE.lastIndex = 0;
  let match;
  while ((match = STEP_DECL_RE.exec(mCode)) !== null) {
    if (match[2]) {
      steps.push({ name: match[2], isQuoted: true, token: match[1] });
    } else if (match[3]) {
      steps.push({ name: match[3], isQuoted: false, token: match[3] });
    }
  }

  return steps;
}

/**
 * Assign output names for all recognized steps, grouped by resolved target name.
 */
function buildReplacementMaps(steps, mapping, mCode, warnings) {
  const targetGroups = new Map();

  for (const step of steps) {
    const target = resolveStepTargetName(step, mapping, mCode, warnings);
    if (target) {
      if (!targetGroups.has(target)) {
        targetGroups.set(target, []);
      }
      targetGroups.get(target).push(step);
    }
  }

  const quotedMap = new Map();
  const regularMap = new Map();
  const regularNames = new Set(
    steps.filter((s) => !s.isQuoted).map((s) => s.name)
  );
  const usedOutputNames = new Set(regularNames);

  for (const [targetName, groupedSteps] of targetGroups) {
    const count = groupedSteps.length;
    groupedSteps.forEach((step, index) => {
      const newName = count === 1 ? targetName : targetName + (index + 1);
      const label = step.isQuoted ? `#"${step.name}"` : step.name;

      if (!step.isQuoted && step.name === newName) {
        return;
      }

      if (usedOutputNames.has(newName)) {
        warnings.push(
          `Name collision: "${newName}" already exists. Skipping rename of ${label}.`
        );
        return;
      }

      usedOutputNames.add(newName);
      if (step.isQuoted) {
        quotedMap.set(step.name, newName);
      } else {
        regularMap.set(step.name, newName);
      }
    });
  }

  return { quotedMap, regularMap };
}

function applyReplacements(mCode, quotedMap, regularMap) {
  let result = mCode;

  const sortedQuoted = [...quotedMap.keys()].sort((a, b) => b.length - a.length);
  for (const innerName of sortedQuoted) {
    const newName = quotedMap.get(innerName);
    const pattern = new RegExp(`#"${escapeRegExp(innerName)}"`, "g");
    result = result.replace(pattern, newName);
  }

  const sortedRegular = [...regularMap.keys()].sort((a, b) => b.length - a.length);
  for (const name of sortedRegular) {
    const newName = regularMap.get(name);
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
    result = result.replace(pattern, newName);
  }

  return result;
}

/**
 * Transform Power Query M code by renaming mapped step identifiers.
 */
function transform(mCode, mapping) {
  const warnings = [];

  if (!mCode.trim()) {
    return { output: "", warnings: ["Input is empty."], renames: null };
  }

  if (!/\blet\b/i.test(mCode)) {
    warnings.push("No let block found; performing best-effort rename.");
  }

  const steps = parseSteps(mCode);
  const { quotedMap, regularMap } = buildReplacementMaps(
    steps,
    mapping,
    mCode,
    warnings
  );
  const output = applyReplacements(mCode, quotedMap, regularMap);

  const definedQuoted = new Set(
    steps.filter((s) => s.isQuoted).map((s) => s.name)
  );
  const unmappedDefined = [...definedQuoted].filter(
    (name) => !quotedMap.has(name)
  );
  if (unmappedDefined.length > 0) {
    warnings.push(
      `${unmappedDefined.length} quoted step(s) left unchanged: ${unmappedDefined.map((n) => `#"${n}"`).join(", ")}`
    );
  }

  const renamed = quotedMap.size + regularMap.size;
  if (renamed === 0 && unmappedDefined.length === 0 && !/\blet\b/i.test(mCode)) {
    warnings.push("No step identifiers found.");
  }

  return {
    output,
    warnings,
    renames: {
      fromQuoted: new Set(quotedMap.keys()),
      fromRegular: new Set(regularMap.keys()),
      to: new Set([...quotedMap.values(), ...regularMap.values()]),
    },
  };
}

export { transform, parseSteps };

/**
 * PQM Stepper — transform Power Query M step names using a mapping schema.
 */

import {
  escapeRegExp,
  buildMContextMask,
  isProtectedLiteral,
  isCodeRange,
  findStepDeclarations,
  hasLetKeyword,
  isKeywordAt,
  indexAfterLetIn,
  M_SPAN_CODE,
} from "./m-utils.js";

const OBJECT_EXTRACTORS = {
  "Added Custom": extractAddColumnName,
  "Added Conditional Column": extractAddColumnName,
  "Duplicated Column": extractDuplicateColumnName,
  "Invoked Custom Function": extractInvokeFunctionName,
};

/** PQ steps that are often repeated and may get a column suffix in verbose mode. */
const VERBOSE_STEP_BASES = new Set([
  "Changed Type",
  "Filtered Rows",
  "Renamed Columns",
  "Replaced Value",
  "Replaced Errors",
  "Sorted Rows",
  "Lowercased Text",
  "Uppercased Text",
  "Trimmed Text",
  "Cleaned Text",
  "Capitalized Each Word",
  "Split Column by Delimiter",
  "Split Column by Number of Characters",
  "Split Column by Positions",
  "Split Column by Lowercase to Uppercase",
  "Split Column by Uppercase to Lowercase",
  "Split Column by Digit to Non-Digit",
  "Split Column by Non-Digit to Digit",
  "Removed Columns",
  "Removed Other Columns",
  "Filled Down",
  "Filled Up",
  "Removed Duplicates",
  "Merged Queries",
  "Expanded Table Column",
  "Expanded Custom",
  "Appended Query",
  "Merged Columns",
  "Inserted Merged Column",
  "Unpivoted Columns",
  "Unpivoted Other Columns",
]);

const VERBOSE_COLUMN_EXTRACTORS = {
  "Changed Type": extractChangedTypeColumn,
  "Filtered Rows": extractFilterColumn,
  "Renamed Columns": extractRenameColumn,
  "Replaced Value": extractReplaceValueColumns,
  "Replaced Errors": extractReplaceValueColumns,
  "Sorted Rows": extractSortColumn,
  "Lowercased Text": extractTransformColumnsSingle,
  "Uppercased Text": extractTransformColumnsSingle,
  "Trimmed Text": extractTransformColumnsSingle,
  "Cleaned Text": extractTransformColumnsSingle,
  "Capitalized Each Word": extractTransformColumnsSingle,
  "Split Column by Delimiter": extractSplitColumn,
  "Split Column by Number of Characters": extractSplitColumn,
  "Split Column by Positions": extractSplitColumn,
  "Split Column by Lowercase to Uppercase": extractSplitColumn,
  "Split Column by Uppercase to Lowercase": extractSplitColumn,
  "Split Column by Digit to Non-Digit": extractSplitColumn,
  "Split Column by Non-Digit to Digit": extractSplitColumn,
  "Removed Columns": extractTrailingColumnList,
  "Removed Other Columns": extractTrailingColumnList,
  "Filled Down": extractFillColumn,
  "Filled Up": extractFillColumn,
  "Removed Duplicates": extractTrailingColumnList,
  "Merged Queries": extractMergeTableName,
  "Expanded Table Column": extractExpandColumnName,
  "Expanded Custom": extractExpandColumnName,
  "Appended Query": extractAppendTableName,
};

export const NAMING_MODES = ["numbered", "verbose"];

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

  let start = 0;
  while (start < parts.length && /^\d+$/.test(parts[start])) {
    start += 1;
  }

  const usable = parts.slice(start);
  if (usable.length === 0) return "";

  return usable
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Ensure a step identifier is valid M (no leading digit). */
function sanitizeMIdentifier(name, fallback = "Step") {
  if (!name) return fallback;

  const stripped = name.replace(/^[0-9]+/, "");
  if (!stripped || !/^[A-Za-z_]/.test(stripped)) {
    return fallback;
  }

  return stripped;
}

function isDynamicTemplate(template) {
  return template.includes("*");
}

function resolveDynamicName(template, objectName) {
  const part = toIdentifierPart(objectName);
  if (!part) return sanitizeMIdentifier(template.replace("*", ""));
  return sanitizeMIdentifier(template.replace("*", part));
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

function extractQuotedNamesFromList(listText) {
  return [...listText.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function extractChangedTypeColumn(body) {
  const match = body.match(
    /Table\.TransformColumnTypes\s*\(\s*[^,]+,\s*(\{[\s\S]*\})\s*\)/
  );
  if (!match) return null;

  const columns = [...match[1].matchAll(/\{\s*"([^"]+)"/g)].map((m) => m[1]);
  return columns.length === 1 ? columns[0] : null;
}

function extractFilterColumn(body) {
  const match = body.match(
    /Table\.SelectRows\s*\(\s*[^,]+,\s*each\s+([\s\S]+)\)\s*$/i
  );
  if (!match) return null;

  const predicate = match[1].trim();
  const direct = predicate.match(/^\[([^\]]+)\]/);
  if (direct) {
    const column = direct[1].trim();
    if (/^[A-Za-z_][A-Za-z0-9_ ]*$/.test(column)) return column;
  }

  const columns = [
    ...new Set(
      [...predicate.matchAll(/\[([^\]]+)\]/g)]
        .map((m) => m[1].trim())
        .filter((name) => /^[A-Za-z_][A-Za-z0-9_ ]*$/.test(name))
    ),
  ];

  return columns.length === 1 ? columns[0] : null;
}

function extractRenameColumn(body) {
  const match = body.match(
    /Table\.RenameColumns\s*\(\s*[^,]+,\s*(\{[\s\S]*\})\s*\)/
  );
  if (!match) return null;

  const pairs = [
    ...match[1].matchAll(/\{\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\}/g),
  ];
  if (pairs.length !== 1) return null;

  return pairs[0][2];
}

function extractReplaceValueColumns(body) {
  const match = body.match(/,\s*\{([^}]*)\}\s*\)\s*$/);
  if (!match) return null;

  const columns = extractQuotedNamesFromList(match[1]);
  return columns.length === 1 ? columns[0] : null;
}

function extractSortColumn(body) {
  const match = body.match(/Table\.Sort\s*\(\s*[^,]+,\s*(\{[\s\S]*\})\s*\)/);
  if (!match) return null;

  const columns = [...match[1].matchAll(/\{\s*"([^"]+)"/g)].map((m) => m[1]);
  return columns.length === 1 ? columns[0] : null;
}

function extractTransformColumnsSingle(body) {
  const match = body.match(
    /Table\.TransformColumns\s*\(\s*[^,]+,\s*(\{[\s\S]*\})\s*\)/
  );
  if (!match) return null;

  const columns = [...match[1].matchAll(/\{\s*"([^"]+)"/g)].map((m) => m[1]);
  return columns.length === 1 ? columns[0] : null;
}

function extractSplitColumn(body) {
  const match = body.match(/Table\.SplitColumn\s*\(\s*[^,]+,\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function extractTrailingColumnList(body) {
  const match = body.match(/,\s*\{([^}]*)\}\s*\)\s*$/);
  if (!match) return null;

  const columns = extractQuotedNamesFromList(match[1]);
  return columns.length === 1 ? columns[0] : null;
}

function extractFillColumn(body) {
  const match = body.match(/Table\.Fill(?:Down|Up)\s*\(\s*[^,]+,\s*\{([^}]*)\}\s*\)/);
  if (!match) return null;

  const columns = extractQuotedNamesFromList(match[1]);
  return columns.length === 1 ? columns[0] : null;
}

function extractMergeTableName(body) {
  const match = body.match(
    /Table\.(?:Fuzzy)?NestedJoin\s*\(\s*[^,]+,\s*\{[^}]*\}\s*,\s*(?:#"[^"]+"|[^,]+?)\s*,\s*\{[^}]*\}\s*,\s*"([^"]+)"/i
  );
  return match ? match[1] : null;
}

function extractExpandColumnName(body) {
  const match = body.match(/Table\.ExpandTableColumn\s*\(\s*[^,]+,\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function extractAppendTableName(body) {
  const match = body.match(/Table\.Combine\s*\(\s*\{([^}]+)\}/);
  if (!match) return null;

  const refs = [];
  for (const part of match[1].split(",")) {
    const trimmed = part.trim();
    const quoted = trimmed.match(/^#"([^"]+)"$/);
    if (quoted) {
      refs.push(quoted[1]);
      continue;
    }
    const ident = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
    if (ident) refs.push(ident[1]);
  }

  return refs.length === 2 ? refs[1] : null;
}

/** Match M expression to English mapping keys when the quoted step label is localized. */
const BODY_STEP_TYPE_DETECTORS = [
  [/Table\.AddIndexColumn\s*\(/, "Added Index"],
  [/Table\.AddColumn\s*\(/, "Added Custom"],
  [/Table\.DuplicateColumn\s*\(/, "Duplicated Column"],
  [/Table\.TransformColumnTypes\s*\(/, "Changed Type"],
  [/Table\.SelectRows\s*\(/, "Filtered Rows"],
  [/Table\.RenameColumns\s*\(/, "Renamed Columns"],
  [/Table\.ReplaceValue\s*\(/, "Replaced Value"],
  [/Table\.ReplaceErrorValues\s*\(/, "Replaced Errors"],
  [/Table\.Sort\s*\(/, "Sorted Rows"],
  [/Table\.RemoveColumns\s*\(/, "Removed Columns"],
  [/Table\.SelectColumns\s*\(/, "Removed Other Columns"],
  [/Table\.Distinct\s*\(/, "Removed Duplicates"],
  [/Table\.FillDown\s*\(/, "Filled Down"],
  [/Table\.FillUp\s*\(/, "Filled Up"],
  [/Table\.SplitColumn\s*\(/, "Split Column by Delimiter"],
  [/Table\.(?:Fuzzy)?NestedJoin\s*\(/, "Merged Queries"],
  [/Table\.ExpandTableColumn\s*\(/, "Expanded Table Column"],
  [/Table\.ExpandRecordColumn\s*\(/, "Expanded Custom"],
  [/Table\.Combine\s*\(/, "Appended Query"],
  [/Table\.PromoteHeaders\s*\(/, "Promoted Headers"],
  [/Table\.DemoteHeaders\s*\(/, "Demoted Headers"],
  [/Table\.CombineColumns\s*\(/, "Merged Columns"],
  [/Table\.UnpivotOtherColumns\s*\(/, "Unpivoted Other Columns"],
  [/Table\.Unpivot\s*\(/, "Unpivoted Columns"],
  [/Table\.Pivot\s*\(/, "Pivoted Column"],
  [/Table\.Transpose\s*\(/, "Transposed Table"],
  [/Table\.Skip\s*\(/, "Removed Top Rows"],
  [/Table\.FirstN\s*\(/, "Kept Top Rows"],
  [/Table\.LastN\s*\(/, "Kept Bottom Rows"],
  [/Table\.RemoveFirstN\s*\(/, "Removed Top Rows"],
  [/Table\.RemoveLastN\s*\(/, "Removed Bottom Rows"],
  [/Table\.SelectRowsWithErrors\s*\(/, "Kept Errors"],
  [/Table\.RemoveRowsWithErrors\s*\(/, "Removed Errors"],
];

function detectMappedStepType(body) {
  if (!body) return null;

  for (const [pattern, stepType] of BODY_STEP_TYPE_DETECTORS) {
    if (pattern.test(body)) return stepType;
  }

  const trimmed = body.trim();
  if (
    /^(?:#shared\.)?[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(trimmed) &&
    !/^Table\./.test(trimmed)
  ) {
    return "Invoked Custom Function";
  }

  return null;
}

const NAVIGATION_VERBOSE_TARGETS = new Set([
  "Workbook",
  "Sheet",
  "Navigate",
  "Table",
  "Navigation",
]);

function isNameContentNavigation(body) {
  return /\{\s*\[\s*Name\s*=\s*"[^"]+"\s*\]\s*\}\s*\[\s*Content\s*\]/i.test(body);
}

function extractNavigationEntity(body) {
  if (!body) return null;

  let match = body.match(
    /\{\s*\[[^\]]*Item\s*=\s*"([^"]+)"[^\]]*Kind\s*=\s*"Sheet"/i
  );
  if (!match) {
    match = body.match(
      /\{\s*\[[^\]]*Kind\s*=\s*"Sheet"[^\]]*Item\s*=\s*"([^"]+)"/i
    );
  }
  if (match) return match[1];

  match = body.match(/\{\s*\[[^\]]*Schema\s*=[^\]]*Item\s*=\s*"([^"]+)"/i);
  if (match) return match[1];

  match = body.match(/\{\s*\[\s*entity\s*=\s*"([^"]+)"/i);
  if (match) return match[1];

  const nameMatches = [
    ...body.matchAll(/\{\s*\[\s*Name\s*=\s*"([^"]+)"\s*\]\s*\}\s*\[\s*Content\s*\]/gi),
  ];
  if (nameMatches.length > 0) {
    let name = nameMatches[nameMatches.length - 1][1];
    if (/Excel\.Workbook\s*\(/i.test(body)) {
      name = name.replace(/\.(xlsx|xlsm|xlsb|xls|csv)$/i, "");
    }
    return name;
  }

  return null;
}

function extractVerboseColumn(mappingKey, stepBody) {
  if (!VERBOSE_STEP_BASES.has(mappingKey)) return null;

  const extractor = VERBOSE_COLUMN_EXTRACTORS[mappingKey];
  return extractor?.(stepBody) ?? null;
}

function extractVerboseEntity(mappingKey, targetName, stepBody) {
  const fromMapping = extractVerboseColumn(mappingKey, stepBody);
  if (fromMapping) return fromMapping;

  if (NAVIGATION_VERBOSE_TARGETS.has(targetName)) {
    return extractNavigationEntity(stepBody);
  }

  return null;
}

function labelToVerbosePart(label) {
  const part = toIdentifierPart(label);
  if (part) return part;

  // Numeric-only labels are valid as a suffix (e.g. Navigation2024).
  const compact = label.trim().replace(/[^a-zA-Z0-9]+/g, "");
  return compact || "";
}

function buildVerboseName(targetName, columnName) {
  const part = labelToVerbosePart(columnName);
  if (!part) return null;
  return sanitizeMIdentifier(targetName + part);
}

function resolveNumberedName(targetName, index, count, alwaysNumber) {
  if (count === 1 && !alwaysNumber) return targetName;
  return targetName + (index + 1);
}

function assignNumberedNames(
  targetName,
  groupedSteps,
  usedOutputNames,
  quotedMap,
  regularMap,
  warnings,
  alwaysNumber = false
) {
  const count = groupedSteps.length;

  groupedSteps.forEach(({ step }, index) => {
    const newName = resolveNumberedName(targetName, index, count, alwaysNumber);
    assignStepName(step, newName, usedOutputNames, quotedMap, regularMap, warnings);
  });
}

function resolveVerboseDuplicateName(verboseName, serial, count) {
  if (count > 1) return verboseName + serial;
  return verboseName;
}

function assignVerboseNames(
  targetName,
  groupedSteps,
  usedOutputNames,
  quotedMap,
  regularMap,
  warnings,
  alwaysNumber = false
) {
  const count = groupedSteps.length;
  const numberedFallback = (index) =>
    resolveNumberedName(targetName, index, count, alwaysNumber);

  if (count === 1) {
    const entry = groupedSteps[0];
    const column = extractVerboseEntity(entry.mappingKey, targetName, entry.body);
    const verboseName = column ? buildVerboseName(targetName, column) : null;
    let newName = verboseName;
    if (verboseName && alwaysNumber) {
      newName = verboseName + "1";
    }
    if (!newName || usedOutputNames.has(newName)) {
      newName = numberedFallback(0);
    }
    assignStepName(entry.step, newName, usedOutputNames, quotedMap, regularMap, warnings);
    return;
  }

  const assignments = groupedSteps.map((entry, index) => {
    const column = extractVerboseEntity(entry.mappingKey, targetName, entry.body);
    const verboseName = column ? buildVerboseName(targetName, column) : null;
    return { ...entry, index, verboseName };
  });

  const verboseCounts = new Map();
  for (const entry of assignments) {
    if (!entry.verboseName) continue;
    verboseCounts.set(
      entry.verboseName,
      (verboseCounts.get(entry.verboseName) ?? 0) + 1
    );
  }

  const verboseSerial = new Map();
  const reserved = new Set();
  const chosenNames = new Map();

  for (const entry of assignments) {
    if (!entry.verboseName) continue;

    const duplicateCount = verboseCounts.get(entry.verboseName);
    const serial = (verboseSerial.get(entry.verboseName) ?? 0) + 1;
    verboseSerial.set(entry.verboseName, serial);
    const name = resolveVerboseDuplicateName(
      entry.verboseName,
      serial,
      duplicateCount
    );

    if (reserved.has(name) || usedOutputNames.has(name)) continue;

    reserved.add(name);
    chosenNames.set(entry.index, name);
  }

  for (const entry of assignments) {
    const newName = chosenNames.get(entry.index) ?? numberedFallback(entry.index);
    assignStepName(entry.step, newName, usedOutputNames, quotedMap, regularMap, warnings);
  }
}

function assignStepName(step, newName, usedOutputNames, quotedMap, regularMap, warnings) {
  const label = step.isQuoted ? `#"${step.name}"` : step.name;
  newName = sanitizeMIdentifier(newName);

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
 * Uses the declaration's eqIndex (not the first textual occurrence of the name).
 * @param {string} mCode
 * @param {{ name: string, isQuoted: boolean, eqIndex?: number }} step
 * @param {Uint8Array} [mask]
 */
function getStepBody(mCode, step, mask = buildMContextMask(mCode)) {
  if (typeof step.eqIndex !== "number" || step.eqIndex < 0) return null;

  let start = step.eqIndex + 1;
  while (start < mCode.length && /\s/.test(mCode[start])) start++;

  let i = start;
  let depth = 0;

  while (i < mCode.length) {
    if (mask[i] !== M_SPAN_CODE) {
      i++;
      continue;
    }

    if (depth === 0 && isKeywordAt(mCode, i, "in")) break;
    if (depth === 0 && mCode[i] === ",") break;

    if (depth === 0 && isKeywordAt(mCode, i, "let")) {
      i = indexAfterLetIn(mCode, mask, i + 3);
      continue;
    }

    const ch = mCode[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
    }
    i++;
  }

  let body = mCode.slice(start, i).trim();
  if (body.endsWith(",")) body = body.slice(0, -1).trim();
  return body;
}

function extractObjectName(baseStepName, stepBody) {
  const extractor = OBJECT_EXTRACTORS[baseStepName];
  if (!extractor || !stepBody) return null;
  return extractor(stepBody);
}

function sanitizeQuotedName(innerName) {
  return sanitizeMIdentifier(toIdentifierPart(innerName));
}

function resolveMappingKey(stepName, mapping, stepBody) {
  const { base } = parseQuotedName(stepName);
  if (mapping[base]) return base;

  const detected = detectMappedStepType(stepBody);
  if (detected && mapping[detected]) return detected;

  return base;
}

function resolveMappedTargetName(step, mapping, stepBody, warnings) {
  const { base } = parseQuotedName(step.name);
  let mappingKey = base;
  let template = mapping[base];

  if (!template && stepBody) {
    const detected = detectMappedStepType(stepBody);
    if (detected && mapping[detected]) {
      mappingKey = detected;
      template = mapping[detected];
    }
  }

  if (!template) return sanitizeQuotedName(step.name);

  if (!isDynamicTemplate(template)) return sanitizeMIdentifier(template);

  const objectName = extractObjectName(mappingKey, stepBody);

  if (!objectName) {
    const fallback = sanitizeMIdentifier(template.replace("*", ""));
    warnings.push(
      `Could not extract object name for #"${step.name}"; using "${fallback}".`
    );
    return fallback;
  }

  return resolveDynamicName(template, objectName);
}

/**
 * Resolve target name: navigation patterns first, then mapping (quoted steps only).
 * @param {string | null} [stepBody]
 */
function resolveStepTargetName(step, mapping, mCode, warnings, stepBody = null) {
  const body =
    stepBody !== null && stepBody !== undefined
      ? stepBody
      : getStepBody(mCode, step);
  const navigationType = detectNavigationType(body);
  if (navigationType) return navigationType;

  if (isNameContentNavigation(body)) {
    return "Navigation";
  }

  if (step.isQuoted) {
    return resolveMappedTargetName(step, mapping, body, warnings);
  }

  return null;
}

/**
 * Collect step declarations in document order.
 * @returns {{ name: string, isQuoted: boolean, token: string, tokenStart: number, eqIndex: number }[]}
 */
function parseSteps(mCode) {
  return findStepDeclarations(mCode);
}

/**
 * Assign output names for all recognized steps, grouped by resolved target name.
 */
function buildReplacementMaps(
  steps,
  mapping,
  mCode,
  warnings,
  namingMode = "numbered",
  alwaysNumber = false
) {
  const targetGroups = new Map();
  const mask = buildMContextMask(mCode);

  for (const step of steps) {
    const stepBody = getStepBody(mCode, step, mask);
    const target = resolveStepTargetName(
      step,
      mapping,
      mCode,
      warnings,
      stepBody
    );
    if (target) {
      if (!targetGroups.has(target)) {
        targetGroups.set(target, []);
      }
      targetGroups.get(target).push({
        step,
        mappingKey: step.isQuoted
          ? resolveMappingKey(step.name, mapping, stepBody)
          : null,
        body: stepBody,
      });
    }
  }

  const quotedMap = new Map();
  const regularMap = new Map();
  const regularNames = new Set(
    steps.filter((s) => !s.isQuoted).map((s) => s.name)
  );
  const usedOutputNames = new Set(regularNames);

  for (const [targetName, groupedSteps] of targetGroups) {
    if (namingMode === "verbose") {
      assignVerboseNames(
        targetName,
        groupedSteps,
        usedOutputNames,
        quotedMap,
        regularMap,
        warnings,
        alwaysNumber
      );
    } else {
      assignNumberedNames(
        targetName,
        groupedSteps,
        usedOutputNames,
        quotedMap,
        regularMap,
        warnings,
        alwaysNumber
      );
    }
  }

  return { quotedMap, regularMap };
}

function applyReplacements(mCode, quotedMap, regularMap) {
  const mask = buildMContextMask(mCode);
  /** @type {{ start: number, end: number, text: string }[]} */
  const edits = [];

  const sortedQuoted = [...quotedMap.keys()].sort((a, b) => b.length - a.length);
  for (const innerName of sortedQuoted) {
    const newName = quotedMap.get(innerName);
    const pattern = new RegExp(`#"${escapeRegExp(innerName)}"`, "g");
    for (const match of mCode.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (isProtectedLiteral(mask, start)) continue;
      edits.push({ start, end, text: newName });
    }
  }

  const sortedRegular = [...regularMap.keys()].sort((a, b) => b.length - a.length);
  for (const name of sortedRegular) {
    const newName = regularMap.get(name);
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
    for (const match of mCode.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (!isCodeRange(mask, start, end)) continue;
      edits.push({ start, end, text: newName });
    }
  }

  edits.sort((a, b) => b.start - a.start || b.end - a.end);

  let result = mCode;
  let lastStart = Infinity;
  for (const edit of edits) {
    if (edit.end > lastStart) continue;
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
    lastStart = edit.start;
  }

  return result;
}

/**
 * Transform Power Query M code by renaming mapped step identifiers.
 * @param {string} mCode
 * @param {Record<string, string>} mapping
 * @param {{ namingMode?: "numbered" | "verbose", alwaysNumber?: boolean }} [options]
 */
function transform(mCode, mapping, options = {}) {
  const namingMode = options.namingMode === "verbose" ? "verbose" : "numbered";
  const alwaysNumber = options.alwaysNumber === true;
  const warnings = [];

  if (!mCode.trim()) {
    return { output: "", warnings: ["Input is empty."], renames: null };
  }

  const hasLet = hasLetKeyword(mCode);
  if (!hasLet) {
    warnings.push("No let block found; performing best-effort rename.");
  }

  const steps = parseSteps(mCode);
  if (hasLet && steps.length === 0) {
    warnings.push("Found a let block but no step declarations to rename.");
  }
  const { quotedMap, regularMap } = buildReplacementMaps(
    steps,
    mapping,
    mCode,
    warnings,
    namingMode,
    alwaysNumber
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
  if (renamed === 0 && unmappedDefined.length === 0 && !hasLet) {
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

/**
 * Interactive code blocks: optional toolbar, Prism highlight, line numbers, copy/paste.
 *
 * Markup:
 *   <div class="code-block"
 *     data-code-mode="select"
 *     data-code-toolbar="top"
 *     data-code-toolbar-actions="clear,copy,paste,maximize,highlight,line-numbers"
 *     data-code-surface-actions="copy,maximize">
 *     <div class="code-block-body">
 *       <pre class="line-numbers language-python"><code>…</code></pre>
 *     </div>
 *   </div>
 *
 * Options via data attributes on `.code-block`:
 *   data-code-mode="view|select|edit" — interaction mode (default `select`)
 *   data-code-toolbar="top|bottom|none" — control bar position
 *   data-code-toolbar-actions — comma list: clear, copy, paste, maximize,
 *     highlight, line-numbers (default `highlight,line-numbers` when omitted
 *     and a toolbar position is not `none`)
 *   data-code-toolbar-align — comma list of `action:left|right` (default
 *     `highlight`, `line-numbers`, and `maximize` → `right`; others → `left`)
 *   data-code-surface-actions — comma list: copy, maximize (hover actions);
 *     `none` / empty / `false` disables the floating strip
 *   data-code-copy="false" — legacy: omit surface copy
 *   data-code-line-numbers="false" — start without line numbers
 *   data-code-highlight="false" — start without highlighting
 *
 * Edit mode uses a transparent textarea over a highlighted `<pre>`.
 * Maximize requires `data-expandable-surface` + `initExpandableSurfaces()`;
 * toolbar Maximize uses `data-expandable-surface-open`.
 */

import { setHidden } from "../utils/dom.js";
import { copyText, readText, armPasteCapture } from "../utils/clipboard.js";
import { createIcon } from "../utils/icons.js";
import { flashTooltip } from "./tooltip.js";

const LANGUAGE_RE = /language-([\w-]+)/;
const CODE_MODES = ["view", "select", "edit"];
const TOOLBAR_POSITIONS = ["top", "bottom", "none"];
const TOOLBAR_ACTION_IDS = [
  "clear",
  "copy",
  "paste",
  "highlight",
  "line-numbers",
  "maximize",
];
const SURFACE_ACTION_IDS = ["copy", "maximize"];
const DEFAULT_TOOLBAR_ACTIONS = ["highlight", "line-numbers"];
/** @type {Readonly<Record<string, "left" | "right">>} */
const DEFAULT_TOOLBAR_ALIGN = {
  highlight: "right",
  "line-numbers": "right",
  maximize: "right",
};

/**
 * @param {string | undefined} raw
 * @param {string[]} allowed
 * @returns {Set<string> | null} null = attribute omitted
 */
function parseActionList(raw, allowed) {
  if (raw === undefined) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "none" || trimmed === "false") {
    return new Set();
  }
  const allowedSet = new Set(allowed);
  const next = new Set();
  for (const part of trimmed.split(",")) {
    const id = part.trim();
    if (allowedSet.has(id)) next.add(id);
  }
  return next;
}

/**
 * @param {string | undefined} raw
 * @param {string[]} allowed
 * @returns {Map<string, "left" | "right"> | null} null = attribute omitted
 */
function parseToolbarAlign(raw, allowed) {
  if (raw === undefined) return null;
  const allowedSet = new Set(allowed);
  /** @type {Map<string, "left" | "right">} */
  const next = new Map();
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "none" || trimmed === "false") {
    return next;
  }
  for (const part of trimmed.split(",")) {
    const [idRaw, sideRaw] = part.split(":");
    const id = idRaw?.trim();
    const side = sideRaw?.trim();
    if (!id || !allowedSet.has(id)) continue;
    if (side === "left" || side === "right") next.set(id, side);
  }
  return next;
}

/**
 * @param {string} action
 * @param {Map<string, "left" | "right">} alignMap
 * @returns {"left" | "right"}
 */
function resolveToolbarAlign(action, alignMap) {
  return alignMap.get(action) ?? DEFAULT_TOOLBAR_ALIGN[action] ?? "left";
}

/**
 * @param {Map<string, "left" | "right">} alignMap
 * @param {Set<string>} actions
 */
function serializeToolbarAlign(alignMap, actions) {
  const parts = [];
  for (const action of TOOLBAR_ACTION_IDS) {
    if (!actions.has(action)) continue;
    const side = resolveToolbarAlign(action, alignMap);
    const fallback = DEFAULT_TOOLBAR_ALIGN[action] ?? "left";
    if (side !== fallback || alignMap.has(action)) {
      parts.push(`${action}:${side}`);
    }
  }
  return parts.join(",");
}

function parseLanguage(codeEl) {
  for (const cls of codeEl.classList) {
    const match = cls.match(LANGUAGE_RE);
    if (match) return match[1];
  }
  return null;
}

function parseMode(value) {
  return CODE_MODES.includes(value) ? value : "select";
}

function parseToolbarPosition(value) {
  return TOOLBAR_POSITIONS.includes(value) ? value : null;
}

function removeLineNumberMarkup(codeEl) {
  const preEl = codeEl.parentElement;
  codeEl.querySelector(".line-numbers-rows")?.remove();
  codeEl.querySelector(".line-numbers-sizer")?.remove();
  preEl?.querySelectorAll(".line-numbers-rows").forEach((el) => el.remove());
  preEl?.querySelectorAll(".line-numbers-sizer").forEach((el) => el.remove());
}

/** Gutter digits live on `pre` so `code` can scroll horizontally without clipping them. */
function renderLineNumberRows(preEl, lineCount) {
  preEl.querySelectorAll(":scope > .line-numbers-rows").forEach((el) => el.remove());
  const rows = document.createElement("span");
  rows.className = "line-numbers-rows";
  rows.setAttribute("aria-hidden", "true");
  for (let i = 0; i < lineCount; i += 1) {
    rows.appendChild(document.createElement("span"));
  }
  const codeEl = preEl.querySelector(":scope > code");
  if (codeEl) preEl.insertBefore(rows, codeEl);
  else preEl.appendChild(rows);
}

function updateLineNumbersToggle(toggle, highlightEnabled) {
  if (!toggle) return;
  toggle.disabled = !highlightEnabled;
  toggle.setAttribute("aria-disabled", highlightEnabled ? "false" : "true");
}

function insertTabAtCursor(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = `${value.slice(0, start)}\t${value.slice(end)}`;
  textarea.selectionStart = textarea.selectionEnd = start + 1;
}

/** Strip trailing newlines from HTML `textContent` (avoids a phantom last line). */
function normalizeSource(text) {
  return text.replace(/\n+$/, "");
}

function countDisplayLines(text) {
  if (text === "") return 1;
  return text.split("\n").length;
}

/**
 * @param {string} action
 * @param {{
 *   label: string,
 *   tooltip?: string,
 *   icon: string,
 *   textLabel?: string,
 *   pressed?: boolean,
 * }} meta
 */
function createToolbarButton(action, meta) {
  const btn = document.createElement("button");
  btn.type = "button";
  const withText = Boolean(meta.textLabel);
  btn.className = withText
    ? "btn code-block-toolbar__btn code-block-toolbar__btn--labeled"
    : "btn btn-slim btn-icon code-block-toolbar__btn";
  btn.dataset.codeToolbarAction = action;
  btn.setAttribute("aria-label", meta.label);
  /* Labeled buttons already show their name — skip tooltips. */
  if (!withText && meta.tooltip) {
    btn.dataset.tooltip = meta.tooltip;
    btn.dataset.tooltipPosition = "top";
  }
  if (meta.pressed !== undefined) {
    btn.classList.add("btn-toggle");
    btn.setAttribute("aria-pressed", meta.pressed ? "true" : "false");
    btn.dataset.codeToggle = action;
  }
  if (action === "maximize") {
    btn.dataset.expandableSurfaceOpen = "";
  }
  btn.append(createIcon(meta.icon, { className: "btn-icon-svg" }));
  if (withText) {
    const labelEl = document.createElement("span");
    labelEl.className = "code-block-toolbar__label";
    labelEl.textContent = meta.textLabel;
    btn.append(labelEl);
  }
  return btn;
}

/**
 * @param {HTMLButtonElement} btn
 * @param {string} text
 */
function setToolbarButtonText(btn, text) {
  const labelEl = btn.querySelector(".code-block-toolbar__label");
  if (labelEl) labelEl.textContent = text;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   copyButton?: boolean,
 *   lineNumbers?: boolean,
 *   highlight?: boolean,
 *   mode?: string,
 *   toolbar?: string,
 *   toolbarActions?: string[] | string,
 *   toolbarAlign?: string[] | string | Record<string, "left" | "right">,
 *   surfaceActions?: string[] | string,
 * }} [options]
 */
export function initCodeBlock(container, options = {}) {
  if (!(container instanceof HTMLElement)) return null;
  if (container.dataset.codeBlockInit !== undefined) return null;
  container.dataset.codeBlockInit = "";

  const pre = container.querySelector("pre");
  const code = pre?.querySelector("code");
  if (!pre || !code) return null;

  let body = container.querySelector(".code-block-body");
  if (!body) {
    body = document.createElement("div");
    body.className = "code-block-body";
    pre.parentNode?.insertBefore(body, pre);
    body.appendChild(pre);
  }

  const lineNumbersDefault =
    options.lineNumbers ??
    container.dataset.codeLineNumbers !== "false";
  const highlightDefault =
    options.highlight ??
    container.dataset.codeHighlight !== "false";
  let mode = parseMode(options.mode ?? container.dataset.codeMode);

  const language = parseLanguage(code);
  let source = normalizeSource(code.textContent);
  code.dataset.source = source;

  let lineNumbersEnabled = lineNumbersDefault;
  let highlightEnabled = highlightDefault;

  /** @type {Set<string>} */
  let toolbarActions;
  const toolbarActionsOpt =
    options.toolbarActions !== undefined
      ? Array.isArray(options.toolbarActions)
        ? options.toolbarActions.join(",")
        : String(options.toolbarActions)
      : container.dataset.codeToolbarActions;
  const parsedToolbarActions = parseActionList(
    toolbarActionsOpt,
    TOOLBAR_ACTION_IDS
  );
  if (parsedToolbarActions) {
    toolbarActions = parsedToolbarActions;
  } else {
    toolbarActions = new Set(DEFAULT_TOOLBAR_ACTIONS);
  }

  let toolbarPosition =
    parseToolbarPosition(options.toolbar ?? container.dataset.codeToolbar) ??
    (toolbarActions.size > 0 ? "top" : "none");

  /** @type {Map<string, "left" | "right">} */
  let toolbarAlign;
  const toolbarAlignOpt =
    options.toolbarAlign !== undefined
      ? Array.isArray(options.toolbarAlign)
        ? options.toolbarAlign.join(",")
        : typeof options.toolbarAlign === "object" && options.toolbarAlign
          ? Object.entries(options.toolbarAlign)
              .map(([id, side]) => `${id}:${side}`)
              .join(",")
          : String(options.toolbarAlign)
      : container.dataset.codeToolbarAlign;
  toolbarAlign = parseToolbarAlign(toolbarAlignOpt, TOOLBAR_ACTION_IDS) ?? new Map();

  /** @type {Set<string>} */
  let surfaceActions;
  const surfaceActionsOpt =
    options.surfaceActions !== undefined
      ? Array.isArray(options.surfaceActions)
        ? options.surfaceActions.join(",")
        : String(options.surfaceActions)
      : container.dataset.codeSurfaceActions;
  const parsedSurfaceActions = parseActionList(
    surfaceActionsOpt,
    SURFACE_ACTION_IDS
  );
  if (parsedSurfaceActions) {
    surfaceActions = parsedSurfaceActions;
  } else if (options.copyButton === false || container.dataset.codeCopy === "false") {
    surfaceActions = new Set(
      container.hasAttribute("data-expandable-surface") ? ["maximize"] : []
    );
  } else {
    surfaceActions = new Set(["copy"]);
    if (container.hasAttribute("data-expandable-surface")) {
      surfaceActions.add("maximize");
    }
  }

  /** @type {HTMLTextAreaElement | null} */
  let editorEl = null;
  /** @type {HTMLElement | null} */
  let editorStackEl = null;
  /** @type {HTMLElement | null} */
  let toolbarEl = null;
  /** @type {HTMLButtonElement | null} */
  let lineNumbersToggle = null;
  /** @type {HTMLButtonElement | null} */
  let highlightToggle = null;
  /** @type {HTMLButtonElement | null} */
  let surfaceCopyBtn = null;
  /** @type {ReturnType<typeof armPasteCapture> | null} */
  let pasteCapture = null;

  function currentSource() {
    return mode === "edit" && editorEl ? editorEl.value : source;
  }

  function commitSource(next) {
    source = next;
    code.dataset.source = next;
    if (editorEl) editorEl.value = next;
    refreshDisplay();
  }

  function ensureEditorStack() {
    if (editorEl && editorStackEl) {
      return { stack: editorStackEl, editor: editorEl };
    }

    editorStackEl = document.createElement("div");
    editorStackEl.className = "code-block-editor-stack";
    pre.parentNode?.insertBefore(editorStackEl, pre);
    editorStackEl.appendChild(pre);

    editorEl = document.createElement("textarea");
    editorEl.className = "code-block-editor";
    editorEl.spellcheck = false;
    editorEl.setAttribute("autocapitalize", "off");
    editorEl.setAttribute("autocomplete", "off");
    editorEl.setAttribute(
      "aria-label",
      container.dataset.codeEditorLabel || "Code editor"
    );
    editorStackEl.appendChild(editorEl);

    editorEl.addEventListener("input", () => {
      source = editorEl.value;
      code.dataset.source = source;
      refreshDisplay();
    });

    editorEl.addEventListener("scroll", () => {
      syncScrollPosition();
    });

    editorEl.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        insertTabAtCursor(editorEl);
        source = editorEl.value;
        code.dataset.source = source;
        refreshDisplay();
      }
    });

    return { stack: editorStackEl, editor: editorEl };
  }

  function syncSourceFromEditor() {
    if (!editorEl) return;
    source = editorEl.value;
    code.dataset.source = source;
  }

  function syncScrollPosition() {
    if (!editorEl) return;
    pre.scrollTop = editorEl.scrollTop;
    if (pre.classList.contains("line-numbers")) {
      code.scrollLeft = editorEl.scrollLeft;
      pre.scrollLeft = 0;
    } else {
      pre.scrollLeft = editorEl.scrollLeft;
    }
  }

  function applyLineNumbersClass() {
    pre.classList.toggle("line-numbers", lineNumbersEnabled && highlightEnabled);
  }

  function renderPlain() {
    removeLineNumberMarkup(code);
    pre.className = "";
    code.className = "";
    code.textContent = source;
  }

  function renderHighlighted() {
    if (!window.Prism || !language) {
      renderPlain();
      return;
    }

    removeLineNumberMarkup(code);
    code.textContent = source;
    code.className = `language-${language}`;
    pre.className = `language-${language}`;
    applyLineNumbersClass();
    window.Prism.highlightElement(code);
    /* Prism injects rows into `code`; discard those and keep a single set on `pre`. */
    code.querySelector(".line-numbers-rows")?.remove();
    code.querySelector(".line-numbers-sizer")?.remove();
    if (pre.classList.contains("line-numbers")) {
      renderLineNumberRows(pre, countDisplayLines(source));
    }
  }

  function syncToggleStates() {
    lineNumbersToggle?.setAttribute(
      "aria-pressed",
      lineNumbersEnabled ? "true" : "false"
    );
    highlightToggle?.setAttribute(
      "aria-pressed",
      highlightEnabled ? "true" : "false"
    );
    updateLineNumbersToggle(lineNumbersToggle, highlightEnabled);
  }

  function syncLineNumberRows() {
    if (!lineNumbersEnabled || !highlightEnabled) return;
    if (!pre.classList.contains("line-numbers")) return;
    code.querySelector(".line-numbers-rows")?.remove();
    code.querySelector(".line-numbers-sizer")?.remove();
    renderLineNumberRows(pre, countDisplayLines(source));
  }

  function refreshDisplay() {
    const scrollTop = editorEl?.scrollTop ?? 0;
    const scrollLeft = editorEl?.scrollLeft ?? 0;

    if (highlightEnabled) {
      renderHighlighted();
    } else {
      renderPlain();
    }
    syncToggleStates();
    syncEditableToolbarActions();
    syncLineNumberRows();

    if (mode === "edit" && editorEl) {
      editorEl.scrollTop = scrollTop;
      editorEl.scrollLeft = scrollLeft;
      syncScrollPosition();
    }
  }

  function syncEditableToolbarActions() {
    const editable = mode !== "view";
    const hasContent = currentSource().length > 0;

    for (const action of ["clear", "paste", "copy"]) {
      const btn = toolbarEl?.querySelector(
        `[data-code-toolbar-action="${action}"]`
      );
      if (!(btn instanceof HTMLButtonElement)) continue;
      let enabled = true;
      if (action === "paste") enabled = editable;
      else if (action === "clear") enabled = editable && hasContent;
      else enabled = hasContent;
      btn.disabled = !enabled;
      btn.setAttribute("aria-disabled", enabled ? "false" : "true");
    }

    const surfaceCopyEnabled =
      surfaceActions.has("copy") && mode !== "view" && hasContent;
    if (surfaceCopyBtn) {
      setHidden(surfaceCopyBtn, !surfaceActions.has("copy"));
      surfaceCopyBtn.disabled = !surfaceCopyEnabled;
    }
  }

  /**
   * @param {HTMLButtonElement} btn
   * @param {boolean} ok
   */
  function flashCopyFeedback(btn, ok) {
    const flash = ok ? "Copied" : "Failed";
    const labelEl = btn.querySelector(".code-block-toolbar__label");
    if (labelEl) {
      const prevAria = btn.getAttribute("aria-label") || "Copy code";
      const idleText = "Copy";
      btn.setAttribute("aria-label", flash);
      setToolbarButtonText(btn, flash);
      window.setTimeout(() => {
        btn.setAttribute("aria-label", prevAria);
        setToolbarButtonText(btn, idleText);
      }, 2000);
      return;
    }

    flashTooltip(btn, {
      text: flash,
      tone: ok ? "success" : "error",
    });
  }

  async function handleCopy(btn) {
    const ok = await copyText(currentSource());
    flashCopyFeedback(btn, ok);
  }

  async function handlePaste(btn) {
    if (mode === "view") return;

    const useTooltip = Object.hasOwn(btn.dataset, "tooltip");

    if (pasteCapture) {
      pasteCapture.cancel();
      pasteCapture = null;
      btn.setAttribute("aria-label", "Paste code");
      if (useTooltip) {
        btn.dataset.tooltip = "Paste";
        delete btn.dataset.tooltipTone;
      }
      setToolbarButtonText(btn, "Paste");
      return;
    }

    let text = await readText();
    if (text === null) {
      btn.setAttribute("aria-label", "Press Control V to paste");
      if (useTooltip) {
        btn.dataset.tooltip = "Press Ctrl+V to paste";
        btn.dataset.tooltipTone = "error";
      }
      setToolbarButtonText(btn, "Ctrl+V");
      pasteCapture = armPasteCapture({ timeoutMs: 15000 });
      text = await pasteCapture.promise;
      pasteCapture = null;
      btn.setAttribute("aria-label", "Paste code");
      if (useTooltip) {
        btn.dataset.tooltip = "Paste";
        delete btn.dataset.tooltipTone;
      }
      setToolbarButtonText(btn, "Paste");
      if (text === null) return;
    }

    commitSource(normalizeSource(text));
  }

  function handleClear() {
    if (mode === "view") return;
    commitSource("");
  }

  function onToolbarClick(event) {
    const btn = event.target.closest("[data-code-toolbar-action]");
    if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;
    if (!toolbarEl?.contains(btn)) return;

    const action = btn.dataset.codeToolbarAction;
    if (action === "line-numbers") {
      if (!highlightEnabled) return;
      lineNumbersEnabled = !lineNumbersEnabled;
      refreshDisplay();
      return;
    }
    if (action === "highlight") {
      highlightEnabled = !highlightEnabled;
      refreshDisplay();
      return;
    }
    if (action === "clear") {
      handleClear();
      return;
    }
    if (action === "copy") {
      void handleCopy(btn);
      return;
    }
    if (action === "paste") {
      void handlePaste(btn);
    }
    // maximize: expandable-surface listens for data-expandable-surface-open
  }

  function rebuildToolbar() {
    container.querySelectorAll(".code-block-toolbar").forEach((el) => el.remove());
    toolbarEl = null;
    lineNumbersToggle = null;
    highlightToggle = null;

    container.classList.remove(
      "code-block--toolbar-top",
      "code-block--toolbar-bottom"
    );
    container.dataset.codeToolbar = toolbarPosition;

    if (toolbarPosition === "none" || toolbarActions.size === 0) {
      return;
    }

    toolbarEl = document.createElement("div");
    toolbarEl.className = "code-block-toolbar";
    toolbarEl.setAttribute("role", "group");
    toolbarEl.setAttribute("aria-label", "Code block options");

    const startGroup = document.createElement("div");
    startGroup.className = "code-block-toolbar__group code-block-toolbar__group--left";
    const endGroup = document.createElement("div");
    endGroup.className = "code-block-toolbar__group code-block-toolbar__group--right";

    const specs = {
      clear: {
        label: "Clear code",
        icon: "clear",
        textLabel: "Clear",
      },
      copy: {
        label: "Copy code",
        icon: "copy",
        textLabel: "Copy",
      },
      paste: {
        label: "Paste code",
        icon: "paste",
        textLabel: "Paste",
      },
      maximize: {
        label: "Maximise",
        tooltip: "Maximise",
        icon: "fullscreen",
      },
      "line-numbers": {
        label: "Line numbers",
        tooltip: "Line numbers",
        icon: "lines",
        pressed: lineNumbersEnabled,
      },
      highlight: {
        label: "Highlight",
        tooltip: "Highlight",
        icon: "highlight",
        pressed: highlightEnabled,
      },
    };

    for (const action of TOOLBAR_ACTION_IDS) {
      if (!toolbarActions.has(action)) continue;
      const btn = createToolbarButton(action, specs[action]);
      const side = resolveToolbarAlign(action, toolbarAlign);
      btn.dataset.codeToolbarAlign = side;
      (side === "right" ? endGroup : startGroup).appendChild(btn);
      if (action === "line-numbers") lineNumbersToggle = btn;
      if (action === "highlight") highlightToggle = btn;
    }

    toolbarEl.append(startGroup, endGroup);
    toolbarEl.addEventListener("click", onToolbarClick);

    if (toolbarPosition === "bottom") {
      container.classList.add("code-block--toolbar-bottom");
      container.appendChild(toolbarEl);
    } else {
      container.classList.add("code-block--toolbar-top");
      container.insertBefore(toolbarEl, body);
    }

    syncToggleStates();
    syncEditableToolbarActions();
  }

  function rebuildSurfaceActions() {
    const existingExpand = body.querySelector(".expandable-surface__expand");
    body.querySelector(".surface-actions")?.remove();
    body.querySelectorAll(".code-block-copy").forEach((el) => el.remove());
    surfaceCopyBtn = null;

    if (!surfaceActions.has("copy") && !surfaceActions.has("maximize")) {
      existingExpand?.remove();
      return;
    }

    const actionsHost = document.createElement("div");
    actionsHost.className = "surface-actions";

    if (surfaceActions.has("copy")) {
      surfaceCopyBtn = document.createElement("button");
      surfaceCopyBtn.type = "button";
      surfaceCopyBtn.className = "btn btn-slim btn-icon code-block-copy";
      surfaceCopyBtn.setAttribute("aria-label", "Copy code");
      surfaceCopyBtn.dataset.tooltip = "Copy";
      surfaceCopyBtn.dataset.tooltipPosition = "top";
      surfaceCopyBtn.append(createIcon("copy", { className: "btn-icon-svg" }));
      surfaceCopyBtn.addEventListener("click", () => {
        if (surfaceCopyBtn?.disabled) return;
        void handleCopy(surfaceCopyBtn);
      });
      actionsHost.appendChild(surfaceCopyBtn);
    }

    if (existingExpand && surfaceActions.has("maximize")) {
      actionsHost.prepend(existingExpand);
    } else {
      existingExpand?.remove();
    }

    if (actionsHost.childNodes.length === 0) {
      return;
    }

    body.insertBefore(actionsHost, body.firstChild);
    syncEditableToolbarActions();
  }

  function applyMode() {
    container.classList.remove(
      "code-block--view",
      "code-block--select",
      "code-block--edit"
    );
    container.classList.add(`code-block--${mode}`);
    container.dataset.codeMode = mode;

    if (mode === "edit") {
      const { editor } = ensureEditorStack();
      editor.value = source;
      setHidden(editor, false);
      setHidden(pre, false);
      refreshDisplay();
    } else {
      if (editorEl) {
        setHidden(editorEl, true);
      }
      setHidden(pre, false);
      refreshDisplay();
    }
  }

  function writeToolbarAttrs() {
    container.dataset.codeToolbar = toolbarPosition;
    container.dataset.codeToolbarActions = [...toolbarActions].join(",");
    const alignAttr = serializeToolbarAlign(toolbarAlign, toolbarActions);
    if (alignAttr) {
      container.dataset.codeToolbarAlign = alignAttr;
    } else {
      delete container.dataset.codeToolbarAlign;
    }
    container.dataset.codeSurfaceActions = [...surfaceActions].join(",") || "none";
  }

  rebuildToolbar();
  rebuildSurfaceActions();
  applyMode();
  writeToolbarAttrs();

  return {
    setLineNumbers(enabled) {
      lineNumbersEnabled = enabled;
      refreshDisplay();
    },
    setHighlight(enabled) {
      highlightEnabled = enabled;
      refreshDisplay();
    },
    getSource() {
      return currentSource();
    },
    setSource(next) {
      commitSource(normalizeSource(String(next ?? "")));
    },
    getMode() {
      return mode;
    },
    setMode(nextMode) {
      const parsed = parseMode(nextMode);
      if (parsed === mode) return;

      if (mode === "edit") {
        syncSourceFromEditor();
      }

      mode = parsed;
      applyMode();
    },
    getToolbarPosition() {
      return toolbarPosition;
    },
    setToolbarPosition(next) {
      const parsed = parseToolbarPosition(next) ?? "none";
      if (parsed === toolbarPosition) return;
      toolbarPosition = parsed;
      rebuildToolbar();
      writeToolbarAttrs();
    },
    setToolbarActions(actions) {
      const raw = Array.isArray(actions) ? actions.join(",") : String(actions ?? "");
      toolbarActions = parseActionList(raw, TOOLBAR_ACTION_IDS) ?? new Set();
      if (toolbarPosition === "none" && toolbarActions.size > 0) {
        toolbarPosition = "top";
      }
      rebuildToolbar();
      writeToolbarAttrs();
    },
    /**
     * @param {string[] | string | Record<string, "left" | "right">} alignments
     *   e.g. `"maximize:right,copy:left"`, `["maximize:right"]`, or `{ maximize: "right" }`
     */
    setToolbarAlign(alignments) {
      const raw = Array.isArray(alignments)
        ? alignments.join(",")
        : typeof alignments === "object" && alignments
          ? Object.entries(alignments)
              .map(([id, side]) => `${id}:${side}`)
              .join(",")
          : String(alignments ?? "");
      toolbarAlign = parseToolbarAlign(raw, TOOLBAR_ACTION_IDS) ?? new Map();
      rebuildToolbar();
      writeToolbarAttrs();
    },
    setSurfaceActions(actions) {
      const raw = Array.isArray(actions) ? actions.join(",") : String(actions ?? "");
      surfaceActions = parseActionList(raw, SURFACE_ACTION_IDS) ?? new Set();
      rebuildSurfaceActions();
      writeToolbarAttrs();
    },
  };
}

/** Wire every `.code-block` in `root`. */
export function initCodeBlocks(root = document) {
  const instances = [];
  for (const container of root.querySelectorAll(".code-block")) {
    const instance = initCodeBlock(container);
    if (instance) instances.push(instance);
  }
  return instances;
}

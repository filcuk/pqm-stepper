/**
 * Machine-readable framework inventory (source of truth for manifests / sync).
 * Keep in sync with `.cursor/skills/_shared/component-map.md`.
 *
 * Paths are repo-root relative, POSIX-style.
 */

/** Paths (and directory prefixes ending in `/`) sync must never overwrite. */
export const APP_OWNED = [
  "app/main.js",
  "app/demo.js",
  "app/config.js",
  "app/styles.css",
  "app/css/app.css",
  "app/utils/icons-app.js",
  "app/res/",
  "index.html",
  "demo.html",
];

/** Fields inside otherwise-shared files that remain fork-owned. */
export const APP_OWNED_FIELDS = {
  "app/version.js": ["APP_VERSION"],
};

/**
 * CSS partial basenames in `@import` order for the full catalogue
 * (`app/css/framework.css`).
 */
export const CSS_INDEX_ORDER = [
  "layout.css",
  "code-block.css",
  "controls-buttons.css",
  "controls-badges.css",
  "controls-chips.css",
  "controls-fields.css",
  "controls-widgets.css",
  "controls-section-panel.css",
  "controls-menus.css",
  "controls-disclosure.css",
  "controls-file.css",
  "controls-image.css",
  "controls-color.css",
  "controls-charts.css",
  "controls-diagram.css",
  "overlays.css",
  "tutorial.css",
  "rich-text-editor.css",
  "table.css",
  "controls-tabular-input.css",
];

/** Always shipped with `initShell` (plus core CSS / icons below). */
export const CORE = {
  files: [
    "app/theme-init.js",
    "app/version.js",
    "app/tokens.css",
    "app/shell/shell.js",
    "app/shell/render-shell.js",
    "app/shell/theme.js",
    "app/shell/page-nav.js",
    "app/shell/sticky.js",
    "app/shell/title-numbering.js",
    "app/shell/also-see.js",
    "app/shell/external-link.js",
    "app/shell/heading-link.js",
    "app/utils/dom.js",
    "app/utils/document-listeners.js",
    "app/utils/clipboard.js",
    "app/utils/button-label.js",
    "app/utils/icons.js",
    "app/utils/icons-framework.js",
    "app/utils/brand-icon.js",
    "app/utils/also-see-svg.js",
    "app/utils/menu.js",
    "app/components/tooltip.js",
    "app/components/banner.js",
  ],
  css: ["layout.css", "controls-buttons.css", "overlays.css"],
  icons: [
    "light-mode",
    "dark-mode",
    "auto-mode",
    "chevron-up",
    "chevron-down",
    "arrow-outward",
    "link",
  ],
};

/**
 * Shared infra ids referenced by components (`infra` arrays below).
 * `icons-app.js` is app-owned and omitted here.
 */
export const INFRA = {
  dom: ["app/utils/dom.js"],
  "document-listeners": ["app/utils/document-listeners.js"],
  clipboard: ["app/utils/clipboard.js"],
  "button-label": ["app/utils/button-label.js"],
  color: ["app/utils/color.js"],
  icons: ["app/utils/icons.js", "app/utils/icons-framework.js"],
  menu: ["app/utils/menu.js"],
  config: ["app/config.js"],
  "brand-icon": ["app/utils/brand-icon.js"],
  "also-see-svg": ["app/utils/also-see-svg.js"],
  "sanitize-svg": ["app/utils/sanitize-svg.js"],
};

/**
 * Optional catalogue features. `css` entries are basenames under `app/css/`.
 * `vendor` entries may be files or directories (trailing `/`).
 */
export const COMPONENTS = {
  tooltip: {
    files: ["app/components/tooltip.js"],
    css: ["overlays.css"],
    vendor: [],
    icons: [],
    infra: [],
    always: true,
  },
  banner: {
    files: ["app/components/banner.js"],
    css: ["overlays.css"],
    vendor: [],
    icons: ["note", "info", "success", "important", "warning", "error", "help", "experiment", "format-quote", "tip"],
    infra: ["dom", "icons"],
    always: true,
  },
  dialog: {
    files: ["app/components/dialog.js"],
    css: ["overlays.css"],
    vendor: [],
    icons: [],
    infra: ["dom", "document-listeners"],
  },
  "about-dialog": {
    files: [
      "app/components/about-dialog.js",
      "app/components/dialog.js",
    ],
    css: ["overlays.css"],
    vendor: [],
    icons: [],
    infra: ["dom", "document-listeners"],
    notes: "Also uses layout.css .tagline-link; wraps initDialog",
  },
  popover: {
    files: ["app/components/popover.js"],
    css: ["overlays.css"],
    vendor: [],
    icons: ["clear"],
    infra: ["dom", "document-listeners", "icons"],
    notes: "Speech-bubble card; optional action icons (e.g. chevrons)",
  },
  tutorial: {
    files: [
      "app/components/tutorial.js",
      "app/components/popover.js",
    ],
    css: ["tutorial.css", "overlays.css"],
    vendor: [],
    icons: ["clear", "chevron-left", "chevron-right"],
    infra: ["dom", "document-listeners", "icons"],
    notes: "Spotlight tour; Escape priority 110; wraps initPopover",
  },
  badge: {
    files: ["app/components/badge.js"],
    css: ["controls-badges.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  chip: {
    files: ["app/components/chip.js"],
    css: ["controls-chips.css"],
    vendor: [],
    icons: ["error"],
    infra: ["dom", "icons"],
  },
  legend: {
    files: ["app/components/legend.js"],
    css: ["controls-chips.css"],
    vendor: [],
    icons: [],
    infra: [],
    notes: "Coloured category chips; slots 1–8; optional toggle; tooltips via data-tooltip / initShell",
  },
  combobox: {
    files: ["app/components/combobox.js"],
    css: ["controls-fields.css", "controls-badges.css"],
    vendor: [],
    icons: [],
    infra: ["dom", "document-listeners"],
    notes: "Multi via data-combobox-multi; multi also uses badge",
  },
  "date-picker": {
    files: [
      "app/components/date-picker/index.js",
      "app/components/date-picker/calendar.js",
      "app/components/date-picker/parse.js",
      "app/components/time-picker/index.js",
      "app/components/time-picker/panel.js",
      "app/components/time-picker/field.js",
    ],
    css: ["controls-fields.css"],
    vendor: [],
    icons: ["calendar", "chevron-up", "chevron-down"],
    infra: ["dom", "document-listeners", "icons"],
    notes: "Optional side-by-side time panel",
  },
  "time-picker": {
    files: [
      "app/components/time-picker.js",
      "app/components/time-picker/index.js",
      "app/components/time-picker/panel.js",
      "app/components/time-picker/field.js",
    ],
    css: ["controls-fields.css"],
    vendor: [],
    icons: ["clock", "chevron-up", "chevron-down"],
    infra: ["dom", "document-listeners", "icons"],
    notes: "Custom segmented popup; legacy native field fallback",
  },
  "duration-input": {
    files: [
      "app/components/duration-input.js",
      "app/components/time-picker/panel.js",
    ],
    css: ["controls-fields.css"],
    vendor: [],
    icons: ["clock", "chevron-up", "chevron-down"],
    infra: ["dom", "document-listeners", "icons"],
    notes: "Inline segments + shared popup in duration mode",
  },
  "color-input": {
    files: ["app/components/color-input.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom", "color"],
    notes:
      "Optional openOnClick nests/uses color-set and color-picker (keep those components when using open hooks)",
  },
  "color-set": {
    files: [
      "app/components/color-set/index.js",
      "app/components/color-set/panel.js",
      "app/components/color-set/registry.js",
      "app/components/color-set/sets/index.js",
      "app/components/color-set/sets/basic.js",
      "app/components/color-set/sets/fluent.js",
      "app/components/color-set/sets/metro.js",
      "app/components/color-set/sets/flat-ui.js",
      "app/components/color-set/sets/material.js",
      "app/components/color-set/sets/tailwind.js",
      "app/components/color-set/sets/web-safe.js",
    ],
    css: ["controls-color.css"],
    vendor: [],
    icons: [],
    infra: ["dom", "document-listeners", "color"],
  },
  "color-picker": {
    files: [
      "app/components/color-picker/index.js",
      "app/components/color-picker/panel.js",
      "app/components/slider.js",
    ],
    css: ["controls-color.css", "controls-menus.css", "controls-widgets.css"],
    vendor: [],
    icons: ["chevron-down", "palette"],
    infra: ["dom", "document-listeners", "color", "menu", "icons"],
    notes: "Uses slider for RGB/CMYK/alpha channels; optional adjacent colour set via color-set",
  },
  toggle: {
    files: ["app/components/toggle.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: ["check", "remove"],
    infra: ["dom", "icons"],
  },
  "toggle-button": {
    files: ["app/components/toggle-button.js"],
    css: ["controls-buttons.css"],
    vendor: [],
    icons: ["fullscreen", "fullscreen-exit"],
    infra: ["dom", "icons"],
    notes:
      "Pressed .btn-toggle; optional next-action label/icon swap; data-toggle-button-always-active",
  },
  checkbox: {
    files: ["app/components/checkbox.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  "segmented-control": {
    files: ["app/components/segmented-control.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  pagination: {
    files: ["app/components/pagination.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  "progress-bar": {
    files: ["app/components/progress-bar.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  spinner: {
    files: ["app/components/spinner.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  slider: {
    files: ["app/components/slider.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  stepper: {
    files: ["app/components/stepper.js"],
    css: ["controls-widgets.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  combo: {
    files: ["app/components/combo.js"],
    css: ["controls-menus.css"],
    vendor: [],
    icons: [],
    infra: ["menu"],
  },
  dropdown: {
    files: ["app/components/dropdown.js"],
    css: ["controls-menus.css"],
    vendor: [],
    icons: [],
    infra: ["menu"],
  },
  "dropdown-toggle": {
    files: ["app/components/dropdown-toggle.js"],
    css: ["controls-menus.css"],
    vendor: [],
    icons: [],
    infra: ["menu"],
    notes: "Uses badge for selection count",
  },
  expand: {
    files: ["app/components/expand.js"],
    css: ["controls-disclosure.css"],
    vendor: [],
    icons: ["chevron-right"],
    infra: ["dom", "icons"],
  },
  accordion: {
    files: ["app/components/accordion.js"],
    css: ["controls-disclosure.css"],
    vendor: [],
    icons: ["chevron-right"],
    infra: ["dom", "icons"],
  },
  tabs: {
    files: ["app/components/tabs.js"],
    css: ["controls-disclosure.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  "progress-indicator": {
    files: ["app/components/progress-indicator.js"],
    css: ["controls-disclosure.css"],
    vendor: [],
    icons: [],
    infra: ["dom"],
  },
  "file-dropzone": {
    files: ["app/components/file-dropzone.js"],
    css: ["controls-file.css"],
    vendor: [],
    icons: ["upload", "error"],
    infra: ["dom", "icons"],
  },
  "file-download": {
    files: ["app/components/file-download.js"],
    css: ["controls-file.css"],
    vendor: [],
    icons: ["upload"],
    infra: ["icons"],
  },
  "image-preview": {
    files: ["app/components/image-preview.js"],
    css: ["controls-image.css"],
    vendor: [],
    icons: ["download"],
    infra: ["dom", "icons", "sanitize-svg"],
  },
  "code-block": {
    files: ["app/components/code-block.js"],
    css: ["code-block.css"],
    vendor: ["app/vendor/prism/", "app/prism.css"],
    icons: ["clear", "copy", "paste", "lines", "highlight", "fullscreen"],
    infra: ["dom", "clipboard", "button-label", "icons"],
  },
  "expandable-surface": {
    files: ["app/components/expandable-surface.js"],
    css: ["code-block.css"],
    vendor: [],
    icons: ["fullscreen", "fullscreen-exit"],
    infra: ["dom", "document-listeners", "icons"],
  },
  table: {
    files: ["app/components/table.js"],
    css: ["table.css"],
    vendor: [],
    icons: ["chevron-up"],
    infra: ["dom", "icons"],
  },
  "tabular-input": {
    files: ["app/components/tabular-input.js"],
    css: ["controls-tabular-input.css"],
    vendor: [],
    icons: [
      "copy",
      "paste",
      "paste-special",
      "plus",
      "delete",
      "remove",
      "chevron-up",
      "chevron-down",
    ],
    infra: ["dom", "document-listeners", "menu", "icons", "clipboard", "button-label"],
  },
  "rich-text-editor": {
    files: [
      "app/components/rich-text-editor.js",
      "app/components/segmented-control.js",
    ],
    css: ["rich-text-editor.css", "controls-widgets.css"],
    vendor: [
      "app/vendor/toastui-editor/",
      "app/vendor/toastui-editor-plugin-table-merged-cell/",
      "app/toastui-editor.css",
    ],
    icons: [],
    infra: ["config", "dom"],
    notes: "Mode switch uses segmented-control",
  },
  charts: {
    files: ["app/components/charts.js"],
    css: ["controls-charts.css"],
    vendor: [
      "app/vendor/tanstack-charts/",
      "app/vendor/d3-scale/",
      "app/vendor/d3-shape/",
    ],
    icons: [],
    infra: ["config"],
    notes:
      "Thin mountChart host; pages need an import map for d3-scale / d3-shape when using barY / barX",
  },
  diagram: {
    files: ["app/components/diagram.js"],
    css: ["controls-diagram.css"],
    vendor: ["app/vendor/mermaid/"],
    icons: [],
    infra: ["config", "dom"],
    notes:
      "Thin Mermaid host; ESM entry lazy-loads diagram chunks; theme follows light/dark",
  },
};

/** CSS-only / shell patterns (no dedicated component JS beyond shell). */
export const CSS_ONLY = {
  buttons: { css: ["controls-buttons.css"], always: true },
  toolbar: { css: ["controls-buttons.css"], always: true },
  fields: { css: ["controls-fields.css"] },
  "section-panel": { css: ["controls-section-panel.css"] },
  callout: { css: ["overlays.css"] },
};

/** Which features need each CSS partial (for trim / index generation). */
export const CSS_PARTIAL_FEATURES = {
  "layout.css": ["shell", "page-nav", "sticky", "title-numbering", "theme-toggle", "about-dialog"],
  "controls-buttons.css": ["buttons", "toolbar", "toggle-button"],
  "overlays.css": ["tooltip", "banner", "dialog", "about-dialog", "callout", "popover", "tutorial"],
  "tutorial.css": ["tutorial"],
  "code-block.css": ["code-block", "expandable-surface"],
  "controls-badges.css": ["badge", "combobox", "dropdown-toggle"],
  "controls-chips.css": ["chip", "legend"],
  "controls-fields.css": [
    "fields",
    "combobox",
    "date-picker",
    "time-picker",
    "duration-input",
  ],
  "controls-widgets.css": [
    "toggle",
    "checkbox",
    "segmented-control",
    "pagination",
    "progress-bar",
    "spinner",
    "slider",
    "stepper",
    "color-input",
    "color-picker",
    "rich-text-editor",
  ],
  "controls-section-panel.css": ["section-panel"],
  "controls-menus.css": ["combo", "dropdown", "dropdown-toggle", "color-picker"],
  "controls-disclosure.css": [
    "expand",
    "accordion",
    "tabs",
    "progress-indicator",
  ],
  "controls-file.css": ["file-dropzone", "file-download"],
  "controls-image.css": ["image-preview"],
  "controls-color.css": ["color-set", "color-picker"],
  "controls-charts.css": ["charts"],
  "controls-diagram.css": ["diagram"],
  "rich-text-editor.css": ["rich-text-editor"],
  "table.css": ["table"],
  "controls-tabular-input.css": ["tabular-input"],
};

/** Regenerated by sync/verify; not treated as a durable hand-edited file. */
export const DERIVED_FILES = ["app/css/framework.css"];

export const DEFAULT_SOURCE = "filcuk/sma1-framework";

/**
 * Framework-owned Cursor skills (stable ids). `_shared` is always selected when
 * any skill is selected. Fork-local skills use other folder names and are never listed here.
 * Optional per entry: `previousFiles`, `forkFacing` (default true).
 */
export const AGENT_SKILLS = {
  _shared: {
    files: [
      ".cursor/skills/_shared/component-map.md",
      ".cursor/skills/_shared/invariants.md",
    ],
    always: true,
    forkFacing: true,
  },
  "init-app": {
    files: [".cursor/skills/init-app/SKILL.md"],
    forkFacing: true,
  },
  "migrate-framework": {
    files: [".cursor/skills/migrate-framework/SKILL.md"],
    forkFacing: true,
  },
  "sync-shell": {
    files: [".cursor/skills/sync-shell/SKILL.md"],
    forkFacing: true,
  },
  "restore-component": {
    files: [".cursor/skills/restore-component/SKILL.md"],
    forkFacing: true,
  },
  "finalize-app": {
    files: [".cursor/skills/finalize-app/SKILL.md"],
    forkFacing: true,
  },
  "handle-assets": {
    files: [".cursor/skills/handle-assets/SKILL.md"],
    forkFacing: true,
  },
  "manage-color": {
    files: [
      ".cursor/skills/manage-color/SKILL.md",
      ".cursor/skills/manage-color/scripts/contrast.mjs",
    ],
    forkFacing: true,
  },
  "add-icon": {
    files: [
      ".cursor/skills/add-icon/SKILL.md",
      ".cursor/skills/add-icon/scripts/fetch-icon.mjs",
    ],
    forkFacing: true,
  },
  "health-check": {
    files: [".cursor/skills/health-check/SKILL.md"],
    forkFacing: true,
  },
  "author-component": {
    files: [".cursor/skills/author-component/SKILL.md"],
    forkFacing: false,
  },
  "release-framework": {
    files: [".cursor/skills/release-framework/SKILL.md"],
    forkFacing: false,
  },
};

/** Framework-owned Cursor rules (always synced with the agent set). */
export const AGENT_RULES = [
  ".cursor/rules/demo-isolation.mdc",
  ".cursor/rules/icons.mdc",
  ".cursor/rules/usage-docs.mdc",
  ".cursor/rules/vendor.mdc",
];

/**
 * Ids still shipped but marked deprecated (must remain in COMPONENTS / AGENT_SKILLS).
 * Shape: { kind, replacedBy?, previousFiles?, deprecatedIn, notes? }
 * @type {Record<string, object>}
 */
export const DEPRECATED = {};

/**
 * Ids removed from the live catalogue. `previousFiles` are prune candidates.
 * Must include `deprecatedIn` from a prior release. Paths here must never be
 * reused by a new live file.
 * Shape: { kind, replacedBy?, previousFiles, deprecatedIn, retiredIn, notes? }
 * @type {Record<string, object>}
 */
export const RETIRED = {};

/**
 * Collect every path the live catalogue currently owns (install surface).
 * @param {{
 *   components?: typeof COMPONENTS,
 *   agentSkills?: typeof AGENT_SKILLS,
 *   agentRules?: string[],
 *   core?: typeof CORE,
 *   infra?: typeof INFRA,
 *   cssIndexOrder?: string[],
 * }} [opts]
 * @returns {Set<string>}
 */
export function collectLivePaths(opts = {}) {
  const components = opts.components || COMPONENTS;
  const agentSkills = opts.agentSkills || AGENT_SKILLS;
  const agentRules = opts.agentRules || AGENT_RULES;
  const core = opts.core || CORE;
  const infra = opts.infra || INFRA;
  const cssIndexOrder = opts.cssIndexOrder || CSS_INDEX_ORDER;

  /** @type {Set<string>} */
  const live = new Set();

  const addAll = (paths) => {
    for (const p of paths || []) live.add(p);
  };

  addAll(core.files);
  for (const basename of cssIndexOrder) {
    live.add(`app/css/${basename}`);
  }
  for (const paths of Object.values(infra)) {
    addAll(paths);
  }
  for (const def of Object.values(components)) {
    addAll(def.files);
    addAll(def.vendor);
    // Directory vendor prefixes stay as prefixes; concrete expand happens at manifest time
  }
  for (const def of Object.values(agentSkills)) {
    addAll(def.files);
  }
  addAll(agentRules);

  return live;
}

/**
 * Collect previousFiles from live entries + deprecated + retired maps.
 * @param {{
 *   components?: typeof COMPONENTS,
 *   agentSkills?: typeof AGENT_SKILLS,
 *   deprecated?: typeof DEPRECATED,
 *   retired?: typeof RETIRED,
 * }} [opts]
 * @returns {{ path: string, source: string }[]}
 */
export function collectPreviousFileEntries(opts = {}) {
  const components = opts.components || COMPONENTS;
  const agentSkills = opts.agentSkills || AGENT_SKILLS;
  const deprecated = opts.deprecated || DEPRECATED;
  const retired = opts.retired || RETIRED;

  /** @type {{ path: string, source: string }[]} */
  const out = [];

  for (const [id, def] of Object.entries(components)) {
    for (const p of def.previousFiles || []) {
      out.push({ path: p, source: `components.${id}.previousFiles` });
    }
  }
  for (const [id, def] of Object.entries(agentSkills)) {
    for (const p of def.previousFiles || []) {
      out.push({ path: p, source: `agentSkills.${id}.previousFiles` });
    }
  }
  for (const [id, def] of Object.entries(deprecated)) {
    for (const p of def.previousFiles || []) {
      out.push({ path: p, source: `deprecated.${id}.previousFiles` });
    }
  }
  for (const [id, def] of Object.entries(retired)) {
    for (const p of def.previousFiles || []) {
      out.push({ path: p, source: `retired.${id}.previousFiles` });
    }
  }

  return out;
}

/**
 * Validate deprecate/retire maps and path-reuse rules.
 * @param {{
 *   components?: typeof COMPONENTS,
 *   agentSkills?: typeof AGENT_SKILLS,
 *   agentRules?: string[],
 *   core?: typeof CORE,
 *   infra?: typeof INFRA,
 *   cssIndexOrder?: string[],
 *   deprecated?: typeof DEPRECATED,
 *   retired?: typeof RETIRED,
 *   livePaths?: Set<string>,
 * }} [opts]
 */
export function validateLifecycleCatalogue(opts = {}) {
  const components = opts.components || COMPONENTS;
  const agentSkills = opts.agentSkills || AGENT_SKILLS;
  const deprecated = opts.deprecated || DEPRECATED;
  const retired = opts.retired || RETIRED;
  const livePaths = opts.livePaths || collectLivePaths(opts);

  /** @type {string[]} */
  const errors = [];

  for (const [id, def] of Object.entries(deprecated)) {
    if (!(id in components) && !(id in agentSkills)) {
      errors.push(
        `deprecated.${id} must still exist in COMPONENTS or AGENT_SKILLS (still shipped)`
      );
    }
    if (!def.deprecatedIn) {
      errors.push(`deprecated.${id} missing deprecatedIn`);
    }
    if (def.kind !== "component" && def.kind !== "skill") {
      errors.push(`deprecated.${id} kind must be "component" or "skill"`);
    }
  }

  for (const [id, def] of Object.entries(retired)) {
    if (id in components || id in agentSkills) {
      errors.push(
        `retired.${id} must not remain in COMPONENTS or AGENT_SKILLS`
      );
    }
    if (!def.deprecatedIn) {
      errors.push(
        `retired.${id} missing deprecatedIn (retire only after a prior deprecated release)`
      );
    }
    if (!def.retiredIn) {
      errors.push(`retired.${id} missing retiredIn`);
    }
    if (!Array.isArray(def.previousFiles) || def.previousFiles.length === 0) {
      errors.push(`retired.${id} must list previousFiles to prune`);
    }
    if (def.kind !== "component" && def.kind !== "skill") {
      errors.push(`retired.${id} kind must be "component" or "skill"`);
    }
  }

  for (const { path: rel, source } of collectPreviousFileEntries(opts)) {
    if (livePaths.has(rel)) {
      errors.push(
        `path reuse forbidden: ${rel} is live and also listed in ${source}`
      );
    }
    // Directory-prefix live vendor entries (trailing /)
    for (const live of livePaths) {
      if (live.endsWith("/") && (rel === live.slice(0, -1) || rel.startsWith(live))) {
        errors.push(
          `path reuse forbidden: ${rel} falls under live prefix ${live} (${source})`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Lifecycle catalogue invalid:\n- ${errors.join("\n- ")}`);
  }
}

/**
 * Build the full or trimmed `framework.css` body (LF endings).
 * @param {string[]} [cssBasenames]
 */
export function renderFrameworkCssIndex(cssBasenames = CSS_INDEX_ORDER) {
  const lines = [
    "/**",
    " * Framework CSS index — lists shared partials under this directory.",
    " * Regenerated by framework sync/verify from the selected component set;",
    " * do not treat hand edits as durable in forks.",
    " */",
    ...cssBasenames.map((name) => `@import url("${name}");`),
    "",
  ];
  return lines.join("\n");
}

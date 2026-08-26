import { APP_CONFIG } from "../config.js";
import { APP_VERSION, FRAMEWORK_VERSION } from "../version.js";
import { sanitizeAlsoSeeSvg } from "../utils/also-see-svg.js";

const DEFAULTS = {
  repoUrl: APP_CONFIG.repoUrl,
  appUrl: APP_CONFIG.appUrl,
  alsoSee: APP_CONFIG.alsoSee,
  alsoSeeUrl: APP_CONFIG.alsoSeeUrl,
  alsoSeeTopics: APP_CONFIG.alsoSeeTopics,
  alsoSeeIncludeLocal: APP_CONFIG.alsoSeeIncludeLocal,
  appVersion: APP_VERSION,
  frameworkVersion: FRAMEWORK_VERSION,
};

/** Required markup for {@link initPageNav} — also injected by {@link renderPageShell}. */
export const PAGE_NAV_MARKUP = `<nav id="page-nav" class="page-nav" aria-label="Page navigation">
  <div class="page-nav-trigger">
    <div class="page-nav-stack">
      <div class="page-nav-panel">
        <ul class="page-nav-list"></ul>
      </div>
      <div class="page-nav-jumps">
        <span class="page-nav-jump-ring" aria-hidden="true"></span>
        <div class="page-nav-jump-inner">
          <button type="button" class="page-nav-jump page-nav-jump-up" data-page-nav="up" aria-label="Back to top">
            <span data-icon="chevron-up" data-icon-class="page-nav-icon-svg"></span>
          </button>
          <button type="button" class="page-nav-jump page-nav-jump-down" data-page-nav="down" aria-label="Jump to bottom">
            <span data-icon="chevron-down" data-icon-class="page-nav-icon-svg"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</nav>`;

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Normalize a site URL for equality checks (scheme, host, path; no query/hash; no trailing slash).
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSiteUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${path}`.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

/**
 * @typedef {{
 *   label: string,
 *   subtitle: string,
 *   url: string,
 *   icon: string,
 *   iconLight: string,
 *   iconDark: string,
 *   iconSvg: string,
 *   iconSvgLight: string,
 *   iconSvgDark: string,
 *   accent: string,
 *   accentLight: string,
 *   accentDark: string,
 *   accentHover: string,
 *   accentHoverLight: string,
 *   accentHoverDark: string,
 *   order: number | null,
 * }} AlsoSeeLink
 * @typedef {{
 *   topic: string | null,
 *   order: number | null,
 *   items: AlsoSeeLink[],
 * }} AlsoSeeSection
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimAlsoSeeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Accept only complete hex colours before writing remote/config values into
 * inline custom properties.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeAlsoSeeColor(value) {
  const color = trimAlsoSeeString(value);
  return /^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i.test(color) ? color : "";
}

/**
 * Resolve a single hex or a light/dark pair. Pair wins when either side is set;
 * a missing side clones the other (same as also-see icons).
 *
 * @param {unknown} single
 * @param {unknown} light
 * @param {unknown} dark
 * @returns {{ value: string, light: string, dark: string }}
 */
function normalizeAlsoSeeColorChoice(single, light, dark) {
  const pairLight = normalizeAlsoSeeColor(light);
  const pairDark = normalizeAlsoSeeColor(dark);
  if (pairLight || pairDark) {
    return {
      value: "",
      light: pairLight || pairDark,
      dark: pairDark || pairLight,
    };
  }
  return {
    value: normalizeAlsoSeeColor(single),
    light: "",
    dark: "",
  };
}

/**
 * @param {object} link
 * @returns {{
 *   accent: string,
 *   accentLight: string,
 *   accentDark: string,
 *   accentHover: string,
 *   accentHoverLight: string,
 *   accentHoverDark: string,
 * }}
 */
function normalizeAlsoSeeColors(link) {
  const accent = normalizeAlsoSeeColorChoice(
    /** @type {{ accent?: unknown }} */ (link).accent,
    /** @type {{ accentLight?: unknown }} */ (link).accentLight,
    /** @type {{ accentDark?: unknown }} */ (link).accentDark
  );
  const accentHover = normalizeAlsoSeeColorChoice(
    /** @type {{ accentHover?: unknown }} */ (link).accentHover,
    /** @type {{ accentHoverLight?: unknown }} */ (link).accentHoverLight,
    /** @type {{ accentHoverDark?: unknown }} */ (link).accentHoverDark
  );
  return {
    accent: accent.value,
    accentLight: accent.light,
    accentDark: accent.dark,
    accentHover: accentHover.value,
    accentHoverLight: accentHover.light,
    accentHoverDark: accentHover.dark,
  };
}

/**
 * Parse an optional numeric `order` from JSON / config.
 * Non-finite values are treated as missing (`null` → sort after numbered).
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseAlsoSeeOrder(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Sort key: finite orders ascending; missing orders after all finite ones.
 *
 * @param {number | null | undefined} order
 * @returns {number}
 */
function alsoSeeOrderKey(order) {
  return typeof order === "number" && Number.isFinite(order)
    ? order
    : Number.POSITIVE_INFINITY;
}

/**
 * Stable sort by `order`, then original index.
 *
 * @template {{ order?: number | null }} T
 * @param {T[]} items
 * @returns {T[]}
 */
function sortByAlsoSeeOrder(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byOrder = alsoSeeOrderKey(a.item.order) - alsoSeeOrderKey(b.item.order);
      if (byOrder !== 0) return byOrder;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * Prefer the lower finite `order` when merging sections; otherwise keep primary.
 *
 * @param {number | null | undefined} primary
 * @param {number | null | undefined} secondary
 * @returns {number | null}
 */
function mergeAlsoSeeOrder(primary, secondary) {
  const a = parseAlsoSeeOrder(primary);
  const b = parseAlsoSeeOrder(secondary);
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/**
 * @param {unknown} link
 * @param {string} exclude Normalized site URL to drop, or ""
 * @returns {AlsoSeeLink | null}
 */
function normalizeAlsoSeeLink(link, exclude) {
  if (!link || typeof link !== "object") return null;

  const label = typeof link.label === "string" ? link.label.trim() : "";
  const url = typeof link.url === "string" ? link.url.trim() : "";
  if (!label || !url) return null;
  if (exclude && normalizeSiteUrl(url) === exclude) return null;

  const subtitle =
    typeof link.subtitle === "string" ? link.subtitle.trim() : "";
  const order = parseAlsoSeeOrder(/** @type {{ order?: unknown }} */ (link).order);
  const iconSvg = trimAlsoSeeString(
    /** @type {{ iconSvg?: unknown }} */ (link).iconSvg
  );
  const iconSvgLight = trimAlsoSeeString(
    /** @type {{ iconSvgLight?: unknown }} */ (link).iconSvgLight
  );
  const iconSvgDark = trimAlsoSeeString(
    /** @type {{ iconSvgDark?: unknown }} */ (link).iconSvgDark
  );
  const colors = normalizeAlsoSeeColors(link);

  // Embedded SVG wins over URL icons (same pair / single precedence).
  if (iconSvgLight || iconSvgDark) {
    return {
      label,
      subtitle,
      url,
      icon: "",
      iconLight: "",
      iconDark: "",
      iconSvg: "",
      iconSvgLight: iconSvgLight || iconSvgDark,
      iconSvgDark: iconSvgDark || iconSvgLight,
      ...colors,
      order,
    };
  }

  if (iconSvg) {
    return {
      label,
      subtitle,
      url,
      icon: "",
      iconLight: "",
      iconDark: "",
      iconSvg,
      iconSvgLight: "",
      iconSvgDark: "",
      ...colors,
      order,
    };
  }

  const icon = trimAlsoSeeString(/** @type {{ icon?: unknown }} */ (link).icon);
  const iconLight = trimAlsoSeeString(
    /** @type {{ iconLight?: unknown }} */ (link).iconLight
  );
  const iconDark = trimAlsoSeeString(
    /** @type {{ iconDark?: unknown }} */ (link).iconDark
  );

  // Theme pair when either light/dark is set; otherwise a single always-visible icon.
  if (iconLight || iconDark) {
    return {
      label,
      subtitle,
      url,
      icon: "",
      iconLight: iconLight || iconDark,
      iconDark: iconDark || iconLight,
      iconSvg: "",
      iconSvgLight: "",
      iconSvgDark: "",
      ...colors,
      order,
    };
  }

  return {
    label,
    subtitle,
    url,
    icon,
    iconLight: "",
    iconDark: "",
    iconSvg: "",
    iconSvgLight: "",
    iconSvgDark: "",
    ...colors,
    order,
  };
}

/**
 * @typedef {{
 *   allowAll: boolean,
 *   include: Set<string>,
 *   exclude: Set<string>,
 *   includeUngrouped: boolean,
 *   excludeUngrouped: boolean,
 * }} AlsoSeeTopicFilter
 */

/**
 * Parse `alsoSeeTopics` filter entries.
 *
 * - `"*"` → include all topics (including ungrouped); only way to mean “all”
 * - `"Topic"` → include that topic (whitelist when `"*"` is absent)
 * - `""` → include ungrouped flat links (redundant with `"*"`)
 * - `"-Topic"` → exclude that topic (works with `"*"` or a whitelist)
 * - `"-"` → exclude ungrouped flat links
 * - `[]` / no include entries → include nothing
 *
 * @param {unknown} topics
 * @returns {AlsoSeeTopicFilter}
 */
function normalizeAlsoSeeTopicFilter(topics) {
  /** @type {AlsoSeeTopicFilter} */
  const filter = {
    allowAll: false,
    include: new Set(),
    exclude: new Set(),
    includeUngrouped: false,
    excludeUngrouped: false,
  };

  if (!Array.isArray(topics)) return filter;

  for (const entry of topics) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();

    if (trimmed === "*") {
      filter.allowAll = true;
      continue;
    }

    if (trimmed.startsWith("-")) {
      const name = trimmed.slice(1).trim();
      if (!name) {
        filter.excludeUngrouped = true;
      } else {
        filter.exclude.add(name.toLowerCase());
      }
      continue;
    }

    if (!trimmed) {
      filter.includeUngrouped = true;
      continue;
    }

    filter.include.add(trimmed.toLowerCase());
  }

  return filter;
}

/**
 * @param {AlsoSeeTopicFilter} topicFilter
 * @param {string} topic Trimmed topic label, or "" for ungrouped
 * @returns {boolean}
 */
function alsoSeeTopicAllowed(topicFilter, topic) {
  if (!topic) {
    if (topicFilter.excludeUngrouped) return false;
    if (topicFilter.allowAll) return true;
    return topicFilter.includeUngrouped;
  }

  const key = topic.toLowerCase();
  if (topicFilter.exclude.has(key)) return false;
  if (topicFilter.allowAll) return true;
  return topicFilter.include.has(key);
}

/** @param {AlsoSeeSection[]} sections */
export function alsoSeeHasItems(sections) {
  return sections.some((section) => section.items.length > 0);
}

/**
 * Sort named topics by `order` (then encounter index); always place ungrouped
 * last. Items within each section are also sorted by link `order`.
 *
 * @param {AlsoSeeSection[]} sections
 * @returns {AlsoSeeSection[]}
 */
function orderAlsoSeeSections(sections) {
  /** @type {AlsoSeeSection[]} */
  const named = [];
  /** @type {AlsoSeeSection | null} */
  let ungrouped = null;
  for (const section of sections) {
    if (section.topic === null || section.topic === undefined) {
      if (!ungrouped) {
        ungrouped = {
          topic: null,
          order: null,
          items: [...section.items],
        };
      } else {
        ungrouped.items.push(...section.items);
      }
      continue;
    }
    named.push({
      topic: section.topic,
      order: section.order ?? null,
      items: [...section.items],
    });
  }

  const sortedNamed = sortByAlsoSeeOrder(named).map((section) => ({
    ...section,
    items: sortByAlsoSeeOrder(section.items),
  }));

  if (!ungrouped) return sortedNamed;
  return [
    ...sortedNamed,
    {
      topic: null,
      order: null,
      items: sortByAlsoSeeOrder(ungrouped.items),
    },
  ];
}

/**
 * Merge also-see sections by topic (case-insensitive). Matching topics share one
 * section; items are appended and de-duplicated by normalized URL. On merge,
 * the lower finite topic `order` wins. Named topics are sorted by `order`;
 * ungrouped (no topic) sections are always last. Link `order` is applied within
 * each section after merge.
 *
 * @param {AlsoSeeSection[]} primary
 * @param {AlsoSeeSection[]} secondary
 * @returns {AlsoSeeSection[]}
 */
export function mergeAlsoSeeSections(primary = [], secondary = []) {
  /** @type {AlsoSeeSection[]} */
  const result = [];
  /** @type {Map<string, AlsoSeeSection>} */
  const byKey = new Map();

  /**
   * @param {string | null} topic
   * @returns {string}
   */
  function sectionKey(topic) {
    return topic === null || topic === undefined ? "" : topic.toLowerCase();
  }

  /**
   * @param {AlsoSeeSection[]} sections
   */
  function addSections(sections) {
    for (const section of sections) {
      if (!section?.items?.length) continue;
      const key = sectionKey(section.topic);
      const existing = byKey.get(key);
      if (!existing) {
        const copy = {
          topic: section.topic,
          order: section.order ?? null,
          items: [...section.items],
        };
        byKey.set(key, copy);
        result.push(copy);
        continue;
      }

      existing.order = mergeAlsoSeeOrder(existing.order, section.order);
      const seen = new Set(
        existing.items.map((item) => normalizeSiteUrl(item.url)).filter(Boolean)
      );
      for (const item of section.items) {
        const urlKey = normalizeSiteUrl(item.url);
        if (urlKey && seen.has(urlKey)) continue;
        if (urlKey) seen.add(urlKey);
        existing.items.push(item);
      }
    }
  }

  addSections(primary);
  addSections(secondary);
  return orderAlsoSeeSections(result);
}

/**
 * Normalize also-see JSON / config into sections.
 *
 * Accepts a top-level array of:
 * - `{ topic, items: link[] }` topic groups
 * - flat `{ label, url, … }` links (rendered without a group header)
 *
 * @param {unknown} alsoSee
 * @param {string} [excludeUrl] Drop entries whose `url` matches this app’s public URL
 * @param {string[]} [topics] Topic filter for this list:
 *   only `"*"` means all topics; `"-Topic"` excludes; named strings whitelist;
 *   `""` includes ungrouped; `[]` (or no include entries) includes nothing.
 * @returns {AlsoSeeSection[]}
 */
export function normalizeAlsoSee(alsoSee, excludeUrl = "", topics) {
  if (alsoSee === false || alsoSee === null || alsoSee === undefined) return [];
  if (!Array.isArray(alsoSee)) return [];

  const exclude = normalizeSiteUrl(excludeUrl);
  const topicFilter = normalizeAlsoSeeTopicFilter(topics);
  /** @type {AlsoSeeSection[]} */
  const sections = [];

  for (const entry of alsoSee) {
    if (!entry || typeof entry !== "object") continue;

    if (Array.isArray(entry.items)) {
      const topic =
        typeof entry.topic === "string" ? entry.topic.trim() : "";
      if (!alsoSeeTopicAllowed(topicFilter, topic)) continue;

      const items = entry.items
        .map((link) => normalizeAlsoSeeLink(link, exclude))
        .filter(Boolean);
      if (!items.length) continue;

      sections.push({
        topic: topic || null,
        order: topic ? parseAlsoSeeOrder(entry.order) : null,
        items,
      });
      continue;
    }

    if (!alsoSeeTopicAllowed(topicFilter, "")) continue;

    const link = normalizeAlsoSeeLink(entry, exclude);
    if (!link) continue;

    const last = sections[sections.length - 1];
    if (last && last.topic === null) {
      last.items.push(link);
    } else {
      sections.push({ topic: null, order: null, items: [link] });
    }
  }

  return orderAlsoSeeSections(sections);
}

/**
 * @param {AlsoSeeLink} link
 * @returns {string}
 */
function renderAlsoSeeIconMarkup(link) {
  if (link.iconSvgLight || link.iconSvgDark) {
    const light = sanitizeAlsoSeeSvg(
      link.iconSvgLight,
      "dropdown-menu-item-icon brand-icon--light"
    );
    const dark = sanitizeAlsoSeeSvg(
      link.iconSvgDark,
      "dropdown-menu-item-icon brand-icon--dark"
    );
    if (!light && !dark) return "";
    return `<span class="dropdown-menu-item-icon-wrap" aria-hidden="true">
              ${light}${dark}
            </span>`;
  }
  if (link.iconSvg) {
    const svg = sanitizeAlsoSeeSvg(link.iconSvg, "dropdown-menu-item-icon");
    if (!svg) return "";
    return `<span class="dropdown-menu-item-icon-wrap" aria-hidden="true">
              ${svg}
            </span>`;
  }
  if (link.iconLight || link.iconDark) {
    return `<span class="dropdown-menu-item-icon-wrap" aria-hidden="true">
              <img class="dropdown-menu-item-icon brand-icon--light" src="${escapeAttr(link.iconLight)}" alt="" width="24" height="24" />
              <img class="dropdown-menu-item-icon brand-icon--dark" src="${escapeAttr(link.iconDark)}" alt="" width="24" height="24" />
            </span>`;
  }
  if (link.icon) {
    return `<span class="dropdown-menu-item-icon-wrap" aria-hidden="true">
              <img class="dropdown-menu-item-icon" src="${escapeAttr(link.icon)}" alt="" width="24" height="24" />
            </span>`;
  }
  return "";
}

/**
 * @param {AlsoSeeLink} link
 * @param {number} index
 * @returns {string}
 */
/**
 * @param {AlsoSeeLink} link
 * @returns {string[]}
 */
function alsoSeeColorDeclarations(link) {
  /** @type {string[]} */
  const decls = [];
  if (link.accentLight || link.accentDark) {
    decls.push(`--also-see-accent-light: ${link.accentLight}`);
    decls.push(`--also-see-accent-dark: ${link.accentDark}`);
  } else if (link.accent) {
    decls.push(`--accent: ${link.accent}`);
  }
  if (link.accentHoverLight || link.accentHoverDark) {
    decls.push(`--also-see-accent-hover-light: ${link.accentHoverLight}`);
    decls.push(`--also-see-accent-hover-dark: ${link.accentHoverDark}`);
  } else if (link.accentHover) {
    decls.push(`--accent-hover: ${link.accentHover}`);
  }
  return decls;
}

/**
 * @param {AlsoSeeLink} link
 * @returns {string}
 */
function alsoSeeColorClass(link) {
  return [
    "dropdown-menu-item",
    link.accentLight || link.accentDark
      ? "footer-also-see-item--accent-pair"
      : "",
    link.accentHoverLight || link.accentHoverDark
      ? "footer-also-see-item--accent-hover-pair"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * @param {AlsoSeeLink} link
 * @param {number} index
 * @returns {string}
 */
function renderAlsoSeeLinkItem(link, index) {
  const iconMarkup = renderAlsoSeeIconMarkup(link);
  const subtitleMarkup = link.subtitle
    ? `<span class="dropdown-menu-item-subtitle">${escapeText(link.subtitle)}</span>`
    : "";
  const colorDeclarations = alsoSeeColorDeclarations(link);
  const colorStyle = colorDeclarations.length
    ? ` style="${escapeAttr(colorDeclarations.join("; "))}"`
    : "";

  return `<li role="none">
          <a href="${escapeAttr(link.url)}" class="${alsoSeeColorClass(link)}" role="menuitem" data-no-external-icon data-value="${index}"${colorStyle}>
            ${iconMarkup}
            <span class="dropdown-menu-item-text">
              <span class="dropdown-menu-item-label">${escapeText(link.label)}</span>
              ${subtitleMarkup}
            </span>
          </a>
        </li>`;
}

/** Column counts the also-see menu may use. */
const ALSO_SEE_MENU_COLUMNS = [1, 2, 3];

/**
 * Pick one column count for the whole menu. Every topic spans the full width,
 * so the best count is the one that leaves the fewest trailing holes without
 * making the menu unnecessarily tall.
 *
 * @param {AlsoSeeSection[]} sections
 * @returns {number}
 */
export function alsoSeeMenuColumns(sections) {
  const counts = (Array.isArray(sections) ? sections : [])
    .map((section) => section?.items?.length ?? 0)
    .filter((count) => count > 0);
  if (!counts.length) return 1;

  const largest = Math.max(...counts);
  let best = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const columns of ALSO_SEE_MENU_COLUMNS) {
    if (columns > largest) break;
    let score = 0;
    for (const count of counts) {
      const rows = Math.ceil(count / columns);
      score += rows + (rows * columns - count);
    }
    // Ties favour the wider grid, which is the shorter menu.
    if (score <= bestScore) {
      bestScore = score;
      best = columns;
    }
  }

  return best;
}

/**
 * @param {AlsoSeeSection} section
 * @param {number} startIndex
 * @param {{ isFirstSection?: boolean }} [options]
 * @returns {{ markup: string, nextIndex: number }}
 */
function renderAlsoSeeTopic(section, startIndex, { isFirstSection = false } = {}) {
  let index = startIndex;
  const linksMarkup = section.items
    .map((link) => renderAlsoSeeLinkItem(link, index++))
    .join("");

  if (!section.topic) {
    const breakMarkup = isFirstSection
      ? ""
      : `<li role="presentation" class="footer-also-see-section-break" aria-hidden="true"></li>`;
    return {
      markup: `${breakMarkup}${linksMarkup}`,
      nextIndex: index,
    };
  }

  return {
    markup: `<li role="presentation">
          <div class="dropdown-menu-group">${escapeText(section.topic)}</div>
        </li>${linksMarkup}`,
    nextIndex: index,
  };
}

/**
 * @param {AlsoSeeSection[]} sections
 * @returns {string}
 */
export function renderAlsoSeeMarkup(sections) {
  if (!alsoSeeHasItems(sections)) return "";

  let index = 0;
  const filled = sections.filter((section) => section.items.length > 0);
  const columns = alsoSeeMenuColumns(filled);
  const topicsMarkup = filled
    .map((section, sectionIndex) => {
      const rendered = renderAlsoSeeTopic(section, index, {
        isFirstSection: sectionIndex === 0,
      });
      index = rendered.nextIndex;
      return rendered.markup;
    })
    .join("");

  return `<span class="footer-meta-sep" aria-hidden="true">·</span>
        <span>find
          <span class="footer-also-see dropdown" id="footer-also-see">
            <button type="button" class="footer-also-see-trigger" id="footer-also-see-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="footer-also-see-menu" data-tooltip="other apps and tools" data-tooltip-position="top">more stuff</button>
            <ul id="footer-also-see-menu" class="dropdown-menu footer-also-see-menu hidden" role="menu" hidden data-also-see-columns="${columns}">
              ${topicsMarkup}
            </ul>
          </span></span>`;
}

/**
 * Replace the footer “also see” host contents with link markup.
 *
 * @param {ParentNode | null | undefined} root
 * @param {AlsoSeeSection[]} sections
 * @returns {HTMLElement | null} Host element, or null if missing
 */
export function mountAlsoSee(root, sections) {
  const host =
    root?.querySelector?.("#footer-also-see-host") ??
    document.getElementById("footer-also-see-host");
  if (!host) return null;
  host.innerHTML = renderAlsoSeeMarkup(sections);
  return host;
}

/**
 * Inject shared page chrome: footer (links + theme toggle) and page navigation.
 * Skips if `#app-page-footer` already exists.
 */
export function renderPageShell(options = {}) {
  if (!document.getElementById("skip-to-main")) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<a id="skip-to-main" class="skip-link" href="#main">Skip to main content</a>`
    );
  }

  if (document.getElementById("app-page-footer")) return;

  const overrides = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined)
  );
  const {
    repoUrl,
    alsoSee,
    alsoSeeIncludeLocal,
    appUrl,
    appVersion,
    frameworkVersion,
  } = {
    ...DEFAULTS,
    ...overrides,
  };
  const issuesUrl = `${repoUrl}/issues`;
  const alsoSeeSections = alsoSeeIncludeLocal
    ? normalizeAlsoSee(alsoSee, appUrl, ["*"])
    : [];
  const alsoSeeMarkup = renderAlsoSeeMarkup(alsoSeeSections);

  document.body.insertAdjacentHTML(
    "beforeend",
    `<footer id="app-page-footer">
      <div class="footer-meta">
        <div class="footer-meta-copy">
          <span class="footer-version" data-tooltip="based on SMA1 framework v${frameworkVersion}" data-tooltip-position="top" tabindex="0">v${appVersion}</span>
          <span class="footer-meta-sep" aria-hidden="true">·</span>
          <span data-tooltip="or suggest a feature" data-tooltip-position="top" tabindex="0">report an
          <a href="${issuesUrl}" target="_blank" rel="noopener noreferrer">issue</a></span>
          <span class="footer-meta-sep" aria-hidden="true">·</span>
          <span data-tooltip="show your support" data-tooltip-position="top" tabindex="0">star on
          <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">GitHub</a></span><span id="footer-also-see-host">${alsoSeeMarkup}</span>
        </div>
      </div>
      <div id="theme-toggle" class="theme-toggle" role="group" aria-label="Theme">
        <button type="button" class="theme-toggle-btn" data-theme-mode="light" data-icon="light-mode" data-icon-class="theme-icon" aria-label="Light theme" aria-pressed="false" title="Light"></button>
        <button type="button" class="theme-toggle-btn" data-theme-mode="dark" data-icon="dark-mode" data-icon-class="theme-icon" aria-label="Dark theme" aria-pressed="false" title="Dark"></button>
        <button type="button" class="theme-toggle-btn" data-theme-mode="auto" data-icon="auto-mode" data-icon-class="theme-icon" aria-label="System theme" aria-pressed="false" title="System"></button>
      </div>
    </footer>
    ${PAGE_NAV_MARKUP}`
  );
}

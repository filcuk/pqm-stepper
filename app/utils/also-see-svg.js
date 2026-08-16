/** Allowed SVG element local names for also-see embedded icons. */
const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "rect",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "use",
  "title",
  "desc",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
]);

/** Attribute names that must never appear on embedded also-see SVGs. */
const BLOCKED_ATTR = /^(on|xmlns:xlink$)/i;

/**
 * @param {string} name
 * @returns {boolean}
 */
function isAllowedAttr(name) {
  if (!name || BLOCKED_ATTR.test(name)) return false;
  if (name.includes(":") && name.toLowerCase() !== "xlink:href") return false;
  return true;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isSafeUrlAttr(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  if (/^javascript:/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed) && !/^data:image\/svg\+xml/i.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * @param {Element} el
 */
function scrubElement(el) {
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    el.remove();
    return;
  }

  for (const attr of [...el.attributes]) {
    const name = attr.name;
    const value = attr.value;
    if (!isAllowedAttr(name)) {
      el.removeAttribute(name);
      continue;
    }
    if (
      (name === "href" || name.toLowerCase() === "xlink:href") &&
      !isSafeUrlAttr(value)
    ) {
      el.removeAttribute(name);
    }
  }

  for (const child of [...el.children]) {
    scrubElement(child);
  }
}

/**
 * @param {string} source
 * @param {string} className
 * @returns {string}
 */
function sanitizeWithDomParser(source, className) {
  const parser = new DOMParser();
  const wrapped = /^<\s*svg\b/i.test(source)
    ? source
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${source}</svg>`;

  const doc = parser.parseFromString(wrapped, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    return "";
  }

  scrubElement(svg);
  if (svg.tagName.toLowerCase() !== "svg") return "";

  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (className) svg.setAttribute("class", className);
  else svg.removeAttribute("class");

  return svg.outerHTML;
}

/**
 * Conservative string sanitizer for environments without `DOMParser` (Node tests).
 *
 * @param {string} source
 * @param {string} className
 * @returns {string}
 */
function sanitizeFallback(source, className) {
  if (/<\s*(script|foreignObject|iframe|object|embed|link|meta|style)\b/i.test(source)) {
    return "";
  }
  if (/\son[a-z]+\s*=/i.test(source)) return "";
  if (/javascript:/i.test(source)) return "";

  let out = source.replace(/<!--[\s\S]*?-->/g, "");
  if (!/^<\s*svg\b/i.test(out)) {
    out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${out}</svg>`;
  }

  out = out.replace(
    /<\/?\s*(script|foreignObject|iframe|object|embed|link|meta|style|image|a)\b[^>]*>/gi,
    ""
  );

  out = out.replace(/^<\s*svg\b([^>]*)>/i, (_, attrs) => {
    const cleaned = String(attrs)
      .replace(/\s(width|height|class|aria-hidden|focusable)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    const classAttr = className ? ` class="${className}"` : "";
    return `<svg${cleaned}${classAttr} aria-hidden="true" focusable="false">`;
  });

  return out;
}

/**
 * Sanitize embedded also-see SVG markup for safe inline injection.
 * Accepts a full `<svg>` document or inner markup (wrapped with a default viewBox).
 *
 * @param {unknown} raw
 * @param {string} [className]
 * @returns {string} Safe SVG markup, or "" when empty/invalid
 */
export function sanitizeAlsoSeeSvg(raw, className = "") {
  const source = typeof raw === "string" ? raw.trim() : "";
  if (!source) return "";

  const classes = typeof className === "string" ? className.trim() : "";

  if (typeof DOMParser !== "undefined") {
    try {
      return sanitizeWithDomParser(source, classes);
    } catch {
      return "";
    }
  }

  return sanitizeFallback(source, classes);
}

#!/usr/bin/env node
/**
 * WCAG relative-luminance contrast for accent / accent-fg pairs.
 *
 * Usage:
 *   node contrast.mjs <accent-hex>
 *   node contrast.mjs <accent-hex> <fg-hex>
 *   node contrast.mjs --hover light|dark <accent-hex> [fg-hex]
 *
 * Exit 0 always when input parses; prints JSON + human summary on stdout.
 */

const FG_CANDIDATES = ["#ffffff", "#0d1117"];
const AA_NORMAL = 4.5;

function parseHex(input) {
  let h = String(input).trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(h)) {
    throw new Error(`Invalid hex colour: ${input}`);
  }
  return `#${h.toLowerCase()}`;
}

function lin(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function lum(hex) {
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const L1 = lum(a);
  const L2 = lum(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function mixSrgb(accentHex, towardHex, accentPercent) {
  const parse = (hex) => {
    const h = hex.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const A = parse(accentHex);
  const B = parse(towardHex);
  const t = accentPercent / 100;
  const ch = (i) => Math.round(A[i] * t + B[i] * (1 - t));
  return `#${[ch(0), ch(1), ch(2)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function pickFg(accent) {
  const scored = FG_CANDIDATES.map((fg) => ({
    fg,
    ratio: contrast(accent, fg),
  })).sort((a, b) => b.ratio - a.ratio);
  const pass = scored.filter((s) => s.ratio >= AA_NORMAL);
  const chosen = pass[0] ?? null;
  return { scored, chosen };
}

function main(argv) {
  let hoverMode = null;
  const args = [...argv];
  if (args[0] === "--hover") {
    hoverMode = args[1];
    if (hoverMode !== "light" && hoverMode !== "dark") {
      throw new Error("--hover requires light or dark");
    }
    args.splice(0, 2);
  }

  if (!args[0]) {
    throw new Error(
      "Usage: contrast.mjs <accent-hex> [fg-hex] | contrast.mjs --hover light|dark <accent-hex> [fg-hex]",
    );
  }

  const accent = parseHex(args[0]);
  const toward = hoverMode === "dark" ? "#ffffff" : "#000000";
  const subject =
    hoverMode != null ? mixSrgb(accent, toward, 80) : accent;

  if (args[1]) {
    const fg = parseHex(args[1]);
    const ratio = contrast(subject, fg);
    const result = {
      subject,
      accent,
      hoverMode,
      fg,
      ratio: Number(ratio.toFixed(2)),
      aaNormal: ratio >= AA_NORMAL,
    };
    console.log(JSON.stringify(result, null, 2));
    console.error(
      `${subject} vs ${fg}: ${result.ratio}:1 (${result.aaNormal ? "AA pass" : "AA fail"})`,
    );
    return;
  }

  const { scored, chosen } = pickFg(subject);
  const result = {
    subject,
    accent,
    hoverMode,
    candidates: scored.map((s) => ({
      fg: s.fg,
      ratio: Number(s.ratio.toFixed(2)),
      aaNormal: s.ratio >= AA_NORMAL,
    })),
    recommendedFg: chosen?.fg ?? null,
    recommendedRatio: chosen ? Number(chosen.ratio.toFixed(2)) : null,
  };
  console.log(JSON.stringify(result, null, 2));
  if (chosen) {
    console.error(
      `Recommend ${chosen.fg} (${result.recommendedRatio}:1) on ${subject}`,
    );
  } else {
    console.error(
      `No AA fg among ${FG_CANDIDATES.join(", ")} for ${subject} — pick a different accent`,
    );
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

/**
 * Record a seamless looping scroll of demo.html (content only — no site chrome).
 * Dev-only tooling under scripts/ — does not touch app/ runtime code.
 *
 * Captures screenshots only while scrolling (no load/settle in the file), so a
 * looping player reads as an infinite carousel through the demo sections.
 *
 * Prerequisites:
 *   npx playwright install chromium
 *   ffmpeg on PATH, or `npm i -D ffmpeg-static` (bundled binary)
 *
 * Usage:
 *   npm run capture:demo
 *   npm run capture:demo -- --format webm
 *   npm run capture:demo -- --format webp,gif
 *   npm run capture:demo -- --theme dark --duration 12000 --width 900
 *   npm run capture:demo -- --preview
 *   npm run capture:demo -- --show-titles
 *
 * Default output: res/demo-scroll.avif (animated). Use --format for webp/webm/gif.
 * Titles and section subtitles (Theme, Properties, …) are stripped by default;
 * pass --show-titles to keep.
 *
 * Smooth playback depends on two rules: the scroll advances a whole number of
 * pixels per frame, and the encoder delivers those frames with timestamps that
 * match --duration (frameCount / encodeFps ≈ duration). --out-fps only chooses
 * step size for avif/webp; raising --fps does not make the scroll faster or
 * slower, and no longer overrides --out-fps when planning.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CAPTURE_STYLE,
  DEFAULT_THEME_STORAGE_KEY,
  alignCaptureLoopToStep,
  applyCaptureLayout,
  captureInitScript,
} from "./lib/capture-demo-prepare.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_DIR = path.join(ROOT, "res");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const OUTPUT_FORMATS = new Set(["avif", "webp", "webm", "gif"]);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean | string[]>} */
  const out = {
    theme: "dark",
    width: "1400",
    height: "900",
    duration: "60000",
    fps: "60",
    dpr: "1",
    outDir: DEFAULT_OUT_DIR,
    basename: "demo-scroll",
    preview: false,
    formats: ["avif"],
    headless: true,
    loop: true,
    hideTitles: true,
    settleMs: "800",
    quality: "70",
    outFps: "30",
    maxMb: "10",
    outWidth: "1000",
    avifCrf: "32",
    reuseFrames: false,
    cleanFrames: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--preview") out.preview = true;
    else if (arg === "--no-loop") out.loop = false;
    else if (arg === "--hide-titles") out.hideTitles = true;
    else if (arg === "--show-titles") out.hideTitles = false;
    else if (arg === "--headed") out.headless = false;
    else if (arg === "--reuse-frames") out.reuseFrames = true;
    else if (arg === "--clean-frames") out.cleanFrames = true;
    else if (arg === "--theme") out.theme = argv[++i] || "light";
    else if (arg === "--width") out.width = argv[++i] || out.width;
    else if (arg === "--height") out.height = argv[++i] || out.height;
    else if (arg === "--duration") out.duration = argv[++i] || out.duration;
    else if (arg === "--fps") out.fps = argv[++i] || out.fps;
    else if (arg === "--dpr") out.dpr = argv[++i] || out.dpr;
    else if (arg === "--out-dir") out.outDir = path.resolve(argv[++i] || out.outDir);
    else if (arg === "--basename") out.basename = argv[++i] || out.basename;
    else if (arg === "--settle-ms") out.settleMs = argv[++i] || out.settleMs;
    else if (arg === "--quality" || arg === "--webp-quality") {
      out.quality = argv[++i] || out.quality;
    } else if (arg === "--out-fps" || arg === "--webp-fps") {
      out.outFps = argv[++i] || out.outFps;
    } else if (arg === "--max-mb" || arg === "--webp-max-mb") {
      out.maxMb = argv[++i] || out.maxMb;
    } else if (arg === "--out-width" || arg === "--webp-width") {
      out.outWidth = argv[++i] || out.outWidth;
    } else if (arg === "--avif-crf") out.avifCrf = argv[++i] || out.avifCrf;
    else if (arg === "--format" || arg === "--formats") {
      const raw = String(argv[++i] || "");
      out.formats = parseFormats(raw);
    } else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseFormats(raw) {
  const list = raw
    .split(/[,+\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) {
    throw new Error("--format needs at least one of: avif, webp, webm, gif");
  }
  for (const fmt of list) {
    if (!OUTPUT_FORMATS.has(fmt)) {
      throw new Error(
        `Unknown format "${fmt}". Use: avif, webp, webm, gif (comma-separated ok)`
      );
    }
  }
  return [...new Set(list)];
}

/**
 * @param {string | boolean | undefined} value
 * @param {string} label
 * @returns {number}
 */
function parsePositiveInt(value, label) {
  const raw = String(value ?? "")
    .trim()
    .replace(/px$/i, "");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(
      `${label} must be a positive integer (got ${JSON.stringify(value)})`
    );
  }
  return n;
}

function printHelp() {
  console.log(`Record a looping scroll of demo.html for README media.

Site header/footer/page-nav are removed. #main is duplicated so scrolling one
copy height overscrolls into the first section again (infinite carousel).
Tier/section titles (Theme, Properties, …), section subtitles (.panel-hint
directly under a content-section), and related gaps are stripped by default
so the scroll is a continuous run of demo sections.
Frames are captured only during the scroll — no frozen lead-in/outro.

Each frame advances by a whole number of pixels (fractional steps render as
3,3,3,4 judder). --duration sets how long one loop lasts; the encode frame rate
is derived so the file plays back in about that many milliseconds. --out-fps
(avif/webp) or --fps (webm/gif) only chooses how fine the scroll steps are.

Options:
  --theme light|dark   Forced theme (default: dark)
  --width <px>         Viewport width (default: 1400; px suffix ok)
  --height <px>        Viewport height (default: 900; px suffix ok)
  --duration <ms>      Length of one loop / scroll speed (default: 60000).
                       60000 → ~60s of video covering the full demo once.
  --fps <n>            Sampling rate for webm/gif (default: 40). Not used to
                       plan avif/webp steps — use --out-fps for those.
  --dpr <n>            Device scale factor (default: 1) — sharper capture pixels,
                       NOT output downscale (use --out-width for that)
  --out-dir <path>     Output directory (default: res/)
  --basename <name>    File basename (default: demo-scroll)
  --settle-ms <ms>     Wait after load before capture (default: 800; not in video)
  --format <list>      Output format(s): avif (default), webp, webm, gif
                       Comma-separated for several, e.g. avif,webp or webm
  --out-fps <n>        Target sampling rate for avif/webp planning (default: 40).
                       Actual encode fps may differ slightly so duration stays exact.
                       Size-budget passes may thin by a whole factor only.
  --out-width <px>     Encode width for avif/webp (default: 1000). E.g. capture 1400,
                       export 900: --width 1400 --out-width 900
  --max-mb <n>         Re-encode until under this size (avif/webp; default: 10; 0 = off)
  --quality <n>        WebP -quality start (default: 70; 0–100)
  --avif-crf <n>       AV1 CRF for AVIF (default: 32; lower = sharper, 0–63)
  --reuse-frames       Skip browser capture; encode from existing
                       res/.demo-scroll-frames (see --clean-frames)
  --clean-frames       Delete the frames directory after encode (default: keep)
  --preview            Open prepared page (no recording)
  --headed             Show the browser while capturing frames
  --no-loop            Do not duplicate #main
  --hide-titles        Strip tier/section titles, section subtitles, and gaps (default)
  --show-titles        Keep Theme / Properties headings, subtitles, and spacing
  -h, --help           Show this help

  Legacy aliases: --webp-fps, --webp-width, --webp-max-mb, --webp-quality

Requires ffmpeg (system PATH or the ffmpeg-static npm package).
`);
}

/**
 * @param {string} root
 * @returns {Promise<{ server: http.Server, port: number, close: () => Promise<void> }>}
 */
function startStaticServer(root) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const safeRel = rel.replace(/^\/+/, "");
      const resolved = path.resolve(root, safeRel);
      const relToRoot = path.relative(root, resolved);
      if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        res.writeHead(404).end("Not found");
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind static server"));
        return;
      }
      resolve({
        server,
        port: address.port,
        close: () =>
          new Promise((resClose, rejClose) => {
            server.close((err) => (err ? rejClose(err) : resClose()));
          }),
      });
    });
    server.on("error", reject);
  });
}

/**
 * @returns {Promise<typeof import("playwright")>}
 */
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    console.error(`Playwright is not installed.

  npm i -D playwright
  npx playwright install chromium
`);
    process.exit(1);
  }
}

/**
 * Prefer system ffmpeg, else the `ffmpeg-static` npm binary.
 * @returns {string}
 */
function resolveFfmpeg() {
  const onPath = spawnSync("ffmpeg", ["-version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (onPath.status === 0) return "ffmpeg";

  try {
    // Default export is the absolute path to the binary.
    const mod = requireResolveFfmpegStatic();
    if (mod && fs.existsSync(mod)) {
      const probe = spawnSync(mod, ["-version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (probe.status === 0) return mod;
    }
  } catch {
    /* packaged binary missing */
  }

  console.error(`ffmpeg is required to encode the scroll capture.

  npm i -D ffmpeg-static
  # or: winget install ffmpeg  (then reopen the terminal)
`);
  process.exit(1);
}

/** @returns {string | null} */
function requireResolveFfmpegStatic() {
  // Synchronous resolve keeps the CLI simple; package exports a string path.
  const require = createRequire(import.meta.url);
  return require("ffmpeg-static");
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {import("playwright").BrowserContext} context
 * @param {string} theme
 */
async function installCaptureInit(context, theme) {
  await context.addInitScript(captureInitScript, {
    theme,
    storageKey: DEFAULT_THEME_STORAGE_KEY,
  });
}

/**
 * @param {import("playwright").Page} page
 * @param {string} demoUrl
 * @param {{ loop: boolean, settleMs: number, hideTitles?: boolean }} options
 * @returns {Promise<number>}
 */
async function openPreparedDemo(page, demoUrl, { loop, settleMs, hideTitles = true }) {
  await page.goto(demoUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#main");
  await delay(settleMs);
  const result = await page.evaluate(applyCaptureLayout, {
    loop,
    hideTitles,
    styleText: CAPTURE_STYLE,
  });
  const scrollBy =
    typeof result === "number" ? result : Number(result?.scrollBy);
  if (!scrollBy || !Number.isFinite(scrollBy)) {
    throw new Error("Could not determine capture scroll distance");
  }
  // Ensure paint after DOM chrome removal + clone.
  await delay(100);
  await page.evaluate(() => window.scrollTo(0, 0));
  return scrollBy;
}

/**
 * Pick a whole-pixel scroll step for the capture.
 *
 * `--duration` is authoritative for how long one loop lasts (and thus how fast
 * content scrolls). `--out-fps` / `--fps` only choose how finely that motion is
 * sampled: smaller steps → more frames → higher encode fps, but
 * frameCount / encodeFps still equals duration.
 *
 * Fractional steps are avoided: `scrollTo` snaps to device pixels, so a 3.27px
 * mean step becomes a 3,3,3,4 pattern (visible judder). The frame rate absorbs
 * the remainder instead. Steps are also capped at ~0.35% of the viewport height.
 *
 * @param {{ scrollBy: number, durationMs: number, targetFps: number, viewportHeight: number }} opts
 * @returns {{ stepPx: number, frameCount: number, encodeFps: number }}
 */
function planScrollCadence({ scrollBy, durationMs, targetFps, viewportHeight }) {
  const durationSec = durationMs / 1000;
  const maxStepPx = Math.max(1, Math.floor(viewportHeight * 0.0035));
  const idealStepPx = scrollBy / (durationSec * targetFps);
  const stepPx = Math.min(maxStepPx, Math.max(1, Math.round(idealStepPx)));
  const frameCount = Math.max(2, Math.ceil(scrollBy / stepPx));
  // Tie the encode rate to duration so players always get ~durationSec of video.
  return { stepPx, frameCount, encodeFps: frameCount / durationSec };
}

/**
 * Capture only in-motion frames at exact scroll offsets (constant spatial
 * sampling → constant playback speed). Uses CDP from-surface screenshots so
 * each frame is a finished composite, not a mid-paint snapshot.
 *
 * Every frame advances by the same whole `stepPx`, so playback speed is
 * constant and the encoder receives one frame per delivered frame.
 *
 * @param {import("playwright").Page} page
 * @param {{ stepPx: number, frameCount: number, encodeFps: number, framesDir: string }} plan
 * @returns {Promise<{ frameCount: number, encodeFps: number }>}
 */
async function captureScrollFrames(
  page,
  { stepPx, frameCount, encodeFps, framesDir }
) {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const client = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = "auto";
  });

  let offTargetFrames = 0;

  for (let i = 0; i < frameCount; i++) {
    const y = i * stepPx;
    const landedY = await page.evaluate(async (scrollY) => {
      window.scrollTo(0, scrollY);
      // Two frames: layout then paint. Retry scroll if the engine clamped late.
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      if (Math.abs(window.scrollY - scrollY) > 0.5) {
        window.scrollTo(0, scrollY);
        await new Promise((r) => requestAnimationFrame(r));
      }
      return window.scrollY;
    }, y);

    // A clamped or ignored scroll repeats the previous position, which reads as
    // a stall followed by a double-length jump.
    if (Math.abs(landedY - y) > 0.5) offTargetFrames += 1;

    const shot = await client.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 92,
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const file = path.join(
      framesDir,
      `frame-${String(i).padStart(5, "0")}.jpg`
    );
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));

    if (
      i === 0 ||
      i === frameCount - 1 ||
      (i + 1) % Math.max(1, Math.round(encodeFps)) === 0
    ) {
      console.log(`  frame ${i + 1}/${frameCount} @ y=${y}`);
    }
  }

  if (offTargetFrames > 0) {
    console.warn(
      `  warning: ${offTargetFrames} frame(s) did not reach their scroll offset — expect judder there`
    );
  }

  await client.detach().catch(() => {});
  return { frameCount, encodeFps };
}

const FRAMES_META_NAME = "frames-meta.json";

/**
 * @param {string} framesDir
 * @returns {string[]}
 */
function listFrameFiles(framesDir) {
  if (!fs.existsSync(framesDir)) return [];
  return fs
    .readdirSync(framesDir)
    .filter((name) => /^frame-\d{5}\.jpg$/i.test(name))
    .sort();
}

/**
 * @param {string} framesDir
 * @param {object} meta
 */
function writeFramesMeta(framesDir, meta) {
  fs.writeFileSync(
    path.join(framesDir, FRAMES_META_NAME),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8"
  );
}

/**
 * @param {string} framesDir
 * @param {number} durationMsFallback
 * @returns {{ frameCount: number, encodeFps: number, meta: object | null }}
 */
function loadExistingFrames(framesDir, durationMsFallback) {
  const files = listFrameFiles(framesDir);
  if (files.length < 2) {
    throw new Error(
      `No reusable frames in ${framesDir} (need frame-00000.jpg …).\n` +
        `Run a full capture once first (frames are kept by default; use --clean-frames to delete).`
    );
  }

  const metaPath = path.join(framesDir, FRAMES_META_NAME);
  /** @type {object | null} */
  let meta = null;
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch {
      meta = null;
    }
  }

  const frameCount = files.length;
  const durationMs =
    meta && Number(meta.durationMs) > 0
      ? Number(meta.durationMs)
      : durationMsFallback;
  const encodeFps =
    meta && Number(meta.encodeFps) > 0
      ? Number(meta.encodeFps)
      : frameCount / (durationMs / 1000);

  return { frameCount, encodeFps, meta };
}

/**
 * @param {string} ffmpegBin
 * @param {string[]} args
 * @param {string} label
 */
function runFfmpeg(ffmpegBin, args, label) {
  const result = spawnSync(ffmpegBin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg ${label} failed`);
  }
}

/**
 * ffmpeg rate argument. Capture rates are usually fractional (whole-pixel scroll
 * steps rarely divide the duration evenly), so avoid rounding to an integer.
 *
 * @param {number} fps
 * @returns {string}
 */
function formatRate(fps) {
  return String(Number(fps.toFixed(6)));
}

/**
 * Smallest whole factor by which the capture rate can be thinned to reach the
 * requested delivery rate.
 *
 * Only integer factors are used: `fps=` with an arbitrary target keeps some
 * frames and discards others unevenly, which is seen as periodic stutter even
 * though the source motion is smooth.
 *
 * @param {number} captureFps
 * @param {number} requestedFps
 * @returns {number}
 */
function fpsDecimationFactor(captureFps, requestedFps) {
  if (!(requestedFps > 0) || requestedFps >= captureFps) return 1;
  return Math.max(1, Math.round(captureFps / requestedFps));
}

/**
 * @param {number} captureFps
 * @param {number} factor  1 keeps every frame (no resampling filter)
 * @param {number} evenWidth
 * @returns {string}
 */
function buildFilterChain(captureFps, factor, evenWidth) {
  const steps = [];
  if (factor > 1) {
    // Integer thinning only. Pair with `-r` at the delivery rate so the muxer
    // cannot keep the capture timestamps (which would shorten the video and
    // make the scroll look faster).
    steps.push(`fps=${formatRate(captureFps / factor)}`);
  }
  // -2 keeps the height even: an odd height forces a non-square pixel ratio
  // under yuv420p, which players resample (and soften) on playback.
  steps.push(`scale=${evenWidth}:-2:flags=lanczos`, "format=yuv420p");
  return steps.join(",");
}

/**
 * Output-rate args so filtered frames keep the intended duration.
 * @param {number} deliveryFps
 * @returns {string[]}
 */
function deliveryRateArgs(deliveryFps) {
  return ["-r", formatRate(deliveryFps), "-fps_mode", "cfr"];
}

/**
 * Encode animated WebP sized for README (~10MB by default).
 * Capture can stay at 60fps; delivery fps/quality/scale are reduced as needed.
 *
 * Note: libwebp takes `-quality` (not `-q:v`). Wrong flags were previously ignored,
 * which produced huge near-default encodes.
 *
 * @param {string} ffmpegBin
 * @param {string} framesDir
 * @param {string} webpPath
 * @param {object} options
 * @param {number} options.captureFps
 * @param {number} options.width  Initial encode width (may shrink under maxMb)
 * @param {number} options.quality
 * @param {number} options.deliveryFps
 * @param {number} options.maxMb  0 disables size targeting
 */
function encodeWebpFromFrames(ffmpegBin, framesDir, webpPath, options) {
  const captureFps = Number(options.captureFps);
  const width = Number(options.width);
  let quality = Number(options.quality);
  let encodeWidth = width;
  const maxMb = Number(options.maxMb);

  if (!Number.isFinite(captureFps) || captureFps <= 0) {
    throw new Error(`encodeWebpFromFrames: invalid captureFps ${options.captureFps}`);
  }
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`encodeWebpFromFrames: invalid width ${options.width}`);
  }
  if (!Number.isFinite(quality)) quality = 58;
  let fpsFactor = fpsDecimationFactor(captureFps, Number(options.deliveryFps));
  let deliveryFps = captureFps / fpsFactor;

  const pattern = path.join(framesDir, "frame-%05d.jpg");

  /**
   * @param {number} q
   * @param {number} factor
   * @param {number} w
   */
  function encodeOnce(q, factor, w) {
    const evenWidth = w % 2 === 0 ? w : w - 1;
    const outFps = captureFps / factor;
    // libwebp: use -quality (global -q:v is ignored for this encoder).
    // Preset "picture" applies stronger deblocking than "drawing", which suits
    // the anti-aliased UI capture and encodes ~7% smaller at equal quality.
    // Do not use -cr_threshold: on scrolling UIs it encodes false "unchanged"
    // blocks as transparency → white holes in many players.
    runFfmpeg(
      ffmpegBin,
      [
        "-y",
        "-framerate",
        formatRate(captureFps),
        "-i",
        pattern,
        "-vf",
        buildFilterChain(captureFps, factor, evenWidth),
        "-an",
        "-c:v",
        "libwebp_anim",
        "-lossless",
        "0",
        "-preset",
        "picture",
        "-quality",
        String(q),
        "-loop",
        "0",
        ...deliveryRateArgs(outFps),
        webpPath,
      ],
      "webp encode"
    );
  }

  encodeOnce(quality, fpsFactor, encodeWidth);
  let sizeMb = fs.statSync(webpPath).size / (1024 * 1024);
  console.log(
    `  webp pass q=${quality} fps=${deliveryFps.toFixed(2)} w=${encodeWidth} → ${sizeMb.toFixed(2)} MB`
  );

  if (!(maxMb > 0)) return;

  let guard = 0;
  while (sizeMb > maxMb && guard < 16) {
    guard += 1;
    if (quality > 40) {
      quality = Math.max(40, quality - 6);
    } else if (captureFps / (fpsFactor + 1) >= 18) {
      fpsFactor += 1;
    } else if (encodeWidth > 900) {
      encodeWidth = Math.max(900, Math.round(encodeWidth * 0.88));
    } else if (quality > 28) {
      quality = Math.max(28, quality - 4);
    } else if (captureFps / (fpsFactor + 1) >= 12) {
      fpsFactor += 1;
    } else {
      console.warn(
        `  webp still ${sizeMb.toFixed(2)} MB after compression passes (target ${maxMb} MB)`
      );
      break;
    }
    deliveryFps = captureFps / fpsFactor;

    encodeOnce(quality, fpsFactor, encodeWidth);
    sizeMb = fs.statSync(webpPath).size / (1024 * 1024);
    console.log(
      `  webp pass q=${quality} fps=${deliveryFps.toFixed(2)} w=${encodeWidth} → ${sizeMb.toFixed(2)} MB`
    );
  }

  if (maxMb > 0 && sizeMb > maxMb) {
    console.warn(
      `  warning: final webp is ${sizeMb.toFixed(2)} MB (over ${maxMb} MB budget)`
    );
  }
}

/**
 * Encode animated AVIF (AV1) sized for README (~10MB by default).
 * Much smaller than WebP at similar perceptual quality on this UI scroll.
 *
 * @param {string} ffmpegBin
 * @param {string} framesDir
 * @param {string} avifPath
 * @param {object} options
 * @param {number} options.captureFps
 * @param {number} options.width
 * @param {number} options.crf  AV1 CRF (0–63; lower = sharper)
 * @param {number} options.deliveryFps
 * @param {number} options.maxMb  0 disables size targeting
 */
function encodeAvifFromFrames(ffmpegBin, framesDir, avifPath, options) {
  const captureFps = Number(options.captureFps);
  const width = Number(options.width);
  let crf = Number(options.crf);
  let encodeWidth = width;
  const maxMb = Number(options.maxMb);

  if (!Number.isFinite(captureFps) || captureFps <= 0) {
    throw new Error(`encodeAvifFromFrames: invalid captureFps ${options.captureFps}`);
  }
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`encodeAvifFromFrames: invalid width ${options.width}`);
  }
  if (!Number.isFinite(crf)) crf = 32;
  crf = Math.max(0, Math.min(63, Math.round(crf)));
  let fpsFactor = fpsDecimationFactor(captureFps, Number(options.deliveryFps));
  let deliveryFps = captureFps / fpsFactor;

  const pattern = path.join(framesDir, "frame-%05d.jpg");

  /**
   * @param {number} crfOut
   * @param {number} factor
   * @param {number} w
   */
  function encodeOnce(crfOut, factor, w) {
    const evenWidth = w % 2 === 0 ? w : w - 1;
    const outFps = captureFps / factor;
    // libaom CRF needs -b:v 0. Muxer -loop 0 = infinite (also the default).
    runFfmpeg(
      ffmpegBin,
      [
        "-y",
        "-framerate",
        formatRate(captureFps),
        "-i",
        pattern,
        "-vf",
        buildFilterChain(captureFps, factor, evenWidth),
        "-an",
        "-c:v",
        "libaom-av1",
        "-cpu-used",
        "6",
        "-row-mt",
        "1",
        "-crf",
        String(crfOut),
        "-b:v",
        "0",
        "-still-picture",
        "0",
        ...deliveryRateArgs(outFps),
        "-loop",
        "0",
        avifPath,
      ],
      "avif encode"
    );
  }

  encodeOnce(crf, fpsFactor, encodeWidth);
  let sizeMb = fs.statSync(avifPath).size / (1024 * 1024);
  console.log(
    `  avif pass crf=${crf} fps=${deliveryFps.toFixed(2)} w=${encodeWidth} → ${sizeMb.toFixed(2)} MB`
  );

  if (!(maxMb > 0)) return;

  let guard = 0;
  while (sizeMb > maxMb && guard < 16) {
    guard += 1;
    if (crf < 40) {
      crf = Math.min(40, crf + 3);
    } else if (captureFps / (fpsFactor + 1) >= 16) {
      fpsFactor += 1;
    } else if (encodeWidth > 900) {
      encodeWidth = Math.max(900, Math.round(encodeWidth * 0.88));
    } else if (crf < 48) {
      crf = Math.min(48, crf + 2);
    } else if (captureFps / (fpsFactor + 1) >= 12) {
      fpsFactor += 1;
    } else {
      console.warn(
        `  avif still ${sizeMb.toFixed(2)} MB after compression passes (target ${maxMb} MB)`
      );
      break;
    }
    deliveryFps = captureFps / fpsFactor;

    encodeOnce(crf, fpsFactor, encodeWidth);
    sizeMb = fs.statSync(avifPath).size / (1024 * 1024);
    console.log(
      `  avif pass crf=${crf} fps=${deliveryFps.toFixed(2)} w=${encodeWidth} → ${sizeMb.toFixed(2)} MB`
    );
  }

  if (maxMb > 0 && sizeMb > maxMb) {
    console.warn(
      `  warning: final avif is ${sizeMb.toFixed(2)} MB (over ${maxMb} MB budget)`
    );
  }
}

/**
 * @param {string} ffmpegBin
 * @param {string} framesDir
 * @param {string} webmPath
 * @param {number} fps
 */
function encodeWebmFromFrames(ffmpegBin, framesDir, webmPath, fps) {
  const pattern = path.join(framesDir, "frame-%05d.jpg");
  try {
    runFfmpeg(
      ffmpegBin,
      [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        pattern,
        "-an",
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        "-vsync",
        "cfr",
        "-r",
        String(fps),
        webmPath,
      ],
      "webm vp9 encode"
    );
  } catch {
    runFfmpeg(
      ffmpegBin,
      [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        pattern,
        "-an",
        "-c:v",
        "libvpx",
        "-b:v",
        "2M",
        "-pix_fmt",
        "yuv420p",
        "-vsync",
        "cfr",
        "-r",
        String(fps),
        webmPath,
      ],
      "webm vp8 encode"
    );
  }
}

/**
 * @param {string} ffmpegBin
 * @param {string} framesDir
 * @param {string} gifPath
 * @param {number} fps
 * @param {number} width
 */
function encodeGifFromFrames(ffmpegBin, framesDir, gifPath, fps, width) {
  const pattern = path.join(framesDir, "frame-%05d.jpg");
  const palette = path.join(framesDir, "palette.png");
  // GIF is heavy; cap display rate but keep motion sampling from source frames.
  const gifFps = Math.min(Math.max(12, Math.round(fps / 2)), 24);

  runFfmpeg(
    ffmpegBin,
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      pattern,
      "-vf",
      `fps=${gifFps},scale=${width}:-1:flags=lanczos,palettegen=max_colors=192:stats_mode=full`,
      palette,
    ],
    "gif palettegen"
  );

  runFfmpeg(
    ffmpegBin,
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      pattern,
      "-i",
      palette,
      "-lavfi",
      `fps=${gifFps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
      "-loop",
      "0",
      gifPath,
    ],
    "gif encode"
  );
}

/**
 * @param {string} filePath
 */
function logWrote(filePath) {
  const sizeMb = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${path.relative(ROOT, filePath)} (${sizeMb} MB)`);
}

/**
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} options.dpr
 * @param {string} options.theme
 * @param {boolean} [options.headless]
 */
async function createCaptureContext(playwright, options) {
  const { width, height, dpr, theme, headless = true } = options;

  const browser = await playwright.chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    colorScheme: theme === "dark" ? "dark" : "light",
    // Match tokens.css reduced-motion path so UI transitions cannot mid-frame.
    reducedMotion: "reduce",
  });
  await installCaptureInit(context, theme);
  return { browser, context };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    printHelp();
    process.exit(1);
  }

  if (args.help) {
    printHelp();
    return;
  }

  const theme = String(args.theme);
  if (theme !== "light" && theme !== "dark") {
    throw new Error("--theme must be light or dark");
  }

  const width = parsePositiveInt(args.width, "--width");
  const height = parsePositiveInt(args.height, "--height");
  const durationMs = parsePositiveInt(args.duration, "--duration");
  const fps = parsePositiveInt(args.fps, "--fps");
  const dpr = Number(String(args.dpr).trim());
  if (!Number.isFinite(dpr) || dpr <= 0) {
    throw new Error(
      `--dpr must be a positive number (got ${JSON.stringify(args.dpr)})`
    );
  }
  const settleMs = parsePositiveInt(args.settleMs, "--settle-ms");
  const quality = parsePositiveInt(args.quality, "--quality");
  if (quality > 100) {
    throw new Error("--quality must be 0–100");
  }
  const outFps = parsePositiveInt(args.outFps, "--out-fps");
  const maxMb = Number(String(args.maxMb).trim());
  if (!Number.isFinite(maxMb) || maxMb < 0) {
    throw new Error("--max-mb must be a number ≥ 0 (0 disables targeting)");
  }
  const outWidthRaw = String(args.outWidth ?? "").trim();
  const outWidth = outWidthRaw
    ? parsePositiveInt(outWidthRaw, "--out-width")
    : width;
  if (outWidth > width) {
    throw new Error(
      `--out-width (${outWidth}) cannot exceed capture --width (${width})`
    );
  }
  const avifCrfRaw = Number(String(args.avifCrf).trim());
  if (!Number.isFinite(avifCrfRaw) || !Number.isInteger(avifCrfRaw) || avifCrfRaw < 0 || avifCrfRaw > 63) {
    throw new Error("--avif-crf must be an integer 0–63");
  }
  const avifCrf = avifCrfRaw;
  const outDir = String(args.outDir);
  const basename = String(args.basename);
  const loop = Boolean(args.loop);
  const hideTitles = Boolean(args.hideTitles);
  const formats = Array.isArray(args.formats) ? args.formats : ["avif"];
  const reuseFrames = Boolean(args.reuseFrames);
  const cleanFrames = Boolean(args.cleanFrames);

  fs.mkdirSync(outDir, { recursive: true });

  const framesDir = path.join(outDir, `.${basename}-frames`);
  const ffmpegBin = resolveFfmpeg();
  console.log(`Using ffmpeg: ${ffmpegBin}`);
  console.log(`Formats: ${formats.join(", ")}`);

  /** @type {number} */
  let encodeFps = fps;

  if (reuseFrames) {
    const existing = loadExistingFrames(framesDir, durationMs);
    encodeFps = existing.encodeFps;
    console.log(
      `Reusing ${existing.frameCount} frames from ${path.relative(ROOT, framesDir)} @ ${encodeFps.toFixed(2)} fps`
    );
  } else {
    const staticServer = await startStaticServer(ROOT);
    const demoUrl = `http://127.0.0.1:${staticServer.port}/demo.html`;

    console.log(`Serving ${ROOT}`);
    console.log(`Demo URL: ${demoUrl}`);

    const playwright = await loadPlaywright();

    if (args.preview) {
      console.log(`
Preview mode — chrome removed, #main duplicated for the carousel seam.
${hideTitles ? "Tier/section titles and section subtitles hidden for a continuous section scroll.\n" : ""}Scroll one copy height to see the first section again after the last.
Press Ctrl+C to stop.
`);
      const { browser, context } = await createCaptureContext(playwright, {
        width,
        height,
        dpr,
        theme,
        headless: false,
      });
      const page = await context.newPage();
      const scrollBy = await openPreparedDemo(page, demoUrl, {
        loop,
        settleMs,
        hideTitles,
      });
      console.log(`Loop scroll distance: ${Math.round(scrollBy)}px`);
      await new Promise(() => {
        /* keep server + browser until Ctrl+C */
      });
      await context.close();
      await browser.close();
      return;
    }

    const { browser, context } = await createCaptureContext(playwright, {
      width,
      height,
      dpr,
      theme,
      headless: Boolean(args.headless),
    });

    const page = await context.newPage();
    try {
      const rawScrollBy = await openPreparedDemo(page, demoUrl, {
        loop,
        settleMs,
        hideTitles,
      });
      // Duration owns loop length / scroll speed. For avif/webp, --out-fps picks
      // the sampling density (step size). --fps is only the rate for webm/gif —
      // using max(fps, outFps) here previously forced 1px steps and a huge
      // capture rate whenever --fps was raised, which then fought --out-fps in
      // the encoder and could play back too fast.
      const wantsAnimatedImage = formats.some(
        (format) => format === "avif" || format === "webp"
      );
      const targetFps = wantsAnimatedImage ? outFps : fps;
      if (wantsAnimatedImage && fps !== outFps) {
        console.log(
          `Note: avif/webp step planning uses --out-fps ${outFps} (ignoring --fps ${fps}; that flag is for webm/gif).`
        );
      }
      let plan = planScrollCadence({
        scrollBy: rawScrollBy,
        durationMs,
        targetFps,
        viewportHeight: height,
      });

      if (loop) {
        // Pad the seam so frameCount × stepPx lands exactly on the clone.
        const aligned = await page.evaluate(alignCaptureLoopToStep, {
          stepPx: plan.stepPx,
        });
        plan = planScrollCadence({
          scrollBy: Number(aligned?.scrollBy) || rawScrollBy,
          durationMs,
          targetFps,
          viewportHeight: height,
        });
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      const plannedSec = plan.frameCount / plan.encodeFps;
      console.log(
        `Capturing ${plan.frameCount * plan.stepPx}px over ${durationMs}ms → ~${plannedSec.toFixed(1)}s @ ${plan.encodeFps.toFixed(2)} fps (${plan.stepPx}px/frame${hideTitles ? ", titles hidden" : ""})…`
      );
      const captured = await captureScrollFrames(page, {
        stepPx: plan.stepPx,
        frameCount: plan.frameCount,
        encodeFps: plan.encodeFps,
        framesDir,
      });
      encodeFps = captured.encodeFps;
      writeFramesMeta(framesDir, {
        basename,
        frameCount: captured.frameCount,
        encodeFps: captured.encodeFps,
        stepPx: plan.stepPx,
        durationMs,
        fps,
        width,
        height,
        dpr,
        theme,
        capturedAt: new Date().toISOString(),
      });
      console.log(
        `Captured ${captured.frameCount} frames @ ${encodeFps.toFixed(2)} fps encode`
      );
      console.log(
        `Frames kept in ${path.relative(ROOT, framesDir)} (pass --reuse-frames to re-encode; --clean-frames to delete)`
      );
    } finally {
      await context.close();
      await browser.close();
      await staticServer.close();
    }
  }

  for (const fmt of formats) {
    const outPath = path.join(outDir, `${basename}.${fmt}`);
    if (fmt === "avif") {
      encodeAvifFromFrames(ffmpegBin, framesDir, outPath, {
        captureFps: encodeFps,
        width: outWidth,
        crf: avifCrf,
        deliveryFps: outFps,
        maxMb,
      });
    } else if (fmt === "webp") {
      encodeWebpFromFrames(ffmpegBin, framesDir, outPath, {
        captureFps: encodeFps,
        width: outWidth,
        quality,
        deliveryFps: outFps,
        maxMb,
      });
    } else if (fmt === "webm") {
      encodeWebmFromFrames(ffmpegBin, framesDir, outPath, encodeFps);
    } else if (fmt === "gif") {
      encodeGifFromFrames(ffmpegBin, framesDir, outPath, encodeFps, width);
    }
    logWrote(outPath);
  }

  if (cleanFrames) {
    fs.rmSync(framesDir, { recursive: true, force: true });
    console.log(`Removed ${path.relative(ROOT, framesDir)}`);
  }

  console.log(
    "Done. Loop the output in a player — start and end form a continuous carousel."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

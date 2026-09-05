import sharp from "sharp";
import { ANYMODEL_IMAGE_MODEL, ANYMODEL_IMAGE_FALLBACK_MODEL, ANYMODEL_IMAGE_FALLBACK2_MODEL, ANYMODEL_IMAGE_CANDIDATES } from "@/lib/ai-models";
import { aiLog, aiWarn } from "@/lib/ai-log";

const PINATA_TIMEOUT = 12000;

// Upper bound for a single AnyModel image request. nano-banana-lite renders in
// ~4s and the fallback chain models in 15-40s, so 150s is generous headroom.
// The route's withBudget is the real guard; this just prevents an individual
// fetch from running forever.
const ANYMODEL_IMAGE_TIMEOUT_MS = 150000;

const BANNER_MODERATED_TERMS: Array<[RegExp, string]> = [
  // Trademarked / real-world characters.
  [/pepe\s+the\s+frog/gi, "a cheerful green frog"],
  [/\bpepe\b/gi, "the green frog"],
  // Image-model moderation is word-sensitive; these phrases have tripped
  // content filters in live tests (Vera's DNA, Anime v1). Each swap keeps the
  // visual meaning.
  [/\bfists?\b/gi, "hands"],
  [/\bresistance\b/gi, "determination"],
  [/\bstrikes?\b/gi, "moves"],
  [/\bblades?\b/gi, "edges"],
  [/\bimpact\b/gi, "energy"],
  [/\bthrust\b/gi, "raised"],
  [/\bweapons?\b/gi, "gadgets"],
  [/\bskull\b/gi, "emblem"],
  [/\bblood\b/gi, "glow"],
  [/\bsmoke\b/gi, "glow"],
  [/\bcigarettes?\b/gi, "pens"],
];

export function sanitizeBannerPrompt(prompt: string): string {
  let out = prompt;
  for (const [re, replacement] of BANNER_MODERATED_TERMS) {
    out = out.replace(re, replacement);
  }
  return out;
}

async function tryPinataWithBuffer(
  compressed: Buffer,
  authType: "jwt" | "apikey",
  jwt?: string,
  apiKey?: string,
  apiSecret?: string,
): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(compressed)], { type: "image/webp" }), `banner-${Date.now()}.webp`);
  formData.append("pinataMetadata", JSON.stringify({ name: `pager-${Date.now()}`, keyvalues: { project: "Pager", format: "webp" } }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const headers: Record<string, string> = {};
  if (authType === "jwt" && jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  } else if (authType === "apikey" && apiKey && apiSecret) {
    headers["pinata_api_key"] = apiKey;
    headers["pinata_secret_api_key"] = apiSecret;
  } else {
    return null;
  }

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers,
      body: formData,
      signal: AbortSignal.timeout(PINATA_TIMEOUT),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      const hint = res.status === 403 && err.includes("NO_SCOPES_FOUND")
        ? " — Pinata key is missing the pinFileToIPFS scope (recreate the key with Pinning scopes)"
        : "";
      console.error(`Pinata ${authType} failed: ${res.status} — ${err.slice(0, 200)}${hint}`);
      return null;
    }

    const data = await res.json();
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
    return `${gateway.replace(/\/+$/, "")}/${data.IpfsHash}`;
  } catch (e: any) {
    console.error(`Pinata ${authType} fetch error: ${e.message}`);
    return null;
  }
}

async function pinBufferToPinata(compressed: Buffer): Promise<string | null> {
  const pinataJwt = process.env.PINATA_JWT?.trim().replace(/^["'\s]+|["'\s]+$/g, "");
  const pinataApiKey = process.env.PINATA_API_KEY?.trim();
  const pinataApiSecret = process.env.PINATA_API_SECRET?.trim();

  // Try JWT first (1 attempt), then API key (1 attempt)
  if (pinataJwt) {
    const url = await tryPinataWithBuffer(compressed, "jwt", pinataJwt);
    if (url) return url;
  }

  if (pinataApiKey && pinataApiSecret) {
    const url = await tryPinataWithBuffer(compressed, "apikey", undefined, pinataApiKey, pinataApiSecret);
    if (url) return url;
  }

  return null;
}

/** Fetch a remote image and return it as a base64 data URL (AnyModel reference format). */
async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      // The Pinata gateway is slow — 10s used to lose the reference on
      // half the requests. 25s covers connect + body for a typical mascot.
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e: any) {
    console.warn("imageToDataUrl error:", e.message);
    return null;
  }
}

export interface AnyModelImageOptions {
  model?: string;
  size?: string;
  quality?: string;
  inputImage?: string;
}

// Sizes reported by ag/gemini-3.1-flash-image in the AnyModel catalog, plus
// 1280x720 which is proven to work against the live gateway. Anything else is
// clamped to the default to avoid a 400 from the image endpoint.
const ANYMODEL_IMAGE_SIZES = new Set([
  "1280x720",
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
]);
const DEFAULT_ANYMODEL_IMAGE_SIZE = "1792x1024";

// Short timeout for cheap model probes (256x256) — dead models should fall
// through fast so we don't burn the banner budget on them.
const ANYMODEL_PROBE_TIMEOUT_MS = 12000;

/**
 * One raw AnyModel image request returning the raw image buffer (pre-compress,
 * pre-pin), or null when the model returns no usable image. Does not swallow
 * HTTP errors — callers decide how to react.
 */
async function rawAnyModelImage(
  target: string,
  prompt: string,
  opts: { apiKey: string; size: string; timeoutMs: number; inputImage?: string; quality?: string },
): Promise<Buffer | null> {
  const body: Record<string, unknown> = {
    prompt,
    n: 1,
    quality: opts.quality || "medium",
    output_format: "png",
    response_format: "b64_json",
    model: target,
    size: opts.size,
  };
  if (opts.inputImage) {
    const dataUrl = opts.inputImage.startsWith("data:")
      ? opts.inputImage
      : await imageToDataUrl(opts.inputImage);
    if (dataUrl) body.image = dataUrl;
  }

  const res = await fetch("https://anymodel.org/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    const hint =
      res.status === 402
        ? " — AnyModel balance empty (top up in cabinet)"
        : res.status === 401
          ? " — AnyModel key invalid/revoked"
            : res.status === 404 || res.status === 406
              ? " — image model not found/unsupported"
              : "";
    aiWarn("image.raw", `${target} HTTP ${res.status}: ${err.slice(0, 220)}${hint}`);
    const e = new Error(`AnyModel image error (${res.status})`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }

  const data = await res.json();
  const item = data?.data?.[0];
  if (item?.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item?.url) {
    const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(10000) });
    if (imgRes.ok) return Buffer.from(await imgRes.arrayBuffer());
  }
  aiLog("image.raw", `${target} returned no image data`);
  return null;
}

/**
 * Cheap health-check for a single image model before committing a full render.
 * Sends a tiny 256x256 request with a trivial prompt. Returns the live status:
 * { ok: true } when the model produced image bytes, or { ok: false, status } on
 * failure. `status` is the HTTP code (429/5xx/timeout) so the UI can tell the
 * user exactly why a model was rejected. Costs a fraction of a full banner.
 */
export async function probeAnyModelImage(model: string): Promise<{ ok: boolean; status?: number }> {
  const apiKey = process.env.ANYMODEL_API_KEY?.trim();
  if (!apiKey || !model) return { ok: false };
  try {
    const start = Date.now();
    const buf = await rawAnyModelImage(model, "solid grey background", {
      apiKey,
      size: "256x256",
      timeoutMs: ANYMODEL_PROBE_TIMEOUT_MS,
      quality: "low",
    });
    const ms = Date.now() - start;
    aiLog("probe", `${model} ${buf ? "OK" : "no-image"} in ${ms}ms`);
    return { ok: !!buf };
  } catch (e: any) {
    const status = (e as Error & { status?: number })?.status;
    aiWarn("probe", `${model} FAILED${status ? ` (${status})` : ""}: ${e.message}`);
    return { ok: false, status };
  }
}

/** HTTP statuses that mean "upstream hiccup" — worth one probe retry. */
const PROBE_RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Probe a model, retrying once on transient upstream errors (429/5xx/timeout)
 * so a momentary blip doesn't wrongly rule out a working engine. Probes are
 * cheap and never produce the paid banner, so this is safe to retry.
 */
export async function probeAnyModelImageWithRetry(model: string): Promise<{ ok: boolean; status?: number }> {
  const first = await probeAnyModelImage(model);
  if (first.ok || first.status === undefined || !PROBE_RETRYABLE.has(first.status)) {
    return first;
  }
  aiLog("probe", `${model} retryable probe (${first.status}), retrying once`);
  return probeAnyModelImage(model);
}

/**
 * Primary banner engine with a probe-first strategy (the "health-check before
 * you waste a full render" approach). Candidates are probed cheaply first, then
 * the first model proven alive renders the actual banner. If the chosen model
 * then fails mid-render, the next alive candidate is tried. Only when no
 * candidate can produce a real banner does it return null (→ SVG last resort).
 *
 * @param prompt        the sanitized visual prompt
 * @param options       size/quality/inputImage (mascot I2I reference)
 * @param candidates    ordered model list to try (defaults to the full chain)
 * @param onProgress    optional callback to observe pipeline phase changes
 * @param onProbe       optional per-model probe verdict (model + ok + HTTP status)
 */
export async function generateReliableBanner(
  prompt: string,
  options: AnyModelImageOptions = {},
  candidates?: string[],
  onProgress?: (phase: "probing" | "rendering" | "pinning" | "done", model?: string) => void,
  onProbe?: (result: { model: string; ok: boolean; status?: number }) => void,
): Promise<{ url: string; model: string } | null> {
  const apiKey = process.env.ANYMODEL_API_KEY?.trim();
  if (!apiKey) return null;

  const chain = (candidates && candidates.length ? candidates : ANYMODEL_IMAGE_CANDIDATES()).filter(Boolean);
  if (chain.length === 0) {
    aiWarn("banner", "no image models configured");
    return null;
  }

  const requestedSize = options.size || process.env.ANYMODEL_IMAGE_SIZE?.trim() || DEFAULT_ANYMODEL_IMAGE_SIZE;
  const size = ANYMODEL_IMAGE_SIZES.has(requestedSize) ? requestedSize : DEFAULT_ANYMODEL_IMAGE_SIZE;

  const inputImage = options.inputImage;
  let dataUrl: string | undefined;
  if (inputImage) {
    dataUrl = inputImage.startsWith("data:") ? inputImage : (await imageToDataUrl(inputImage)) || undefined;
  }

  // Lazy probe → render loop: for each candidate, cheaply health-check it, then
  // immediately render full-size if it's alive. This avoids wasting the budget
  // probing engines we'll never reach, while still reporting each model's live
  // verdict (ok + HTTP status) so the UI can show the user the engine-by-engine
  // state instead of a silent progress bar. An alive probe can still fail the
  // full render (size/I2I support), in which case we move to the next candidate.
  onProgress?.("probing");
  let anyAlive = false;
  for (const model of chain) {
    const probe = await probeAnyModelImageWithRetry(model);
    if (!probe.ok) {
      onProbe?.({ model, ok: false, status: probe.status });
      aiLog("banner", `${model} DOWN on probe${probe.status ? ` (${probe.status})` : ""}`);
      continue;
    }
    anyAlive = true;
    onProbe?.({ model, ok: true });

    // Probe passed — try the full render now.
    const start = Date.now();
    onProgress?.("rendering", model);
    try {
      const buffer = await rawAnyModelImage(model, prompt, {
        apiKey,
        size,
        timeoutMs: ANYMODEL_IMAGE_TIMEOUT_MS,
        inputImage: dataUrl,
        quality: options.quality,
      });
      if (!buffer) {
        aiWarn("banner", `${model} probe OK but returned no image`);
        continue;
      }
      onProgress?.("pinning");
      const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();
      const pinned = await pinBufferToPinata(compressed);
      if (!pinned) {
        aiWarn("banner", `${model} rendered but pin failed`);
        continue;
      }
      aiLog("banner", `${model} OK in ${Date.now() - start}ms size ${size}`);
      onProgress?.("done", model);
      return { url: pinned, model };
    } catch (e: any) {
      aiWarn("banner", `${model} full render failed: ${e.message}`);
    }
  }

  if (!anyAlive) aiWarn("banner", "no model passed the probe — no banner rendered");
  else aiWarn("banner", "all probed models failed the full render");
  return null;
}

/**
 * @deprecated kept as a plain cascade for direct/fallback callers; prefer
 * generateReliableBanner (probe-first). Primary banner engine: AnyModel
 * (https://anymodel.org/v1). Returns the rendered+bound URL + model, or null.
 */
export async function generateAnyModelImage(
  prompt: string,
  options: AnyModelImageOptions = {},
): Promise<{ url: string; model: string } | null> {
  return generateReliableBanner(prompt, options, options.model ? [options.model] : undefined);
}


const SVG_PALETTES: [string, string][] = [
  ["#0f0c29", "#7b2ff7"],
  ["#0d0221", "#00f0ff"],
  ["#1a0033", "#ff2975"],
  ["#100c08", "#c98a4b"],
  ["#0b1d3a", "#2dd4bf"],
  ["#3a0b0b", "#fbbf24"],
  ["#1a0e00", "#ff6b00"],
  ["#f5efe0", "#d4a95c"],
  ["#3a5a2f", "#8fbf5f"],
  ["#e8d8c8", "#b06a4a"],
];

const ATMOSPHERE_PALETTE_INDEX: Record<string, number> = {
  "Surrealism": 0, "Pixel Art": 1, "Brick Style": 3, "Anime Style": 4, "Graffiti": 2, "Comics": 5, "GTA Style": 6,
  "Origami": 7, "Minecraft": 8, "Yarn Style": 9,
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(text: string, maxChars: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines.slice(0, 4) : ["Pager"];
}

/**
 * Deterministic last-resort banner: renders title + atmosphere palette to an
 * SVG, rasterizes with sharp, pins to Pinata, falls back to a base64 data URL.
 * Never depends on external APIs, so it cannot fail to produce an image.
 */
export async function generateSvgBanner(
  title: string,
  atmosphere: string = "Surrealism",
): Promise<string> {
  const cleanTitle =
    (title || "Pager")
      .replace(/<[^>]*>/g, "")
      .replace(/&(nbsp|amp|quot|#39);/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) || "Pager";

  const normalizedAtmosphere = atmosphere.trim() || "Surrealism";
  const paletteIndex = ATMOSPHERE_PALETTE_INDEX[normalizedAtmosphere] ?? (
    [...normalizedAtmosphere].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % SVG_PALETTES.length
  );
  const [c1, c2] = SVG_PALETTES[paletteIndex] || SVG_PALETTES[0];

  const fontSize = cleanTitle.length > 80 ? 52 : cleanTitle.length > 40 ? 64 : 78;
  const maxChars = Math.floor(1120 / (fontSize * 0.58));
  const lines = wrapTitle(cleanTitle.toUpperCase(), maxChars);
  const lineHeight = Math.round(fontSize * 1.25);
  const textY = 380 - ((lines.length - 1) * lineHeight) / 2;

  const circles = SVG_PALETTES.map((_, i) => {
    const x = 60 + (i * 247) % 1260;
    const y = 90 + (i * 173) % 560;
    return `<circle cx="${x}" cy="${y}" r="${60 + i * 22}" fill="${i % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.12)"}"/>`;
  }).join("\n");

  const titleLines = lines.map((line, i) =>
    `<text x="672" y="${textY + i * lineHeight}" text-anchor="middle" font-size="${fontSize}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" fill="#ffffff" letter-spacing="2">${escapeXml(line)}</text>`
  ).join("\n");

  const svg = `<svg width="1344" height="768" viewBox="0 0 1344 768" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1344" height="768" fill="url(#bg)"/>
  ${circles}
  <rect x="40" y="40" width="1264" height="688" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
  <text x="672" y="120" text-anchor="middle" font-size="20" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" fill="rgba(255,255,255,0.85)" letter-spacing="10">PAGER PROTOCOL</text>
  ${titleLines}
  <text x="672" y="690" text-anchor="middle" font-size="18" font-family="DejaVu Sans, Arial, sans-serif" fill="rgba(255,255,255,0.7)" letter-spacing="6">${escapeXml(normalizedAtmosphere.toUpperCase())}</text>
</svg>`;

  try {
    const webp = await sharp(Buffer.from(svg), { density: 150 })
      .webp({ quality: 85, effort: 3 })
      .toBuffer();

    const pinned = await pinBufferToPinata(webp);
    if (pinned) return pinned;

    return `data:image/webp;base64,${webp.toString("base64")}`;
  } catch (e: any) {
    console.error("generateSvgBanner error:", e.message);
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
}

import sharp from "sharp";
import { ANYMODEL_IMAGE_MODEL, ANYMODEL_IMAGE_FALLBACK_MODEL } from "@/lib/ai-models";

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

// Transient upstream failures — safe to retry on a different model.
const IMAGE_RETRYABLE = new Set([400, 408, 425, 429, 500, 502, 503, 504]);

/**
 * Primary banner engine: AnyModel (https://anymodel.org/v1) — an
 * OpenAI-compatible gateway. Synchronous POST to /v1/images/generations,
 * returns the base64 image which we recompress to WebP and pin to IPFS.
 * The mascot reference image is passed as a base64 data URL in `image`
 * (the gateway rejects public URLs unless a model explicitly supports them).
 * Returns the Pinata IPFS URL on success, or null on any failure.
 * Retries once with the fallback image model on transient errors (429/5xx).
 */
export async function generateAnyModelImage(
  prompt: string,
  options: AnyModelImageOptions = {},
): Promise<string | null> {
  const apiKey = process.env.ANYMODEL_API_KEY?.trim();
  if (!apiKey) return null;

  const primary = options.model || ANYMODEL_IMAGE_MODEL();
  const fallback = ANYMODEL_IMAGE_FALLBACK_MODEL();

  const body: Record<string, unknown> = {
    prompt,
    n: 1,
    quality: options.quality || "medium",
    output_format: "png",
    response_format: "b64_json",
  };

  const inputImage = options.inputImage;
  if (inputImage) {
    const dataUrl = inputImage.startsWith("data:")
      ? inputImage
      : await imageToDataUrl(inputImage);
    if (dataUrl) body.image = dataUrl;
  }

  const attempt = async (target: string, timeoutMs: number): Promise<string | null> => {
    const requestedSize = options.size || process.env.ANYMODEL_IMAGE_SIZE?.trim() || DEFAULT_ANYMODEL_IMAGE_SIZE;
    const size = ANYMODEL_IMAGE_SIZES.has(requestedSize) ? requestedSize : DEFAULT_ANYMODEL_IMAGE_SIZE;

    try {
      const res = await fetch("https://anymodel.org/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, model: target, size }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "unknown");
        const hint =
          res.status === 402
            ? " — AnyModel balance empty (top up in cabinet)"
            : res.status === 401
              ? " — AnyModel key invalid/revoked"
                : res.status === 404 || res.status === 406
                  ? " — image model not found (check ANYMODEL_IMAGE_MODEL in .env)"
                  : "";
        console.error(`AnyModel image ${target} failed: ${res.status} — ${err.slice(0, 300)}${hint}`);
        const e = new Error(`AnyModel image error (${res.status})`) as Error & { status?: number };
        e.status = res.status;
        throw e;
      }

      const data = await res.json();
      const item = data?.data?.[0];
      let buffer: Buffer | null = null;
      if (item?.b64_json) {
        buffer = Buffer.from(item.b64_json, "base64");
      } else if (item?.url) {
        const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(10000) });
        if (imgRes.ok) buffer = Buffer.from(await imgRes.arrayBuffer());
      }
      if (!buffer) {
        console.error("AnyModel returned no image data");
        return null;
      }

      const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();
      const pinned = await pinBufferToPinata(compressed);
      return pinned || null;
    } catch (e: any) {
      console.error(`AnyModel image ${target} error: ${e.message}`);
      throw e;
    }
  };

  try {
    const result = await attempt(primary, ANYMODEL_IMAGE_TIMEOUT_MS);
    if (result) return result;
  } catch (e: any) {
    const retryable = e?.name === "TimeoutError" || e?.status === undefined || (e?.status && IMAGE_RETRYABLE.has(e.status));
    if (!retryable || primary === fallback) return null;
    console.warn(`AnyModel image primary ${primary} failed, falling back to ${fallback}`);
  }

  try {
    return await attempt(fallback, ANYMODEL_IMAGE_TIMEOUT_MS);
  } catch (e: any) {
    console.error(`AnyModel image fallback ${fallback} also failed: ${e.message}`);
    return null;
  }
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

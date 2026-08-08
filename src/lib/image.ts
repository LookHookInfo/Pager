import sharp from "sharp";

const PINATA_TIMEOUT = 12000;

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
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
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

/**
 * Primary banner engine: AnyModel (https://anymodel.org/v1) — an
 * OpenAI-compatible gateway. Synchronous POST to /v1/images/generations,
 * returns the base64 image which we recompress to WebP and pin to IPFS.
 * The mascot reference image is passed as a base64 data URL in `image`
 * (the gateway rejects public URLs unless a model explicitly supports them).
 * Returns the Pinata IPFS URL on success, or null on any failure.
 */
export async function generateAnyModelImage(
  prompt: string,
  options: AnyModelImageOptions = {},
): Promise<string | null> {
  const apiKey = process.env.ANYMODEL_API_KEY?.trim();
  if (!apiKey) return null;

  const model = options.model || process.env.ANYMODEL_IMAGE_MODEL?.trim() || "ag/gemini-3.1-flash-image";
  const size = options.size || process.env.ANYMODEL_IMAGE_SIZE?.trim() || "1792x1024";

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
    quality: options.quality || "medium",
    output_format: "png",
    response_format: "b64_json",
  };

  if (options.inputImage) {
    const dataUrl = options.inputImage.startsWith("data:")
      ? options.inputImage
      : await imageToDataUrl(options.inputImage);
    if (dataUrl) body.image = dataUrl;
  }

  try {
    const res = await fetch("https://anymodel.org/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      const hint =
        res.status === 402
          ? " — AnyModel balance empty (top up in cabinet)"
          : res.status === 401
            ? " — AnyModel key invalid/revoked"
            : res.status === 404 || res.status === 406
              ? " — image model not found/supported (check ANYMODEL_IMAGE_MODEL in .env)"
              : "";
      console.error(`AnyModel image failed: ${res.status} — ${err.slice(0, 300)}${hint}`);
      return null;
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
    console.error("AnyModel image error:", e.message);
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
];

const ATMOSPHERE_PALETTE_INDEX: Record<string, number> = {
  "Surrealism": 0, "Pixel Art": 1, "Brick Style": 3, "Anime Style": 4, "Graffiti": 2, "Comics": 5,
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

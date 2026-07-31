import sharp from "sharp";
import { DEFAULT_BFL_MODEL } from "@/lib/bfl-models";

const PINATA_TIMEOUT = 12000;
const BFL_POLL_TIMEOUT = 12000;
const BFL_CREATE_TIMEOUT = 20000;

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
      console.error(`Pinata ${authType} failed: ${res.status} — ${err.slice(0, 200)}`);
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

export async function uploadToPinata(imageUrl: string): Promise<string> {
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) throw new Error(`fetch failed: ${imgRes.status}`);

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();

    const url = await pinBufferToPinata(compressed);
    if (url) return url;

    console.warn("All Pinata methods failed — returning original URL as fallback");
  } catch (e: any) {
    console.error("uploadToPinata error:", e.message);
  }
  return imageUrl;
}

export async function generateBflImage(prompt: string, model: string = DEFAULT_BFL_MODEL): Promise<string> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("BFL_API_KEY missing");

  // Retry create on 429/5xx/network errors — BFL is flaky under load
  let createRes: Response | null = null;
  let lastCreateError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
    try {
      const res = await fetch(`https://api.bfl.ai/v1/${model}`, {
        method: "POST",
        headers: { "x-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width: 1344, height: 768, prompt_upsampling: true }),
        signal: AbortSignal.timeout(BFL_CREATE_TIMEOUT),
      });

      if (res.status === 429 || res.status >= 500) {
        lastCreateError = new Error(`BFL creation failed: ${res.status}`);
        continue;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`BFL creation failed: ${res.status} — ${JSON.stringify(err)}`);
      }
      createRes = res;
      break;
    } catch (e: any) {
      lastCreateError = e;
      if (e.name === "TimeoutError") continue;
      if (attempt < 2) continue;
      throw e;
    }
  }

  if (!createRes) {
    throw lastCreateError || new Error("BFL creation failed");
  }

  const { id } = await createRes.json();
  const pollUrl = `https://api.bfl.ai/v1/get_result?id=${id}`;

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const statusRes = await fetch(pollUrl, {
        headers: { "x-key": apiKey },
        signal: AbortSignal.timeout(BFL_POLL_TIMEOUT),
      });
      if (!statusRes.ok) continue;

      const { status, result, error } = await statusRes.json();
      if (status === "Ready" && result?.sample) {
        return await uploadToPinata(result.sample);
      }
      if (status === "Failed" || status === "Error") {
        throw new Error(`BFL failed: ${error || "unknown"}`);
      }
    } catch (e: any) {
      if (e.name === "TimeoutError") {
        console.warn(`BFL poll #${i + 1} timed out, retrying...`);
        continue;
      }
      throw e;
    }
  }

  throw new Error("BFL timed out (60s)");
}

/**
 * Fallback image engine: Google Gemini 2.5 Flash Image.
 * Returns the Pinata IPFS URL on success, or null on any failure.
 */
export async function generateGeminiImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(90000),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      console.error(`Gemini image failed: ${res.status} — ${err.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart) return null;

    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();

    const pinned = await pinBufferToPinata(compressed);
    return pinned || null;
  } catch (e: any) {
    console.error("generateGeminiImage error:", e.message);
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

import sharp from "sharp";
import { DEFAULT_BFL_MODEL } from "@/lib/bfl-models";

const PINATA_TIMEOUT = 12000;
const BFL_POLL_TIMEOUT = 20000;
const BFL_CREATE_TIMEOUT = 30000;
const BFL_POLL_INTERVAL_MS = 2000;
const BFL_MAX_POLLS = 30;

const BFL_TERMINAL_STATUSES = new Set([
  "Failed",
  "Error",
  "Moderated",
  "Request Moderated",
  "Content Moderated",
]);

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

export async function uploadToPinata(imageUrl: string): Promise<string | null> {
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) throw new Error(`fetch failed: ${imgRes.status}`);

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();

    const url = await pinBufferToPinata(compressed);
    if (url) return url;

    console.warn("All Pinata methods failed");
  } catch (e: any) {
    console.error("uploadToPinata error:", e.message);
  }
  return null;
}

export interface BflTask {
  id: string;
  pollingUrl: string;
}

/**
 * Submit a FLUX task to BFL WITHOUT waiting for it to finish.
 * Used by the async polling flow. Returns the BFL task id and the
 * cluster-specific polling_url (MUST be used — reconstructing the global
 * get_result URL returns "Task not found" for cluster-routed jobs).
 *
 * NOTE: pass webhookUrl/webhookSecret only if you must use webhooks — in
 * webhook mode BFL omits polling_url, leaving no way to poll the task.
 */
export async function submitBflTask(
  prompt: string,
  model: string = DEFAULT_BFL_MODEL,
  webhookUrl?: string,
  webhookSecret?: string,
): Promise<BflTask> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("BFL_API_KEY missing");

  const body: Record<string, unknown> = { prompt, width: 1344, height: 768, safety_tolerance: 5 };
  if (webhookUrl) body.webhook_url = webhookUrl;
  if (webhookSecret) body.webhook_secret = webhookSecret;

  // Retry create on 429/5xx/network errors — BFL is flaky under load
  let lastCreateError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
    try {
      // FLUX.2 applies prompt upsampling (PUP) by default — do not send the
      // FLUX.1-era "prompt_upsampling" param (invalid for flux-2-pro).
      const res = await fetch(`https://api.bfl.ai/v1/${model}`, {
        method: "POST",
        headers: { "x-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

      const created = await res.json();
      if (!created?.id) throw new Error("BFL returned no task id");
      if (!created?.polling_url) throw new Error("BFL returned no polling_url");

      return { id: created.id, pollingUrl: created.polling_url };
    } catch (e: any) {
      lastCreateError = e;
      if (e.name === "TimeoutError") continue;
      if (attempt < 2) continue;
      throw e;
    }
  }

  throw lastCreateError || new Error("BFL creation failed");
}

export interface BflStatus {
  status: string;
  result?: { sample?: string; prompt?: string; seed?: number };
  error?: string;
  message?: string;
}

/** Single BFL status check. Returns null on any transport/HTTP failure. */
export async function pollBflTask(pollingUrl: string): Promise<BflStatus | null> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey || !pollingUrl) return null;
  try {
    const res = await fetch(pollingUrl, {
      headers: { "x-key": apiKey },
      signal: AbortSignal.timeout(BFL_POLL_TIMEOUT),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e: any) {
    console.warn("BFL poll error:", e.message);
    return null;
  }
}

/** Synchronous generation (webhook-less local dev / manual fallback). */
export async function generateBflImage(prompt: string, model: string = DEFAULT_BFL_MODEL): Promise<string> {
  const { pollingUrl } = await submitBflTask(prompt, model);

  for (let i = 0; i < BFL_MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, BFL_POLL_INTERVAL_MS));
    const data = await pollBflTask(pollingUrl);
    if (!data) continue;

    if (data.status === "Ready") {
      if (!data.result?.sample) throw new Error("BFL returned Ready without a sample");
      const pinned = await uploadToPinata(data.result.sample);
      if (pinned) return pinned;
      throw new Error("Pinata upload failed for BFL sample");
    }
    if (BFL_TERMINAL_STATUSES.has(data.status)) {
      throw new Error(`BFL failed: ${data.status}${data.error ? ` — ${data.error}` : ""}`);
    }
  }

  throw new Error(`BFL timed out (${(BFL_MAX_POLLS * BFL_POLL_INTERVAL_MS) / 1000}s)`);
}

/**
 * Fallback image engine: Gemini 2.5 Flash Image via OpenRouter
 * (POST /api/v1/images, model google/gemini-2.5-flash-image).
 * Uses OPENROUTER_API_KEY — the direct Google GEMINI_API_KEY was dead
 * (429, free-tier quota exhausted).
 * Returns the Pinata IPFS URL on success, or null on any failure.
 */
export async function generateOpenRouterImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pager.lookhook.info/",
        "X-Title": "Pager Protocol",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        prompt,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      console.error(`OpenRouter image failed: ${res.status} — ${err.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const imageData = data?.data?.[0];
    const b64 = imageData?.b64_json || imageData?.image || null;
    if (!b64) return null;

    const buffer = Buffer.from(b64, "base64");
    const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();

    const pinned = await pinBufferToPinata(compressed);
    return pinned || null;
  } catch (e: any) {
    console.error("generateOpenRouterImage error:", e.message);
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

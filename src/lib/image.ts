import sharp from "sharp";
export { BFL_MODELS, DEFAULT_BFL_MODEL, type BflModelId } from "@/lib/bfl-models";
import type { BflModelId } from "@/lib/bfl-models";
import { DEFAULT_BFL_MODEL } from "@/lib/bfl-models";

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

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    console.error(`Pinata ${authType} failed: ${res.status} — ${err.slice(0, 200)}`);
    return null;
  }

  const data = await res.json();
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
  return `${gateway.replace(/\/+$/, "")}/${data.IpfsHash}`;
}

export async function uploadToPinata(imageUrl: string): Promise<string> {
  try {
    const pinataJwt = process.env.PINATA_JWT?.trim().replace(/^["'\s]+|["'\s]+$/g, "");
    const pinataApiKey = process.env.PINATA_API_KEY?.trim();
    const pinataApiSecret = process.env.PINATA_API_SECRET?.trim();

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`fetch failed: ${imgRes.status}`);

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();

    if (pinataJwt) {
      for (let i = 1; i <= 3; i++) {
        const url = await tryPinataWithBuffer(compressed, "jwt", pinataJwt);
        if (url) return url;
        if (i < 3) await new Promise(r => setTimeout(r, 1000 * i));
      }
    }

    if (pinataApiKey && pinataApiSecret) {
      for (let i = 1; i <= 3; i++) {
        const url = await tryPinataWithBuffer(compressed, "apikey", undefined, pinataApiKey, pinataApiSecret);
        if (url) return url;
        if (i < 3) await new Promise(r => setTimeout(r, 1000 * i));
      }
    }

    console.error("All Pinata methods failed — returning BFL URL as fallback");
  } catch (e: any) {
    console.error("uploadToPinata error:", e.message);
  }
  return imageUrl;
}

export async function generateBflImage(prompt: string, modelId: BflModelId = DEFAULT_BFL_MODEL): Promise<string> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("BFL_API_KEY missing");

  const endpoint = modelId === "flux-2-klein"
    ? "https://api.bfl.ai/v1/flux-2-klein"
    : modelId === "flux-1-1-pro-ultra"
      ? "https://api.bfl.ai/v1/flux-1-1-pro-ultra"
      : `https://api.bfl.ai/v1/${modelId}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "x-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, width: 1344, height: 768, prompt_upsampling: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`BFL creation failed: ${res.status} — ${JSON.stringify(err)}`);
  }

  const { id } = await res.json();
  const pollUrl = `https://api.bfl.ai/v1/get_result?id=${id}`;

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const statusRes = await fetch(pollUrl, { headers: { "x-key": apiKey } });
    if (!statusRes.ok) continue;

    const { status, result, error } = await statusRes.json();
    if (status === "Ready" && result?.sample) {
      return await uploadToPinata(result.sample);
    }
    if (status === "Failed" || status === "Error") {
      throw new Error(`BFL failed: ${error || "unknown"}`);
    }
  }

  throw new Error("BFL timed out (45s)");
}

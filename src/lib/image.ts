import sharp from "sharp";

export async function uploadToPinata(imageUrl: string): Promise<string> {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) throw new Error("PINATA_JWT missing");

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const compressed = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();

  const cleanJwt = pinataJwt.trim().split(/\s+/).reduce((a, b) => a.length > b.length ? a : b).replace(/JWT$/, "");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(compressed)], { type: "image/webp" }), `banner-${Date.now()}.webp`);
  formData.append("pinataMetadata", JSON.stringify({ name: `pager-${Date.now()}`, keyvalues: { project: "Pager", format: "webp" } }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${cleanJwt}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Pinata upload failed:", err);
    return imageUrl;
  }

  const data = await res.json();
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
  return `${gateway.replace(/\/+$/, "")}/${data.IpfsHash}`;
}

export async function generateBflImage(prompt: string): Promise<string> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("BFL_API_KEY missing");

  const res = await fetch("https://api.bfl.ai/v1/flux-2-pro", {
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

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2000));
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

  throw new Error("BFL timed out (80s)");
}

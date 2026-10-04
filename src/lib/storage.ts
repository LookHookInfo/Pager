/**
 * Storage fallback for rendered banners.
 *
 * Pinata is the primary (decentralized) store, but it is a paid account with a
 * hard usage ceiling. When that ceiling is hit the API answers
 * `403 FORBIDDEN — "Account blocked due to plan usage limit"` and every pin
 * fails, which used to throw the fully rendered banner away and serve the SVG
 * placeholder instead.
 *
 * A rendered banner is expensive (26-89s for gpt-image-2), so losing one to a
 * billing failure is the worst possible outcome. Supabase Storage is already a
 * project dependency and has a public `banners` bucket, so it acts as the
 * fallback: the image survives and stays publicly reachable.
 *
 * The returned URL is a plain https URL. Every consumer goes through
 * ipfsGatewayVariants(), which passes non-IPFS URLs straight through and makes
 * prewarmIpfs() a no-op, so no downstream code needs to know the difference.
 */
import { getSupabaseServer } from "@/lib/supabase";
import { aiWarn } from "@/lib/ai-log";

const BUCKET = "banners";

/**
 * Upload a rendered banner to Supabase Storage. Returns a public URL, or null
 * if the upload fails for any reason (caller then treats it as "no banner").
 */
export async function uploadBannerToStorage(
  buffer: Buffer,
  contentType = "image/webp",
  prefix = "banner",
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    aiWarn("storage", "supabase storage skipped: missing url/key");
    return null;
  }

  // Second-level buckets of time per render keep dozens of files apart while
  // staying collision-free for practical purposes.
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(now.getUTCDate()).padStart(2, "0")}` +
    `-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;
  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";
  const path = `${stamp}-${prefix}.${ext}`;

  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      aiWarn("storage", `upload failed: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl || "";
    if (!publicUrl) {
      aiWarn("storage", "upload ok but no public url");
      return null;
    }
    return publicUrl;
  } catch (e: any) {
    aiWarn("storage", `upload threw: ${e?.message}`);
    return null;
  }
}
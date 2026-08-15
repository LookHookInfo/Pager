export interface BannerResult {
  image_url: string;
  image_engine: string;
  image_model?: string;
}

/**
 * Generate a banner synchronously. The endpoint is paid and non-idempotent, so
 * this must NOT auto-retry (that would double-charge credits). The server
 * returns the ready image inline (AnyModel, or an SVG placeholder on total
 * failure) or responds with an error. gpt-image-2 can take up to ~2 min, so
 * the client waits generously — the server has a 300s cap.
 */
export async function requestBannerJob(body: Record<string, unknown>): Promise<BannerResult> {
  const res = await fetch("/api/ai/banner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Banner generation failed");
  if (!data.image_url) throw new Error(data.error || "Banner generation failed");
  return { image_url: data.image_url, image_engine: data.image_engine || "anymodel", image_model: data.image_model };}

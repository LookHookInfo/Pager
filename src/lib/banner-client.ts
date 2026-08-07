export interface BannerResult {
  image_url: string;
  image_engine: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 170000;

/**
 * Submit a banner job (paid, non-idempotent endpoint — must NOT auto-retry,
 * that would double-charge credits) and wait for the result.
 * Returns the sync result immediately when the server falls back inline, or
 * polls the job status endpoint (which drives the BFL poll) when async.
 */
export async function requestBannerJob(body: Record<string, unknown>): Promise<BannerResult> {
  const res = await fetch("/api/ai/banner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Banner generation failed");

  // Synchronous result (inline fallback path).
  if (data.image_url) {
    return { image_url: data.image_url, image_engine: data.image_engine || "bfl" };
  }

  const jobId = data.job_id;
  if (!jobId) throw new Error("Banner job could not be created");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const sres = await fetch(`/api/ai/banner/status?job_id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const sdata = await sres.json().catch(() => ({}));

    if (sdata.status === "ready" && sdata.image_url) {
      return { image_url: sdata.image_url, image_engine: sdata.image_engine || "bfl" };
    }
    if (sdata.status === "svg_placeholder" && sdata.image_url) {
      return { image_url: sdata.image_url, image_engine: "svg" };
    }
    if (sdata.status === "failed") {
      throw new Error(sdata.error || "Banner generation failed");
    }
    // "pending" / "processing" → keep polling.
  }

  throw new Error("Banner generation timed out. Please try again.");
}

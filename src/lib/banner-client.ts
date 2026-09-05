export interface BannerResult {
  image_url: string;
  image_engine: string;
  image_model?: string;
}

export type BannerPhase = "probing" | "rendering" | "pinning" | "done";

export interface BannerStatus {
  phase: BannerPhase;
  model?: string;
}

/** Live verdict for a single engine probe: is it up, and with what HTTP code. */
export interface BannerProbe {
  model: string;
  ok: boolean;
  status?: number;
}

export interface BannerCallbacks {
  /** Fired on each pipeline phase change (probing/rendering/done). */
  onStatus?: (status: BannerStatus) => void;
  /**
   * Fired for EACH candidate model as the server health-checks it, so the UI
   * can show the user a live feed: "try X → up", "try Y → down (429)".
   */
  onProbe?: (probe: BannerProbe) => void;
}

/**
 * Generate a banner. The endpoint is paid and non-idempotent, so this must NOT
 * auto-retry (that would double-charge credits). The server streams live
 * progress (SSE) while it health-checks engines and renders, then returns the
 * ready image inline (AnyModel, or an SVG placeholder on total failure) or an
 * error. nano-banana-lite renders in ~4s and the server budget is ~120s, so the
 * client waits a bit more than that.
 */
export async function requestBannerJob(
  body: Record<string, unknown>,
  cbs: BannerCallbacks = {},
): Promise<BannerResult> {
  const { onStatus, onProbe } = cbs;
  const res = await fetch("/api/ai/banner", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(160000),
  });

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    // Fallback: a plain JSON error (auth/validation) before the stream starts.
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Banner generation failed");
    if (!data.image_url) throw new Error(data.error || "Banner generation failed");
    return { image_url: data.image_url, image_engine: data.image_engine || "anymodel", image_model: data.image_model };
  }

  return await readSse(res, onStatus, onProbe);
}

async function readSse(
  res: Response,
  onStatus?: (status: BannerStatus) => void,
  onProbe?: (probe: BannerProbe) => void,
): Promise<BannerResult> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Banner stream unavailable");

  const decoder = new TextDecoder();
  let buffer = "";

  const emitProgress = (phase: BannerPhase, model?: string) => {
    if (onStatus && model) onStatus({ phase, model });
    else if (onStatus) onStatus({ phase });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        const msg = JSON.parse(payload);
        if (msg.type === "progress") {
          emitProgress(msg.phase as BannerPhase, msg.model ?? undefined);
        } else if (msg.type === "probe") {
          onProbe?.({ model: msg.model as string, ok: !!msg.ok, status: msg.status as number | undefined });
        } else if (msg.type === "result") {
          if (!msg.image_url) throw new Error(msg.error || "Banner generation failed");
          return {
            image_url: msg.image_url,
            image_engine: msg.image_engine || "anymodel",
            image_model: msg.image_model,
          };
        } else if (msg.type === "error") {
          throw new Error(msg.error || "Banner generation failed");
        }
      }
    }
  } catch (e) {
    if ((e as any)?.name === "AbortError") throw e;
    throw e;
  } finally {
    reader.releaseLock();
  }

  // Stream closed without a result event.
  throw new Error("Banner stream ended without a result");
}

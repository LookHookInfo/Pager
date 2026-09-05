/**
 * Single source of truth for every AI model used in the app. Each accessor
 * reads its .env override at call time (server-side runtime config) and falls
 * back to a default verified against the live AnyModel gateway.
 *
 * If a model needs to change, change it HERE — every caller picks it up.
 */

/** Primary text model for all LLM calls (rewrites, translations, analysis). */
export const ANYMODEL_TEXT_MODEL = () =>
  process.env.ANYMODEL_TEXT_MODEL?.trim() || "ag/gemini-3-flash";

/**
 * Fallback text model — used when the primary returns 429/5xx/timeout.
 * Falls back to gpt-5.4-mini if gemini-3-flash is rate-limited.
 */
export const ANYMODEL_FALLBACK_TEXT_MODEL = () =>
  process.env.ANYMODEL_FALLBACK_TEXT_MODEL?.trim() || "cx/gpt-5.4-mini";

/** Banner / image generation model. */
export const ANYMODEL_IMAGE_MODEL = () =>
  process.env.ANYMODEL_IMAGE_MODEL?.trim() || "flow/nano-banana-lite";

/** Fallback image model when primary returns 429/5xx/timeout. */
export const ANYMODEL_IMAGE_FALLBACK_MODEL = () =>
  process.env.ANYMODEL_IMAGE_FALLBACK_MODEL?.trim() || "ag/gemini-3.1-flash-image";

/**
 * Third-tier image model — used when both the primary and the fallback fail.
 * "Ours" are nano-banana-lite + gemini-3.1-flash-image; flux.2-klein-4b is the
 * paid last resort and must never run before both free models have failed.
 */
export const ANYMODEL_IMAGE_FALLBACK2_MODEL = () =>
  process.env.ANYMODEL_IMAGE_FALLBACK2_MODEL?.trim() || "am/flux.2-klein-4b";

/**
 * Additional image models the banner pipeline may PROBE (health-check) when
 * the primary chain is down. These are the "spare engines" — not used unless a
 * cheap probe shows them alive. Configure via ANYMODEL_IMAGE_EXTRA_MODELS
 * (comma-separated) to override; defaults to a couple of moderately-cheap
 * engines that are periodically available when the main three are rate-limited
 * or down.
 */
export const ANYMODEL_IMAGE_EXTRA_MODELS = (): string[] =>
  (process.env.ANYMODEL_IMAGE_EXTRA_MODELS || "flow/nano-banana,xai/grok-imagine-image")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The full, ordered candidate list the reliable banner engine probes before
 * rendering: primary → fallback → fallback2 → extra spares. Deduplicated.
 */
export const ANYMODEL_IMAGE_CANDIDATES = (): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [
    ANYMODEL_IMAGE_MODEL(),
    ANYMODEL_IMAGE_FALLBACK_MODEL(),
    ANYMODEL_IMAGE_FALLBACK2_MODEL(),
    ...ANYMODEL_IMAGE_EXTRA_MODELS(),
  ]) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
};

/**
 * Vision-capable text fallback — used for calls that include image_url content
 * (e.g. DNA scan). The default text fallback (gpt-5.4-mini) rejects image inputs.
 */
export const ANYMODEL_VISION_FALLBACK_MODEL = () =>
  process.env.ANYMODEL_VISION_FALLBACK_MODEL?.trim() || "cx/gpt-5.4-mini";

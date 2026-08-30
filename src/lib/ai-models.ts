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
  process.env.ANYMODEL_IMAGE_FALLBACK_MODEL?.trim() || "am/flux.2-klein-4b";

/**
 * Third-tier image model — used when both the primary and the fallback fail
 * (429/5xx/timeout). A stable, separate provider (FLUX.2) that stays up even
 * when nano-banana / gemini flash are temporarily unavailable.
 */
export const ANYMODEL_IMAGE_FALLBACK2_MODEL = () =>
  process.env.ANYMODEL_IMAGE_FALLBACK2_MODEL?.trim() || "am/flux.2-klein-4b";

/**
 * Vision-capable text fallback — used for calls that include image_url content
 * (e.g. DNA scan). The default text fallback (gpt-5.4-mini) rejects image inputs.
 */
export const ANYMODEL_VISION_FALLBACK_MODEL = () =>
  process.env.ANYMODEL_VISION_FALLBACK_MODEL?.trim() || "cx/gpt-5.4-mini";

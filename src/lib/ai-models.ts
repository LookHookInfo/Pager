/**
 * Single source of truth for every AI model used in the app. Each accessor
 * reads its .env override at call time (server-side runtime config) and falls
 * back to a default verified against the live AnyModel gateway.
 *
 * If a model needs to change, change it HERE — every caller picks it up.
 */

/** Primary text model for all LLM calls (rewrites, translations, analysis). */
export const ANYMODEL_TEXT_MODEL = () =>
  process.env.ANYMODEL_TEXT_MODEL?.trim() || "gc/gemini-2.5-flash";

/**
 * Fallback text model — same pool as the primary. The app is strictly limited
 * to two models: gemini-2.5-flash for text and nano-banana-lite for banners.
 * No other model may be configured here (gemini-2.5-pro is not used).
 */
export const ANYMODEL_FALLBACK_TEXT_MODEL = () =>
  process.env.ANYMODEL_FALLBACK_TEXT_MODEL?.trim() || "gc/gemini-2.5-flash";

/** Banner / image generation model. */
export const ANYMODEL_IMAGE_MODEL = () =>
  process.env.ANYMODEL_IMAGE_MODEL?.trim() || "flow/nano-banana-lite";

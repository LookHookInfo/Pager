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
 * Falls back to gemini-2.5-flash-lite if the primary text model is
 * rate-limited. gpt-5.4-mini is no longer served by the gateway (404).
 */
export const ANYMODEL_FALLBACK_TEXT_MODEL = () =>
  process.env.ANYMODEL_FALLBACK_TEXT_MODEL?.trim() || "ag/gemini-2.5-flash-lite";

/**
 * Banner / image generation model — the ONLY engine.
 * gpt-image-2 draws every banner; there is no other image model in play.
 */
export const ANYMODEL_IMAGE_MODEL = () =>
  process.env.ANYMODEL_IMAGE_MODEL?.trim() || "cx/gpt-image-2";

/**
 * Probe policy for the banner engine's health-check (see ANYMODEL_PROBE_TIMEOUT_MS
 * in src/lib/image.ts).
 *
 * Cheap models answer a 256x256 probe in ~2-4s, so the 12s probe is good
 * insurance against burning the banner budget on a dead engine. Slow engines
 * cannot be probed at all: their CHEAPEST render already costs more than the
 * whole probe budget, so a probe would reject them every single time and they
 * would never actually be tried. Those are marked `skipProbe` and go straight
 * to the full render — which reports its own real HTTP status to the UI anyway.
 *
 * Measured on the live gateway (2026-10-03): cx/gpt-image-2 needs 26-89s per
 * render even at 1280x720, i.e. always more than the 12s probe timeout.
 *
 * DO NOT DROP the skipProbe flag for cx/gpt-image-2: it is now the ONLY banner
 * engine, so a probe rejection would mean no banner at all.
 */
export const IMAGE_MODEL_PROBE_POLICY: Record<string, { skipProbe?: boolean }> = {
  "cx/gpt-image-2": { skipProbe: true },
};

/** True when this model must not be health-checked before rendering. */
export const imageModelSkipsProbe = (model: string): boolean =>
  IMAGE_MODEL_PROBE_POLICY[model]?.skipProbe === true;

/**
 * ==============================================================================
 * ARCHIVED — retired banner engines (2026-10)
 * ==============================================================================
 * The banner pipeline runs on `cx/gpt-image-2` alone. Every other engine is
 * archived: these accessors stay in place but resolve to EMPTY by default, so
 * `ANYMODEL_IMAGE_CANDIDATES()` yields just the one model in use. To revive a
 * tier, uncomment the line inside the accessor below (or just set the matching
 * env var) — no other change needed.
 *
 * ARCHIVED TIERS (best → worst):
 *   am/flux.2-klein-4b              — 6.6s and reliable, but PAID
 *   ag/gemini-3.1-flash-image       — 503 at the time of archiving
 *   flow/nano-banana-lite           — was the original primary (1K only), 502
 *   flow/nano-banana, nano-banana-pro, flow/nano-banana-pro — timeouts
 *   ag/flux.1-schnell, am/flux.1-dev — ultra-cheap spares
 *
 * OUTAGE NOTE (2026-10-03): at one point 11 of the 13 catalogued image models
 * were down at once (429/503/502/timeout) and only flux.2-klein-4b plus
 * gpt-image-2 answered. That is why there is now exactly ONE engine: a dead
 * probe is cheaper than a dead chain. If gpt-image-2 starts failing, unarchive
 * `am/flux.2-klein-4b` — it is fast enough to fit the route budget with room
 * to spare.
 *
 * NOTE: with a single candidate the probe-first loop in generateReliableBanner
 * renders directly (gpt-image-2 is exempted from probing). When that render
 * fails the route refunds the 10 credits and serves the branded SVG placeholder
 * (client retries once).
 * ==============================================================================
 */

/** ARCHIVED — uncomment to re-enable. */
export const ANYMODEL_IMAGE_FALLBACK_MODEL = () =>
  process.env.ANYMODEL_IMAGE_FALLBACK_MODEL?.trim() || "";

/** ARCHIVED tier — uncomment to re-enable. */
export const ANYMODEL_IMAGE_FALLBACK2_MODEL = () =>
  process.env.ANYMODEL_IMAGE_FALLBACK2_MODEL?.trim() || "";

/**
 * ARCHIVED spare engines — uncomment to re-enable.
 * Default candidates were: flow/nano-banana-lite, flow/nano-banana.
 */
export const ANYMODEL_IMAGE_EXTRA_MODELS = (): string[] =>
  (process.env.ANYMODEL_IMAGE_EXTRA_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The full, ordered candidate list the reliable banner engine probes before
 * rendering: primary → fallback → fallback2 → extra spares. Deduplicated.
 * Single-engine by default, so this currently resolves to ["cx/gpt-image-2"]
 * — the archived tiers are revived purely by setting their env vars.
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
 * (e.g. DNA scan). gemini-2.5-flash-lite is a confirmed vision-capable model;
 * gpt-5.4-mini rejected image inputs and was removed from the gateway (404).
 */
export const ANYMODEL_VISION_FALLBACK_MODEL = () =>
  process.env.ANYMODEL_VISION_FALLBACK_MODEL?.trim() || "ag/gemini-2.5-flash-lite";

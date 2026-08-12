import { extractJson } from "@/lib/utils";

export const ANYMODEL_TEXT_MODEL = () =>
  process.env.ANYMODEL_TEXT_MODEL?.trim() || "ag/gemini-3.5-flash-low";

// Fallback used when the primary model's upstream is down / rate-limited.
// gemini-2.5-flash is vision-capable and stable, so the DNA scan keeps working.
export const ANYMODEL_FALLBACK_TEXT_MODEL = () =>
  process.env.ANYMODEL_FALLBACK_TEXT_MODEL?.trim() || "gc/gemini-2.5-flash";

// Statuses that mean "upstream hiccup", not a config bug — safe to retry on
// the fallback model. 400 is included because some models reject image_url
// input with a 400, which a vision-capable fallback resolves.
const UPSTREAM_RETRYABLE = new Set([400, 408, 425, 429, 500, 502, 503, 504]);

// The AnyModel gateway rate-limits concurrent requests per key (returns
// 429/502 with "Retry in Xs"). Sequential calls succeed, but bursty parallel
// calls fail — distribution used to post base-language content because a
// single failed call silently fell back. Retry with backoff (honoring the
// gateway's suggested delay) is what actually makes per-channel adaptation
// reliable.
const MAX_ATTEMPTS = 3;
const MAX_BACKOFF_SECONDS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(e: any): boolean {
  // TimeoutError, network failures (no HTTP status) and transient HTTP statuses.
  return e?.name === "TimeoutError" || e?.status === undefined || (e?.status && UPSTREAM_RETRYABLE.has(e.status));
}

function backoffSeconds(e: any): number {
  const m = e?.retryAfterText?.match(/Retry in (\d+)s/i);
  if (m) return Math.min(parseInt(m[1], 10), MAX_BACKOFF_SECONDS);
  return 2;
}

export interface AnyModelMessage {
  role: "system" | "user" | "assistant";
  content: unknown;
}

export interface ChatAnyModelOptions {
  messages: AnyModelMessage[];
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
}

/**
 * Single helper for every text-generation call in the app. Talks to the
 * AnyModel OpenAI-compatible gateway (https://anymodel.org/v1) using the
 * shared ANYMODEL_API_KEY and the text model from ANYMODEL_TEXT_MODEL.
 * Returns the raw assistant message content string, or throws on failure.
 * Pass `json: true` to request a strict JSON object response.
 */
export async function chatAnyModel(options: ChatAnyModelOptions): Promise<string> {
  const apiKey = process.env.ANYMODEL_API_KEY?.trim();
  if (!apiKey) throw new Error("ANYMODEL_API_KEY missing");

  const requestedModel = options.model || ANYMODEL_TEXT_MODEL();
  const fallback = ANYMODEL_FALLBACK_TEXT_MODEL();
  // When the caller pins the fallback model explicitly, only it is used
  // (but still retried). Otherwise alternate primary → fallback → primary…
  const models = requestedModel === fallback ? [fallback] : [requestedModel, fallback];

  const body: Record<string, unknown> = {
    model: models[0],
    messages: options.messages,
  };
  if (options.json) body.response_format = { type: "json_object" };
  if (options.temperature != null) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const attempt = async (target: string, timeout: number): Promise<string> => {
    const res = await fetch("https://anymodel.org/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, model: target }),
      signal: AbortSignal.timeout(timeout),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from AnyModel");
      return content as string;
    }

    const err = await res.text().catch(() => "unknown");
    const hint =
      res.status === 401
        ? " — AnyModel key invalid/revoked"
        : res.status === 402
          ? " — AnyModel balance empty (top up in cabinet)"
          : res.status === 404 || res.status === 406
            ? " — text model not found/supported (check ANYMODEL_TEXT_MODEL in .env)"
            : "";
    console.error(`AnyModel chat failed: ${res.status} — ${err.slice(0, 300)}${hint}`);
    const e = new Error(`AnyModel AI error (${res.status})`) as Error & { status?: number; retryAfterText?: string };
    e.status = res.status;
    e.retryAfterText = err;
    throw e;
  };

  // The first attempt (the caller-chosen model) gets the full budget. Retries
  // are capped at 15s each so a retry chain still fits the route's maxDuration.
  const primaryTimeout = options.timeoutMs || 30000;

  let lastError: any = null;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const target = models[i % models.length];
    const timeout = i === 0 ? primaryTimeout : Math.min(primaryTimeout, 15000);

    try {
      return await attempt(target, timeout);
    } catch (e: any) {
      lastError = e;

      // Auth/config errors (401/402/404/406) are NOT retried — a different
      // model or a short wait won't fix a bad key or empty balance.
      if (!isRetryable(e)) throw e;

      // Vision-rejecting 400 on the primary is fixed by the fallback model —
      // switch to it immediately instead of sleeping first.
      if (e.status === 400 && i === 0 && models.length > 1) continue;

      if (i < MAX_ATTEMPTS - 1) {
        const wait = backoffSeconds(e);
        console.warn(`AnyModel attempt ${i + 1} failed (${target}), retrying in ~${wait}s…`);
        await sleep(wait * 1000);
      }
    }
  }
  throw lastError;
}

/**
 * Same as chatAnyModel but expects a strict JSON object in the response and
 * returns it parsed. Throws when the model returns non-JSON text.
 */
export async function chatAnyModelJson(options: Omit<ChatAnyModelOptions, "json">): Promise<any> {
  const content = await chatAnyModel({ ...options, json: true });
  return extractJson(content);
}

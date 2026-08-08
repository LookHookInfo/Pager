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

  const model = options.model || ANYMODEL_TEXT_MODEL();
  const fallback = ANYMODEL_FALLBACK_TEXT_MODEL();

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };
  if (options.json) body.response_format = { type: "json_object" };
  if (options.temperature != null) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const attempt = async (target: string): Promise<string> => {
    // The fallback attempt gets a shorter budget (capped at 15s) so two
    // sequential calls fit the route's maxDuration (60s on Vercel Hobby).
    const attemptTimeout = target === fallback ? Math.min(options.timeoutMs || 30000, 15000) : options.timeoutMs || 30000;
    const res = await fetch("https://anymodel.org/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, model: target }),
      signal: AbortSignal.timeout(attemptTimeout),
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
    const e = new Error(`AnyModel AI error (${res.status})`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  };

  try {
    return await attempt(model);
  } catch (e: any) {
    // Transient upstream failures (429 / 5xx / timeout / vision-rejecting 400)
    // → retry once with the fallback model. Auth/config errors (401/402/404/406)
    // are NOT retried — a different model won't fix a bad key or empty balance.
    const retryable = e.name === "TimeoutError" || (e.status && UPSTREAM_RETRYABLE.has(e.status));
    if (!retryable || model === fallback) throw e;

    console.warn(`AnyModel primary model ${model} failed, falling back to ${fallback}`);
    try {
      return await attempt(fallback);
    } catch (f: any) {
      console.error(`AnyModel fallback ${fallback} also failed: ${f.message}`);
      throw f;
    }
  }
}

/**
 * Same as chatAnyModel but expects a strict JSON object in the response and
 * returns it parsed. Throws when the model returns non-JSON text.
 */
export async function chatAnyModelJson(options: Omit<ChatAnyModelOptions, "json">): Promise<any> {
  const content = await chatAnyModel({ ...options, json: true });
  return extractJson(content);
}

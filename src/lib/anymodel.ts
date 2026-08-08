import { extractJson } from "@/lib/utils";

export const ANYMODEL_TEXT_MODEL = () =>
  process.env.ANYMODEL_TEXT_MODEL?.trim() || "gc/gemini-3.1-flash-lite-preview";

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

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };
  if (options.json) body.response_format = { type: "json_object" };
  if (options.temperature != null) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const res = await fetch("https://anymodel.org/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 30000),
  });

  if (!res.ok) {
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
    throw new Error(`AnyModel AI error (${res.status})`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from AnyModel");

  return content as string;
}

/**
 * Same as chatAnyModel but expects a strict JSON object in the response and
 * returns it parsed. Throws when the model returns non-JSON text.
 */
export async function chatAnyModelJson(options: Omit<ChatAnyModelOptions, "json">): Promise<any> {
  const content = await chatAnyModel({ ...options, json: true });
  return extractJson(content);
}

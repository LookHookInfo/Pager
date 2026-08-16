/**
 * Shared utility functions used across API routes and pages.
 */

/** Strip HTML tags from a string, returning plain text. Safe for null/undefined input. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "");
}

/** Convert markdown bold/italic to HTML tags */
export function finalFormat(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .trim();
}

/** Sanitize a string for safe JSON embedding (strip control characters) */
function sanitizeJsonString(raw: string): string {
  return raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

/** Retry JSON.parse with progressive cleaning strategies */
function tryParse(raw: string): any {
  const strategies = [
    (s: string) => JSON.parse(s),
    (s: string) => { const m = s.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("no json object"); },
    (s: string) => JSON.parse(sanitizeJsonString(s)),
    (s: string) => { const m = s.match(/\{[\s\S]*\}/); if (m) return JSON.parse(sanitizeJsonString(m[0])); throw new Error("no json object"); },
  ];
  for (const fn of strategies) {
    try { return fn(raw); } catch { continue; }
  }
  throw new Error("parse failed");
}

/** Extract the first JSON object from an AI response string */
export function extractJson(text: string): any {
  if (!text) throw new Error("Empty AI response");
  try {
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/^[\s\S]*?(\{)/, "$1")        // strip everything before first {
      .replace(/(\})[\s\S]*$/, "$1")          // strip everything after last }
      .trim();

    if (!cleaned.startsWith("{")) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found");
      return tryParse(match[0]);
    }
    return tryParse(cleaned);
  } catch (e) {
    const preview = text.replace(/[\r\n]/g, " ").slice(0, 150);
    console.error("❌ [Utils] JSON Parse Error:", (e as Error).message, "| Preview:", preview);
    throw new Error("AI returned invalid JSON format. Please try again.");
  }
}

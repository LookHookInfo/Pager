/**
 * Shared utility functions used across API routes and pages.
 */

/** Strip HTML tags from a string, returning plain text. Safe for null/undefined input. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "");
}

/** Normalize IPFS gateway references */
export function normalizeReference(url: string): string {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://gateway.ipn.io/ipfs/");
  }
  return url;
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

/** Extract the first JSON object from an AI response string */
export function extractJson(text: string): any {
  if (!text) throw new Error("Empty AI response");
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("❌ [Utils] JSON Parse Error. Content:", text.slice(0, 200));
    throw new Error("AI returned invalid JSON format. Please try again.");
  }
}

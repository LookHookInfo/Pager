import { NextResponse } from "next/server";
import { extractJson } from "@/lib/utils";

export const maxDuration = 30;

const DNA_PROMPT = `Analyze this mascot image and return JSON with exactly three fields:
"personality": 2-3 sentences describing the character's temperament, values, worldview, and analytical style. Who they are at their core.
"voice": 2-3 sentences describing how the character SPEAKS — unique vocabulary, sentence rhythm, catchphrases, slang, rhetorical style. Must be DISTINCT from personality. Example: "Short punchy sentences. Military jargon. Calls everyone 'soldier'. Ends every take with 'over and out'."
"visual": Technical visual description for AI image generation. Cover: proportions and silhouette, physical traits (species, colors, facial features), materials and textures, and a rich cinematic environment description for banners.`;

async function analyzeWithOpenRouter(imageUrl: string, apiKey: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pager.sh",
      "X-Title": "Pager Protocol",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: DNA_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ [DNA Scan] OpenRouter error:", res.status, err.slice(0, 300));
    throw new Error("OpenRouter AI error");
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("Empty response from OpenRouter");

  return extractJson(content);
}

export async function POST(req: Request) {
  try {
    const { imageUrl, userAddress } = await req.json();
    if (!imageUrl || !userAddress) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterKey) {
      return NextResponse.json({ error: "No AI provider configured. Set OPENROUTER_API_KEY" }, { status: 403 });
    }

    try {
      const result = await analyzeWithOpenRouter(imageUrl, openRouterKey);
      return NextResponse.json({
        personality: result.personality || "Mysterious entity.",
        voice: result.voice || result.personality || "Cryptic speaker.",
        visual: result.visual || "Default character look.",
      });
    } catch (e) {
      console.error("❌ [DNA Scan] OpenRouter failed:", (e as Error).message);
      return NextResponse.json({ error: "All AI providers failed" }, { status: 502 });
    }
  } catch (error: any) {
    console.error("❌ [DNA Scan] Critical:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

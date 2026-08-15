import { NextResponse } from "next/server";
import { chatAnyModel } from "@/lib/anymodel";
import { extractJson } from "@/lib/utils";

export const maxDuration = 60;

const DNA_PROMPT = `Analyze this mascot image and return JSON with exactly three fields:
"personality": 2-3 sentences describing the character's temperament, values, worldview, and analytical style. Who they are at their core.
"voice": 2-3 sentences describing how the character SPEAKS — unique vocabulary, sentence rhythm, catchphrases, slang, rhetorical style. Must be DISTINCT from personality. Example: "Short punchy sentences. Military jargon. Calls everyone 'soldier'. Ends every take with 'over and out'."
"visual": Technical visual description for AI image generation. Cover: proportions and silhouette, physical traits (species, colors, facial features), materials and textures, and a rich cinematic environment description for banners.`;

export async function POST(req: Request) {
  try {
    const { imageUrl, userAddress } = await req.json();
    if (!imageUrl || !userAddress) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    try {
      const result = extractJson(await chatAnyModel({
        messages: [{
          role: "user",
          content: [
            { type: "text", text: DNA_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        json: true,
        maxTokens: 2000,
        timeoutMs: 40000,
      }));
      return NextResponse.json({
        personality: result.personality || "Mysterious entity.",
        voice: result.voice || result.personality || "Cryptic speaker.",
        visual: result.visual || "Default character look.",
      });
    } catch (e) {
      console.error("❌ [DNA Scan] AnyModel failed:", (e as Error).message);
      return NextResponse.json({ error: "All AI providers failed" }, { status: 502 });
    }
  } catch (error: any) {
    console.error("❌ [DNA Scan] Critical:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

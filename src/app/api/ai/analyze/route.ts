import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const maxDuration = 30;

const DNA_PROMPT = `Analyze this mascot image and return JSON with exactly three fields:
"personality": 2-3 sentences describing the character's temperament, values, worldview, and analytical style. Who they are at their core.
"voice": 2-3 sentences describing how the character SPEAKS — unique vocabulary, sentence rhythm, catchphrases, slang, rhetorical style. Must be DISTINCT from personality. Example: "Short punchy sentences. Military jargon. Calls everyone 'soldier'. Ends every take with 'over and out'."
"visual": Technical visual description for AI image generation. Cover: proportions and silhouette, physical traits (species, colors, facial features), materials and textures, and a rich cinematic environment description for banners.`;

function extractJson(text: string) {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  return JSON.parse(cleaned);
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("Failed to fetch image");
  const mime = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mime };
}

async function analyzeWithGoogleGemini(imageUrl: string, apiKey: string) {
  const image = await fetchImageAsBase64(imageUrl);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: DNA_PROMPT },
            { inline_data: { mime_type: image.mime, data: image.data } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ [DNA Scan] Google API error:", res.status, err.slice(0, 300));
    throw new Error("Google AI API error");
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Empty response from Google AI");

  return extractJson(text);
}

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

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_api_key")
      .eq("address", userAddress.toLowerCase())
      .maybeSingle();

    const googleKey = process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY || profile?.ai_api_key;

    let result: any;

    // Priority 1: Direct Google Gemini API (free tier)
    if (googleKey) {
      try {
        result = await analyzeWithGoogleGemini(imageUrl, googleKey);
      } catch (e) {
        console.warn("⚠️ [DNA Scan] Google API failed, falling back to OpenRouter:", (e as Error).message);
      }
    }

    // Priority 2: OpenRouter fallback
    if (!result && openRouterKey) {
      try {
        result = await analyzeWithOpenRouter(imageUrl, openRouterKey);
      } catch (e) {
        console.error("❌ [DNA Scan] OpenRouter also failed:", (e as Error).message);
        return NextResponse.json({ error: "All AI providers failed" }, { status: 502 });
      }
    }

    if (!result) {
      return NextResponse.json({ error: "No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY" }, { status: 403 });
    }

    return NextResponse.json({
      personality: result.personality || "Mysterious entity.",
      voice: result.voice || result.personality || "Cryptic speaker.",
      visual: result.visual || "Default character look.",
    });
  } catch (error: any) {
    console.error("❌ [DNA Scan] Critical:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

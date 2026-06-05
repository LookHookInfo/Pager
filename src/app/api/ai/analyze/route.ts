import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const maxDuration = 30;

function extractJson(text: string) {
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("❌ [DNA Scan] JSON Parse Error. Content:", text.slice(0, 200));
    return null;
  }
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

    // Use system key primarily for DNA analysis to ensure consistency
    const aiApiKey = process.env.OPENROUTER_API_KEY || profile?.ai_api_key;

    if (!aiApiKey) {
      return NextResponse.json({ error: "AI Engine Offline" }, { status: 403 });
    }

    // STRICT MODEL SELECTION:
    // Gemini 2.5 Flash is optimal for all text and vision tasks.
    const modelId = "google/gemini-2.5-flash";

    const prompt = `
      ACT AS A WEB3 GENETICIST AND VISUAL ANALYST. 
      Analyze this character image and extract their unique PAGER PROTOCOL DNA.
      
      OUTPUT FORMAT: STRICT JSON
      { 
        "personality": "2-3 sentences about their character, attitude, speech style, and worldview. How do they talk about crypto?", 
        "visual": "Precise description of clothing, accessories, body type, art style, and core colors. Be very specific about unique traits that define this mascot." 
      }
      
      Ensure the description is optimized for high-fidelity image generation (Stable Diffusion / FLUX / Gemini).
      Return ONLY JSON.
    `;

    console.log("📡 [DNA Scan] Analyzing image:", imageUrl);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + aiApiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pager.sh",
        "X-Title": "Pager Protocol",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: "Analysis Failed" } }));
        console.error("❌ [DNA Scan] OpenRouter Error:", err);
        throw new Error(err.error?.message || "AI Analysis failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const result = extractJson(content);

    if (!result) {
        throw new Error("Failed to parse AI DNA response");
    }

    console.log("✅ [DNA Scan] Success for:", userAddress);

    return NextResponse.json({ 
        personality: result.personality || "Mysterious entity.", 
        visual: result.visual || "Default character look." 
    });
  } catch (error: any) {
    console.error("❌ [DNA Scan] Critical Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

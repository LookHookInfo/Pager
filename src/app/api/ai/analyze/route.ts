import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { imageUrl, userAddress } = await req.json();

    if (!imageUrl || !userAddress) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_api_key, ai_image_model")
      .eq("address", userAddress.toLowerCase())
      .maybeSingle();

    if (!profile?.ai_api_key) {
      return NextResponse.json({ error: "AI API Key missing" }, { status: 403 });
    }

    // --- SMART MODEL SELECTION ---
    // In 2026, we prefer Gemini 3.1 Pro for the most accurate DNA extraction if available.
    let modelId = "google/gemini-2.0-flash-001";
    const selectedModel = profile.ai_image_model || "";
    
    if (selectedModel.includes("gemini-3.1")) {
        modelId = "google/gemini-3.1-pro"; // Highest tier
    } else if (selectedModel.includes("gemini-2.5")) {
        modelId = "google/gemini-2.5-flash";
    }

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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + profile.ai_api_key,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pager.sh",
        "X-Title": "Pager Protocol",
      },
      body: JSON.stringify({
        model: modelId,
        response_format: { type: "json_object" },
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
        const err = await response.json().catch(() => ({ error: { message: "OpenRouter Analysis Failed" } }));
        throw new Error(err.error?.message || "AI Analysis failed");
    }

    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    return NextResponse.json({ 
        personality: result.personality || "Mysterious entity.", 
        visual: result.visual || "Default character look." 
    });
  } catch (error: any) {
    console.error("? [DNA Forge] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


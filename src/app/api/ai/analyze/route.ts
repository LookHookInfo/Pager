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

    const aiApiKey = process.env.OPENROUTER_API_KEY || profile?.ai_api_key;

    if (!aiApiKey) {
      return NextResponse.json({ error: "AI Engine Offline" }, { status: 403 });
    }

    // CURRENT WORKING MODEL:
    const modelId = "google/gemma-4-31b-it";

    const prompt = `
      ACT AS A PREEMINENT VISUAL ARCHITECT AND CHARACTER DESIGNER. 
      Analyze the provided mascot image to extract its "GENETIC CODE" for 100% accurate replication and cinematic world-building.

      ANALYSIS PROTOCOL:
      1. PROPORTIONS & SCALE: Describe the silhouette. What is the head-to-body ratio? Are accessories oversized? Note the exact scale of items (e.g., "oversized mechanical gauntlets", "compact athletic build", "large expressive head occupies 1/3 of total height").
      2. PHYSICAL DNA: Identify species, exact eye glow color, and specific facial traits.
      3. TEXTURE & MATERIAL: Identify every material (e.g., "brushed scratched metal", "soft velvet fabric", "translucent neon-emitting plastic").
      4. ENVIRONMENT DNA (FOR BANNERS): Based on the character's vibe, describe a RICH, HIGH-DENSITY background. Include lighting (e.g., "volumetric god-rays", "harsh cinematic rim lighting"), particles (e.g., "floating digital embers", "drifting cherry blossoms"), and architectural elements that make the scene feel ALIVE and atmospheric.
      5. STYLE SIGNATURE: Define the art style (e.g., "High-fidelity 3D render", "Cyberpunk oil painting").

      OUTPUT FORMAT: STRICT JSON
      { 
        "personality": "2 sentences about their temperament.", 
        "visual": "A surgical-grade technical summary. Start with PROPORTIONS and SILHOUETTE, then detail the MASCOT, then describe a RICH CINEMATIC ENVIRONMENT for banners. Ensure descriptions are high-density and packed with atmospheric details to avoid empty backgrounds." 
      }
      
      Return ONLY JSON.
    `;

    console.log("📡 [DNA Scan] Analyzing image with Flash Lite:", imageUrl);

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

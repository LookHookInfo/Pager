import { NextResponse } from "next/server";
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, getCharacterVisualPrompt } from "@/lib/character";
import { getSupabaseServer } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function finalFormat(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .trim();
}

function extractJson(text: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    console.error("❌ [AI Process] JSON Parse Error. Raw text head:", text.slice(0, 300));
    throw new Error("AI returned invalid JSON. Please try again.");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      mood = "neutral", 
      character = "ghoul", 
      userApiKey, 
      content: providedContent, 
      title: providedTitle, 
      imageModel: providedImageModel,
      atmosphere = "Rick and Morty",
      customDna = null,
      onlyBanner = false,
      bannerDescription = "",
      userAddress = ""
    } = body;

    if (!userApiKey) return NextResponse.json({ error: "API Key required" }, { status: 403 });

    // Fetch user profile for CTA links
    let userProfile = null;
    if (userAddress) {
      try {
        const supabaseServer = getSupabaseServer();
        const { data } = await supabaseServer
          .from('profiles')
          .select('*')
          .eq('address', userAddress.toLowerCase())
          .maybeSingle();
        userProfile = data;
      } catch (e) {
        console.warn("⚠️ [AI Process] Profile fetch failed, using defaults.");
      }
    }

    // --- 1. CONFIGURATION ---
    const textModel = "google/gemini-2.0-flash-001";
    const imageModel = providedImageModel || "google/gemini-2.0-flash-001";

    if (onlyBanner) {
      // MODE: REGENERATE ONLY BANNER
      const visualPrompt = getCharacterVisualPrompt(
        bannerDescription || providedTitle || "Action scene", 
        mood, 
        character as any, 
        providedTitle, 
        atmosphere, 
        customDna || undefined
      );
      let bannerUrl = "";
      try {
        console.log(`📡 [AI Process] Regenerating banner...`);
        const payload: any = {
          model: imageModel,
          messages: [{ role: "user", content: [{ type: "text", text: visualPrompt }] }],
          image_config: { aspect_ratio: "16:9" }
        };

        const imgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Authorization": "Bearer " + userApiKey, 
            "Content-Type": "application/json", 
            "HTTP-Referer": "https://pager.lookhook.info" 
          },
          body: JSON.stringify(payload)
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          bannerUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
        }
      } catch (e) {}

      if (!bannerUrl) return NextResponse.json({ error: "Regeneration Failed" }, { status: 500 });
      return NextResponse.json({ image_url: bannerUrl });
    }

    if (!providedContent) return NextResponse.json({ error: "No content provided" }, { status: 400 });
    
    const systemPrompt = getCharacterSystemPrompt(mood, character as any, customDna || undefined);

    let charName = character === "nana" ? "Nana Banana" : "Cyber-Ghoul";
    if (character === "custom" && customDna) charName = (customDna as any).name;

    const charVoice = character === "nana" ? "optimistic, fruity, and slightly chaotic" : "cynical, witty, and tech-savvy ghoul";

    const userPrompt = `
      ACT AS A PROFESSIONAL SENIOR WEB3 EDITOR. 
      Task: Rewrite the provided article in ${charName} style (${charVoice}).

      CRITICAL RULES FOR CONTENT RICHNESS:
      1. LENGTH: Aim for 1500-2000 characters. Do NOT be brief.
      2. STRUCTURE: Use 5-8 detailed paragraphs. Each paragraph should be meaty.
      3. HTML ONLY: Use ONLY <p style="margin-bottom: 24px;"> and <strong> for highlights.
      4. CONTENT DEPTH: Don't just summarize. Add market context, technical implications for the Base network/Ethereum, and character-driven commentary.
      5. TITLE: Explosive, clickbaity, under 60 chars.
      6. BTC ANALYSIS: 2-3 insightful sentences from ${charName}'s perspective.
      7. BANNER: Describe a complex 16:9 cinematic scene with ${charName} and friends illustrating the news.
      8. NO LINKS: Delete ALL external URLs and calls to action from the source.

      ARTICLE TO PROCESS: ${providedContent.slice(0, 8000)}

      RESPONSE FORMAT: JSON ONLY.
      { "title": "...", "body": "...", "analysis": "...", "banner": "..." }
    `;

    // --- 2. TEXT GENERATION ---
    console.log(`📡 [AI Process] Calling OpenRouter for RICH content (${textModel})...`);
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": "Bearer " + userApiKey, 
        "Content-Type": "application/json", 
        "HTTP-Referer": "https://pager.lookhook.info" 
      },
      body: JSON.stringify({ 
        model: textModel, 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ], 
        response_format: { type: "json_object" },
        max_tokens: 2500,
        temperature: 0.8
      })
    });

    if (!aiRes.ok) {
      const errData = await aiRes.json().catch(() => ({}));
      const msg = errData.error?.message || "OpenRouter Connection Failed";
      console.error("❌ [AI Process] OpenRouter Error:", msg);
      return NextResponse.json({ error: "AI Generation Failed", details: msg }, { status: aiRes.status });
    }

    const aiData = await aiRes.json();
    const contentText = aiData.choices[0]?.message?.content;
    if (!contentText) throw new Error("AI returned empty response");

    const result = extractJson(contentText);

    // --- 3. FORMATTING ---
    const finalTitle = (result.title || "New Intel").replace(/["']/g, "").trim();
    let finalBody = finalFormat(result.body || "");
    if (!finalBody.includes("<p")) {
      finalBody = finalBody.split("\n\n").map((p: string) => `<p style="margin-bottom: 24px;">${p}</p>`).join("");
    }

    const fullHtml = finalBody + getBtcAnalysisBlock(
      finalFormat(result.analysis || "Market sentiment is shifting."), 
      {
        characterType: character as any, 
        customDna: customDna || undefined, 
        profile: userProfile
      }
    ) + getMiningSponsorBlock();

    // --- 4. BANNER GENERATION ---
    const visualPrompt = getCharacterVisualPrompt(
      result.banner || finalTitle, 
      mood, 
      character as any, 
      finalTitle, 
      atmosphere, 
      customDna || undefined
    ) + " (16:9 widescreen)";
    
    let bannerUrl = "";
    
    try {
      const imgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Authorization": "Bearer " + userApiKey, 
          "Content-Type": "application/json", 
          "HTTP-Referer": "https://pager.lookhook.info" 
        },
        body: JSON.stringify({
          model: imageModel,
          messages: [{ role: "user", content: [{ type: "text", text: visualPrompt }] }],
          image_config: { aspect_ratio: "16:9" }
        })
      });

      if (imgRes.ok) {
        const imgData = await imgRes.json();
        bannerUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
      }
    } catch (e) {}

    return NextResponse.json({ 
      title: finalTitle, 
      content: fullHtml, 
      image_url: bannerUrl,
      banner_description: result.banner || finalTitle
    });

  } catch (error: any) {
    console.error("❌ [AI Process] Critical Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

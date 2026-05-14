import { NextResponse } from "next/server";
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, getCharacterVisualPrompt } from "@/lib/character";

export const maxDuration = 60; // Increase to 60s for slow image models
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
    // Attempt to find JSON block if AI wrapped it in markdown or text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    console.error("❌ [AI Process] JSON Parse Error. Raw text:", text.slice(0, 200) + "...");
    throw new Error("AI returned invalid data format. Please try again.");
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
      bannerDescription = ""
    } = body;

    if (!userApiKey) return NextResponse.json({ error: "API Key required" }, { status: 403 });

    // --- 1. CONFIGURATION ---
    const textModel = "google/gemini-2.0-flash-001";
    const imageModel = providedImageModel || "google/gemini-2.0-flash-001";

    if (onlyBanner) {
      // MODE: REGENERATE ONLY BANNER
      const visualPrompt = getCharacterVisualPrompt(bannerDescription || providedTitle || "Action scene", mood, character as any, providedTitle, atmosphere, customDna);
      let bannerUrl = "";
      try {
        console.log(`📡 [AI Process] Regenerating banner (${imageModel})...`);
        const imgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Authorization": "Bearer " + userApiKey, 
            "Content-Type": "application/json", 
            "HTTP-Referer": "https://pager.lookhook.info" 
          },
          body: JSON.stringify({
            model: imageModel,
            modalities: ["image", "text"],
            messages: [{ role: "user", content: [{ type: "text", text: visualPrompt }] }]
          })
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          bannerUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
        }
      } catch (e) {}

      if (!bannerUrl) return NextResponse.json({ error: "Regeneration Failed" }, { status: 500 });
      return NextResponse.json({ image_url: bannerUrl });
    }

    if (!providedContent) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }
    const systemPrompt = getCharacterSystemPrompt(mood, character as any, customDna);

    let charName = character === "nana" ? "Nana Banana" : "Cyber-Ghoul";
    if (character === "custom" && customDna) charName = customDna.name;

    const userPrompt = `
      ACT AS A PROFESSIONAL WEB3 EDITOR. 
      Rewrite the following article in ${charName} style.

      RULES:
      1. TITLE: Explosive, under 50 chars.
      2. CONTENT: HTML only. Use <p style="margin-bottom: 24px;"> and <strong>. 3-4 paragraphs.
      3. BTC ANALYSIS: 2 sentences max.
      4. BANNER DESCRIPTION: Describe a cinematic scene with ${charName} in ${atmosphere} style illustrating the article topic. Include his robotic memecoin friends.
         IMPORTANT: Focus on visual composition for a horizontal 21:9 ratio.

      JSON FORMAT: { "title": "...", "body": "...", "analysis": "...", "banner": "..." }

      ARTICLE: ${providedContent.slice(0, 10000)}
    `;

    // --- 2. TEXT GENERATION ---
    console.log(`📡 [AI Process] Calling OpenRouter for text (${textModel})...`);
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
        response_format: { type: "json_object" } 
      })
    });

    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}));
      return NextResponse.json({ error: "AI Text Generation Failed", details: err.error?.message || "Check your API key" }, { status: aiRes.status });
    }

    const aiData = await aiRes.json();
    const result = extractJson(aiData.choices[0].message.content);

    // --- 3. FORMATTING ---
    const finalTitle = (result.title || providedTitle || "New Intel").replace(/["']/g, "").trim();
    let finalBody = finalFormat(result.body || "");
    if (!finalBody.includes("<p")) {
      finalBody = finalBody.split("\n\n").map((p: string) => `<p style="margin-bottom: 24px;">${p}</p>`).join("");
    }

    const fullHtml = finalBody + getBtcAnalysisBlock(finalFormat(result.analysis || "Market sentiment is shifting."), character as any, customDna) + getMiningSponsorBlock();
    
    // --- 4. BANNER GENERATION (WITH GRACEFUL DEGRADATION) ---
    const visualPrompt = getCharacterVisualPrompt(result.banner || finalTitle, mood, character as any, finalTitle, atmosphere, customDna);
    let bannerUrl = "";
    let bannerError = null;

    try {
      console.log(`📡 [AI Process] Generating banner (${imageModel})...`);
      const imgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Authorization": "Bearer " + userApiKey, 
          "Content-Type": "application/json", 
          "HTTP-Referer": "https://pager.lookhook.info" 
        },
        body: JSON.stringify({
          model: imageModel,
          modalities: ["image", "text"],
          messages: [{ role: "user", content: [{ type: "text", text: visualPrompt }] }]
        })
      });

      if (imgRes.ok) {
        const imgData = await imgRes.json();
        bannerUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
        if (!bannerUrl) {
            console.warn("⚠️ [AI Process] Image model returned no URL. Raw:", JSON.stringify(imgData).slice(0, 200));
            bannerError = "Image model returned no URL. Try Gemini 3.1 Pro.";
        }
      } else {
        const imgErr = await imgRes.json().catch(() => ({}));
        console.error("⚠️ [AI Process] Banner model error:", imgRes.status, imgErr);
        bannerError = imgErr.error?.message || "Image model failure.";
      }
    } catch (e: any) {
      console.error("⚠️ [AI Process] Image generation network error:", e.message);
      bannerError = "Network error during image generation.";
    }

    // --- 5. RESPONSE ---
    // If we have text but no banner, we still return the text so the user doesn't lose their work.
    return NextResponse.json({ 
      title: finalTitle, 
      content: fullHtml, 
      image_url: bannerUrl,
      banner_description: result.banner || finalTitle,
      warning: bannerError // Client can handle this warning
    });

  } catch (error: any) {
    console.error("❌ [AI Process] Critical Internal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
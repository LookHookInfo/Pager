import { NextResponse } from "next/server";
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, getCharacterVisualPrompt } from "@/lib/character";

export const maxDuration = 30; 
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
    console.error("❌ [AI Process] JSON Parse Error:", e, "Raw text:", text);
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
      customDna = null
    } = body;

    if (!userApiKey) return NextResponse.json({ error: "API Key required" }, { status: 403 });
    if (!providedContent) {
      console.error("❌ [AI Process] Missing content in request body");
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const textModel = "google/gemini-2.0-flash-001";
    const imageModel = providedImageModel || "google/gemini-2.0-flash-001";
    const systemPrompt = getCharacterSystemPrompt(mood, character as any, customDna);

    let charName = character === "nana" ? "Nana Banana" : "Cyber-Ghoul";
    if (character === "custom" && customDna) charName = customDna.name;

    const userPrompt = `
      ACT AS A PROFESSIONAL WEB3 EDITOR. 
      Rewrite the following article in ${charName} style.

      RULES:
      1. TITLE: Explosive, under 50 chars.
      2. CONTENT: HTML only. Use <p style="margin-bottom: 24px;"> and <strong>. 3-4 paragraphs.
      3. BTC ANALYSIS: 2 sentences.
      4. BANNER DESCRIPTION: Describe a cinematic scene with ${charName} in ${atmosphere} style illustrating the article topic. Include his robotic memecoin friends.
         IMPORTANT: The scene must be optimized for a wide CINEMATIC horizontal aspect ratio (16:9 or 21:9).

      JSON FORMAT: { "title": "...", "body": "...", "analysis": "...", "banner": "..." }

      ARTICLE: ${providedContent.slice(0, 10000)}
    `;

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
      console.error("❌ [AI Process] OpenRouter Error:", aiRes.status, err);
      return NextResponse.json({ error: "AI Failed", details: err.error?.message || "Check your API key" }, { status: aiRes.status });
    }

    const aiData = await aiRes.json();
    const result = extractJson(aiData.choices[0].message.content);

    const finalTitle = (result.title || providedTitle || "New Intel").replace(/["']/g, "").trim();
    let finalBody = finalFormat(result.body || "");
    if (!finalBody.includes("<p")) {
      finalBody = finalBody.split("\n\n").map((p: string) => `<p style="margin-bottom: 24px;">${p}</p>`).join("");
    }

    const fullHtml = finalBody + getBtcAnalysisBlock(finalFormat(result.analysis || "Market sentiment is shifting."), character as any, customDna) + getMiningSponsorBlock();
    const visualPrompt = getCharacterVisualPrompt(result.banner || finalTitle, mood, character as any, finalTitle, atmosphere, customDna);

    let bannerUrl = "";
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
        console.log("✅ [AI Process] Banner generated!");
      } else {
        const imgErr = await imgRes.json().catch(() => ({}));
        console.warn("⚠️ [AI Process] Banner generation failed:", imgRes.status, imgErr);
      }
    } catch (e) {
      console.error("⚠️ [AI Process] Image generation error:", e);
    }

    if (!bannerUrl) {
        return NextResponse.json({ error: "Banner Generation Failed", details: "AI failed to create a cinematic banner. Try again or change model." }, { status: 500 });
    }

    return NextResponse.json({ 
      title: finalTitle, 
      content: fullHtml, 
      image_url: bannerUrl 
    });

  } catch (error: any) {
    console.error("❌ [AI Process] Internal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
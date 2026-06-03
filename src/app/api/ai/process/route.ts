import { NextResponse } from "next/server";
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, getCharacterVisualPrompt, CustomDna } from "@/lib/character";
import { resolveNftDna } from "@/lib/character/nft";
import { getSupabaseServer } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function normalizeReference(url: string): string {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://gateway.ipn.io/ipfs/");
  }
  return url;
}

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
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("? [AI Process] JSON Parse Error. Content:", text.slice(0, 200));
    throw new Error("AI returned invalid JSON format. Please try again.");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { 
      mood = "neutral", 
      content: providedContent, 
      title: providedTitle, 
      imageModel: providedImageModel,
      atmosphere: providedAtmosphere,
      nftTokenId: requestedNftId,
      onlyBanner = false,
      bannerDescription = "",
      userAddress = ""
    } = body;

    if (!userAddress) return NextResponse.json({ error: "User address required" }, { status: 400 });

    const supabaseServer = getSupabaseServer();
    const { data: userProfile } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("address", userAddress.toLowerCase())
      .maybeSingle();

    if (!userProfile?.ai_api_key) {
      return NextResponse.json({ error: "AI API Key missing" }, { status: 403 });
    }

    const userApiKey = userProfile.ai_api_key;
    const nftTokenId = requestedNftId || userProfile?.ai_nft_token_id;

    if (!nftTokenId) {
      return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });
    }

    const nftMetadata = await resolveNftDna(nftTokenId);
    if (!nftMetadata) {
      return NextResponse.json({ error: "Failed to resolve NFT DNA" }, { status: 404 });
    }

    const activeDna: CustomDna = {
      name: nftMetadata.name,
      description: nftMetadata.pager_dna.personality || nftMetadata.pager_dna.physical_description,
      reference: normalizeReference(nftMetadata.image)
    };

    // --- UNIFIED MODEL LOGIC ---
    const selectedModel = providedImageModel || userProfile?.ai_image_model || "google/gemini-3.1-flash-image-preview";
    const finalAtmosphere = providedAtmosphere || userProfile?.ai_atmosphere || "Rick and Morty";
    
    // 1. Determine Text Model (The Brain)
    let textModel = "google/gemini-2.0-flash-001";
    if (selectedModel.includes("gemini-3.1")) {
        textModel = "google/gemini-3.1-pro"; 
    } else if (selectedModel.includes("gemini-2.5")) {
        textModel = "google/gemini-2.5-flash"; 
    }

    // 2. Determine Image Model (The Artist)
    // Most Gemini models (Flash/Pro) don't generate images via standard chat API.
    // If the selected model is not an explicit image model, we default to FLUX or Gemini Visual.
    let imageModel = selectedModel;
    if (selectedModel.includes("gemini-2.5") || selectedModel === "google/gemini-3.1-pro") {
        imageModel = "google/gemini-3.1-flash-image-preview"; // Default to visual-capable model
    }

    if (onlyBanner) {
      const visualPrompt = getCharacterVisualPrompt(bannerDescription || providedTitle, mood, "nft", providedTitle, finalAtmosphere, activeDna);
      let bannerUrl = "";
      try {
        console.log("? [Banner] Requesting image from:", imageModel);
        const imgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Authorization": "Bearer " + userApiKey, 
            "Content-Type": "application/json", 
            "HTTP-Referer": "https://pager.sh",
            "X-Title": "Pager Protocol"
          },
          body: JSON.stringify({
            model: imageModel,
            messages: [{ role: "user", content: [{ type: "text", text: visualPrompt }] }],
            image_config: { aspect_ratio: "16:9" }
          })
        });

        if (imgRes.ok) {
          const imgData = await imgRes.json();
          // OpenRouter image response path check
          bannerUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url || 
                      imgData?.choices?.[0]?.message?.content?.match(/https:\/\/\S+\.(?:jpg|png|webp)/)?.[0] || "";
          
          if (!bannerUrl && imgData?.choices?.[0]?.message?.content) {
              console.log("? [Banner] Raw AI response:", imgData.choices[0].message.content);
          }
        } else {
            const errData = await imgRes.json();
            console.error("? [Banner] API Error:", errData);
        }
      } catch (e: any) {
          console.error("? [Banner] Fetch Exception:", e.message);
      }
      if (!bannerUrl) return NextResponse.json({ error: "Banner generation failed. Check your API credits and model selection." }, { status: 500 });
      return NextResponse.json({ image_url: bannerUrl });
    }

    if (!providedContent) return NextResponse.json({ error: "No content provided" }, { status: 400 });
    
    const systemPrompt = getCharacterSystemPrompt(mood, "nft", activeDna, finalAtmosphere);
    const userPrompt = `
      TASK: Rewrite the following article in the absolute style of ${activeDna.name}.
      CHARACTER DNA: ${activeDna.description}
      ATMOSPHERE: ${finalAtmosphere}
      MOOD: ${mood}
      
      CRITICAL RULES FOR CONTENT RICHNESS:
      1. LENGTH: The rewritten article MUST be substantial. Aim for at least 4-6 meaty paragraphs. No short summaries.
      2. STRUCTURE: Break complex ideas into readable sections. Use YOUR unique voice to explain technical concepts.
      3. CHARACTER IMMERSION: Use extreme character slang, metaphors, and attitude. Never break character.
      4. CONTEXT: Keep the Web3 facts accurate but wrap them in your personal narrative and the "${finalAtmosphere}" world logic.
      
      OUTPUT FORMAT: STRICT JSON
      {
        "title": "Short catchy title in character voice",
        "body": "Rewritten article (4-6 paragraphs) with HTML tags for emphasis only (<strong>, <em>). Use character slang.",
        "analysis": "Short 2-sentence market insight about BTC/Web3 from this character's perspective",
        "banner": "Highly detailed visual description for a banner image based on the article topic and character style"
      }
      
      ARTICLE TO REWRITE:
      ${providedContent.slice(0, 10000)}
    `;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": "Bearer " + userApiKey, 
        "Content-Type": "application/json", 
        "HTTP-Referer": "https://pager.sh",
        "X-Title": "Pager Protocol"
      },
      body: JSON.stringify({ 
        model: textModel, 
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], 
        response_format: { type: "json_object" },
        temperature: 0.8
      })
    });

    if (!aiRes.ok) {
        const err = await aiRes.json().catch(() => ({ error: { message: "Unknown AI error" } }));
        return NextResponse.json({ error: "AI Failed: " + (err.error?.message || "Unknown error") }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const result = extractJson(aiData.choices[0]?.message?.content || "{}");

    const finalTitle = (result.title || "New Intel").replace(/["']/g, "").trim();
    let finalBody = finalFormat(result.body || "");
    if (!finalBody.includes("<p")) {
      finalBody = finalBody.split("\n\n").map((p) => "<p style=\"margin-bottom: 24px;\">" + p + "</p>").join("");
    }

    const fullHtml = finalBody + getBtcAnalysisBlock(finalFormat(result.analysis || "Market analysis."), { activeDna, profile: userProfile }) + getMiningSponsorBlock();
    const visualPrompt = getCharacterVisualPrompt(result.banner || finalTitle, mood, "nft", finalTitle, finalAtmosphere, activeDna);
    
    let bannerUrl = "";
    try {
      const imgRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Authorization": "Bearer " + userApiKey, 
          "Content-Type": "application/json", 
          "HTTP-Referer": "https://pager.sh",
          "X-Title": "Pager Protocol"
        },
        body: JSON.stringify({ 
            model: imageModel, 
            messages: [{ role: "user", content: [{ type: "text", text: visualPrompt }] }], 
            image_config: { aspect_ratio: "16:9" } 
        })
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        bannerUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url || 
                    imgData?.choices?.[0]?.message?.content?.match(/https:\/\/\S+\.(?:jpg|png|webp)/)?.[0] || "";
      }
    } catch (e) {}

    return NextResponse.json({ title: finalTitle, content: fullHtml, image_url: bannerUrl, banner_description: result.banner || finalTitle });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


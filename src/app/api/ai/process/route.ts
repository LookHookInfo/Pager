import { NextResponse } from "next/server";
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, getCharacterVisualPrompt, CustomDna } from "@/lib/character";
import { resolveNftDna } from "@/lib/character/nft";
import { getSupabaseServer } from "@/lib/supabase";
import { decryptData } from "@/lib/security";
import { verifySignature, getAuthMessage } from "@/lib/auth";
import { uploadToPinata, generateBflImage } from "@/lib/image";

export const maxDuration = 90;
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
    console.error("❌ [AI Process] JSON Parse Error. Content:", text.slice(0, 200));
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
      atmosphere: providedAtmosphere,
      nftTokenId: requestedNftId,
      onlyBanner = false,
      bannerDescription = "",
      userAddress = "",
      signature,
      message,
      skipBanner = false
    } = body;

    if (!userAddress) return NextResponse.json({ error: "User address required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    // 1. ВЕРИФИКАЦИЯ ПОДПИСИ
    if (!signature || !message) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const expectedAction = onlyBanner ? "regenerate banner" : "initiate magic forge";
    const expectedMessage = getAuthMessage(expectedAction, normalizedAddress);
    const sessionMessage = getAuthMessage("authorize session", normalizedAddress);
    
    // Принимаем либо конкретное действие, либо общую подпись сессии
    if (message !== expectedMessage && message !== sessionMessage) {
      return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const isAuthorized = await verifySignature(message, signature, normalizedAddress);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabaseServer = getSupabaseServer();
    const { data: userProfile } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("address", normalizedAddress)
      .maybeSingle();

    // ПРОВЕРКА БАЛАНСА ПЕРЕД ГЕНЕРАЦИЕЙ БАННЕРА (10 кредитов)
    const CREDIT_COST = 10;
    const isGeneratingBanner = onlyBanner || !skipBanner;
    
    if (isGeneratingBanner) {
      const currentCredits = userProfile?.ai_credits || 0;
      if (currentCredits < CREDIT_COST) {
        return NextResponse.json({ error: `Insufficient credits. Balance: ${currentCredits}. Required: ${CREDIT_COST}` }, { status: 402 });
      }
    }

    // Use system key primarily for consistent branding quality
    let openRouterKey = process.env.OPENROUTER_API_KEY;
    
    // Если у пользователя свой ключ, расшифровываем его
    if (userProfile?.ai_api_key) {
      const decryptedUserKey = decryptData(userProfile.ai_api_key);
      if (decryptedUserKey) openRouterKey = decryptedUserKey;
    }

    if (!openRouterKey) {
      return NextResponse.json({ error: "AI Engine Offline (Key Missing)" }, { status: 403 });
    }

    const nftTokenId = requestedNftId || userProfile?.ai_nft_token_id;
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const nftMetadata = await resolveNftDna(nftTokenId);
    if (!nftMetadata) return NextResponse.json({ error: "Failed to resolve NFT DNA" }, { status: 404 });

    const activeDna: CustomDna = {
      name: nftMetadata.name,
      personality: nftMetadata.pager_dna.personality,
      voice: nftMetadata.pager_dna.voice,
      physical_description: nftMetadata.pager_dna.physical_description,
      image_url: normalizeReference(nftMetadata.image)
    };

    let finalAtmosphere = (providedAtmosphere || userProfile?.ai_atmosphere || "Surrealism")
      .replace(/["`${}]/g, "").trim().slice(0, 100);
    if (!finalAtmosphere) finalAtmosphere = "Surrealism";
    
    // STRICT MODEL SELECTION:
    // TEXT: Gemini 2.5 Flash (Balanced speed/quality)
    // BANNERS: FLUX.2 PRO (Direct BFL API)
    const textModel = "google/gemini-2.5-flash";

    if (onlyBanner) {
      const visualPrompt = getCharacterVisualPrompt(bannerDescription || providedTitle, mood, "nft", providedTitle, finalAtmosphere, activeDna);
      const bannerUrl = await generateBflImage(visualPrompt);
      if (!bannerUrl) return NextResponse.json({ error: "Banner generation failed" }, { status: 500 });
      return NextResponse.json({ image_url: bannerUrl });
    }

    if (!providedContent) return NextResponse.json({ error: "No content provided" }, { status: 400 });
    
    const systemPrompt = getCharacterSystemPrompt(mood, "nft", activeDna, finalAtmosphere);
    const userPrompt = `
      TASK: Rewrite the following article in the absolute style of ${activeDna.name}.
      CHARACTER DNA: ${activeDna.personality}
      CHARACTER VOICE: ${activeDna.voice}
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
        "banner": "EXTREMELY DETAILED visual scene (4-5 sentences) illustrating the ARTICLE'S CORE SUBJECT as a literal, concrete scene. Describe specific elements from the article — objects, setting, action, technology, people. Then describe how ${activeDna.name} is positioned within this scene reacting to it. Make the article's TOPIC VISIBLE and immediately recognizable."
      }
      
      ARTICLE TO REWRITE:
      ${providedContent.slice(0, 10000)}
    `;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": "Bearer " + openRouterKey, 
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
    // Extract article context for the visual prompt
    const articleContext = fullHtml
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);

    const visualPrompt = getCharacterVisualPrompt(result.banner || finalTitle, mood, "nft", finalTitle, finalAtmosphere, activeDna, articleContext);
    
    // Banner generation via FLUX with auto-persistence to Pinata
    let bannerUrl = "";
    if (!skipBanner) {
      bannerUrl = await generateBflImage(visualPrompt);
      
      // СПИСЫВАЕМ КРЕДИТЫ ТОЛЬКО ПРИ УСПЕХЕ
      if (bannerUrl) {
         console.log(`💸 [AI Process] Generation success. Debiting ${CREDIT_COST} credits from ${normalizedAddress}`);
         const { error: debitError } = await supabaseServer.rpc('decrement_ai_credits', { 
           user_address: normalizedAddress, 
           dec_amount: CREDIT_COST 
         });

         if (debitError) {
           console.error("❌ [AI Process] Balance debit failed (non-critical for user):", debitError.message);
           // Пытаемся обновить вручную если RPC нет
           await supabaseServer.from('profiles')
             .update({ ai_credits: (userProfile?.ai_credits || 10) - CREDIT_COST })
             .eq('address', normalizedAddress);
         }
      }
    }

    return NextResponse.json({ title: finalTitle, content: fullHtml, image_url: bannerUrl, banner_description: result.banner || finalTitle });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

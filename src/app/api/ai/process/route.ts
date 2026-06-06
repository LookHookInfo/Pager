import { NextResponse } from "next/server";
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, getCharacterVisualPrompt, CustomDna } from "@/lib/character";
import { resolveNftDna } from "@/lib/character/nft";
import { getSupabaseServer } from "@/lib/supabase";
import { decryptData } from "@/lib/security";
import { verifySignature, getAuthMessage } from "@/lib/auth";
import sharp from "sharp";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * SERVER-SIDE PERSISTENCE & COMPRESSION: 
 * Downloads the AI image, compresses it using 'sharp', and uploads it to Pinata.
 */
async function uploadToPinata(imageUrl: string): Promise<string> {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    console.error("❌ [Server Persist] PINATA_JWT missing");
    return imageUrl;
  }

  try {
    console.log("📡 [Server Persist] Downloading AI sample...");
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch AI image: ${imgRes.status}`);
    
    const arrayBuffer = await imgRes.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    console.log("📡 [Server Persist] Compressing image with sharp...");
    // Convert to WebP with high quality (85%) and reasonable size
    const compressedBuffer = await sharp(inputBuffer)
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    // Robust JWT cleaning
    const cleanJwt = pinataJwt.trim().split(/\s+/).reduce((a, b) => a.length > b.length ? a : b).replace(/JWT$/, "");
    
    const formData = new FormData();
    // Convert Buffer to Uint8Array for proper Blob compatibility in Node environments
    const blob = new Blob([new Uint8Array(compressedBuffer)], { type: 'image/webp' });
    formData.append("file", blob, `ai-banner-${Date.now()}.webp`);
    
    const metadata = JSON.stringify({ 
      name: `pager-ai-${Date.now()}`,
      keyvalues: { project: "Pager", type: "AI-Banner", source: "BFL", format: "webp" }
    });
    formData.append("pinataMetadata", metadata);
    formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    console.log(`📡 [Server Persist] Uploading compressed banner (~${Math.round(compressedBuffer.length / 1024)} KB) to Pinata...`);
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { "Authorization": `Bearer ${cleanJwt}` },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
      const permanentUrl = `${gateway.endsWith("/") ? gateway : gateway + "/"}${data.IpfsHash}`;
      console.log("✅ [Server Persist] Success:", permanentUrl);
      return permanentUrl;
    } else {
      const errText = await res.text();
      console.error("❌ [Server Persist] Pinata error:", errText);
    }
  } catch (e) {
    console.error("❌ [Server Persist] Critical failure:", e);
  }
  return imageUrl;
}

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

async function generateBflImage(prompt: string): Promise<string> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("BFL API Key missing in environment");

  console.log("🎨 [BFL] Starting generation for prompt:", prompt.slice(0, 100) + "...");

  try {
    // 1. Create Task - FLUX.2 PRO
    const res = await fetch("https://api.bfl.ai/v1/flux-2-pro", {
      method: "POST",
      headers: {
        "x-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        width: 1344,
        height: 768,
        prompt_upsampling: true
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("❌ [BFL API] Task Creation Failed:", err);
      throw new Error(`BFL Creation Failed: ${res.status}`);
    }

    const data = await res.json();
    const taskId = data.id;
    const pollingUrl = `https://api.bfl.ai/v1/get_result?id=${taskId}`;
    
    console.log(`📡 [BFL] Task created: ${taskId}. Polling...`);

    // 2. Poll Result (Increased to 40 attempts x 2s = 80s)
    // Note: Vercel might still timeout, but we try our best.
    for (let i = 0; i < 40; i++) { 
      await new Promise(r => setTimeout(r, 2000));
      
      try {
        const statusRes = await fetch(pollingUrl, {
          headers: { "x-key": apiKey }
        });
        
        if (!statusRes.ok) {
          console.warn(`⚠️ [BFL] Polling error (${statusRes.status}), retrying...`);
          continue;
        }
        
        const statusData = await statusRes.json();
        console.log(`⏳ [BFL] Status (${i}): ${statusData.status}`);

        if (statusData.status === "Ready") {
          const sampleUrl = statusData.result?.sample || "";
          if (sampleUrl) {
            console.log("✅ [BFL] Image ready, uploading to Pinata...");
            return await uploadToPinata(sampleUrl);
          }
          throw new Error("BFL returned Ready but no sample URL");
        } 
        
        if (statusData.status === "Failed" || statusData.status === "Error") {
          console.error("❌ [BFL API] Generation Error:", statusData);
          throw new Error(`BFL Generation Failed: ${statusData.error || 'Unknown error'}`);
        }
      } catch (pollErr: any) {
        console.error("⚠️ [BFL] Poll iteration failed:", pollErr.message);
      }
    }
    
    throw new Error("BFL Generation Timed Out (80s)");
  } catch (e: any) {
    console.error("❌ [BFL API] Exception:", e.message);
    throw e;
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
      description: nftMetadata.pager_dna.personality || nftMetadata.pager_dna.physical_description,
      reference: normalizeReference(nftMetadata.image)
    };

    const finalAtmosphere = providedAtmosphere || userProfile?.ai_atmosphere || "Rick and Morty";
    
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
    const visualPrompt = getCharacterVisualPrompt(result.banner || finalTitle, mood, "nft", finalTitle, finalAtmosphere, activeDna);
    
    // Banner generation via FLUX.2 PRO with auto-persistence to Pinata
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

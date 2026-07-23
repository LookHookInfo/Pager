import { NextResponse } from "next/server";
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, CustomDna } from "@/lib/character";
import { resolveNftDna } from "@/lib/character/nft";
import { getSupabaseServer } from "@/lib/supabase";
import { decryptData } from "@/lib/security";
import { verifySignature, getAuthMessage } from "@/lib/auth";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

function normalizeReference(url: string): string {
  if (!url) return "";
  return url.startsWith("ipfs://") ? url.replace("ipfs://", "https://gateway.ipn.io/ipfs/") : url;
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
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  throw new Error("AI returned invalid JSON");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content, title: providedTitle, mood = "neutral", atmosphere: providedAtmosphere, nftTokenId, userAddress, signature, message } = body;

    if (!userAddress) return NextResponse.json({ error: "User address required" }, { status: 400 });
    if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    const sessionMessage = getAuthMessage("authorize session", normalizedAddress);
    if (message !== sessionMessage) {
      return NextResponse.json({ error: "Invalid auth message" }, { status: 401 });
    }
    if (!(await verifySignature(message, signature, normalizedAddress))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase.from("profiles").select("*").eq("address", normalizedAddress).maybeSingle();

    const apiKey = profile?.ai_api_key ? decryptData(profile.ai_api_key) : process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI key missing" }, { status: 403 });

    const nftMetadata = await resolveNftDna(nftTokenId);
    if (!nftMetadata) return NextResponse.json({ error: "Failed to load NFT DNA" }, { status: 404 });

    const activeDna: CustomDna = {
      name: nftMetadata.name,
      personality: nftMetadata.pager_dna.personality,
      voice: nftMetadata.pager_dna.voice,
      physical_description: nftMetadata.pager_dna.physical_description,
      image_url: normalizeReference(nftMetadata.image),
    };

    let atmosphere = (providedAtmosphere || profile?.ai_atmosphere || "Surrealism")
      .replace(/["`${}]/g, "").trim().slice(0, 100);
    if (!atmosphere) atmosphere = "Surrealism";

    const systemPrompt = getCharacterSystemPrompt(mood, "nft", activeDna, atmosphere);
    const userPrompt = `
      TASK: Rewrite the following article in the absolute style of ${activeDna.name}.
      CHARACTER DNA: ${activeDna.personality}
      CHARACTER VOICE: ${activeDna.voice}
      ATMOSPHERE: ${atmosphere}
      MOOD: ${mood}

      RULES:
      1. Aim for 4-6 meaty paragraphs. No short summaries.
      2. Use extreme character slang, metaphors, and attitude. Never break character.
      3. Keep Web3 facts accurate but wrap in personal narrative and "${atmosphere}" world logic.

      OUTPUT FORMAT: STRICT JSON
      {
        "title": "Short catchy title in character voice",
        "body": "Rewritten article with HTML tags (<strong>, <em>)",
        "analysis": "Short 2-sentence BTC/Web3 market insight",
        "banner": "SCENE DESCRIPTION FOR AI IMAGE GENERATION. You MUST extract the following from the article and describe them as a concrete visual scene:\n\n1. CORE SUBJECT: What is the article literally about? Name the specific technology, coin, protocol, event, or person.\n2. KEY OBJECTS: List 3-5 specific physical objects that represent this story (e.g. Bitcoin coins, smart contract code on a screen, ASIC mining rigs, a vault door, trading charts, a specific token logo, a government building, a server rack).\n3. SETTING: Where does this scene take place? Be specific (e.g. a futuristic trading floor, a dark server room, a government courtroom, a DeFi protocol's virtual vault, a mining farm with cooling fans).\n4. ACTION: What is happening in this moment? (e.g. coins pouring out of a broken vault, charts showing a massive green candle, a hand signing a document, data flowing through cables).\n5. MOOD ELEMENTS: Lighting and atmosphere details (neon glow, dramatic shadows, emergency red lights, golden sunrise).\n6. MASCOT POSITION: How is ${activeDna.name} positioned within this scene and what are they doing? (e.g. standing in front of a giant Bitcoin chart pointing at a green candle, sitting on a throne of gold coins, investigating a broken smart contract).\n\nWrite this as 4-5 flowing sentences that paint a vivid, specific picture. The image generator must be able to identify EXACTLY what article this banner represents just from the visual elements described."
      }

      ARTICLE:
      ${content.slice(0, 10000)}
    `;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pager.sh",
        "X-Title": "Pager Protocol",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.8,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({ error: { message: "AI error" } }));
      return NextResponse.json({ error: err.error?.message || "AI failed" }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const result = extractJson(aiData.choices[0]?.message?.content || "{}");

    const finalTitle = (result.title || providedTitle || "New Intel").replace(/["']/g, "").trim();
    let finalBody = finalFormat(result.body || "");
    if (!finalBody.includes("<p")) {
      finalBody = finalBody.split("\n\n").map(p => `<p style="margin-bottom: 24px;">${p}</p>`).join("");
    }

    const fullHtml = finalBody + getBtcAnalysisBlock(finalFormat(result.analysis || ""), { activeDna, profile }) + getMiningSponsorBlock();

    return NextResponse.json({
      title: finalTitle,
      content: fullHtml,
      banner_description: result.banner || finalTitle,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

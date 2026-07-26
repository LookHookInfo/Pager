import { NextResponse } from "next/server";
import { getCharacterSystemPrompt } from "@/lib/character";
import { getBtcAnalysisBlock, getMiningSponsorBlock } from "@/lib/character/blocks";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { decryptData } from "@/lib/security";
import { verifySession } from "@/lib/auth";
import { finalFormat, extractJson } from "@/lib/utils";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content, title: providedTitle, mood = "neutral", atmosphere: providedAtmosphere, nftTokenId, userAddress, signature, message } = body;

    if (!userAddress) return NextResponse.json({ error: "User address required" }, { status: 400 });
    if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    const authError = await verifySession(normalizedAddress, signature, message);
    if (authError) return authError;

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase.from("profiles").select("*").eq("address", normalizedAddress).maybeSingle();

    const apiKey = profile?.ai_api_key ? decryptData(profile.ai_api_key) : process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI key missing" }, { status: 403 });

    const activeDna = await resolveDna(nftTokenId);
    if (!activeDna) return NextResponse.json({ error: `Mascot DNA not found for token #${nftTokenId}. This mascot may not have DNA uploaded. Try a different mascot.` }, { status: 404 });

    let atmosphere = (providedAtmosphere || "Surrealism")
      .replace(/["`${}]/g, "").trim().slice(0, 100);
    if (!atmosphere) atmosphere = "Surrealism";

    const systemPrompt = getCharacterSystemPrompt(mood, activeDna, atmosphere);
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
      4. CRITICAL: Every paragraph MUST reflect the mood writing instructions above.

      OUTPUT FORMAT: STRICT JSON
      {
        "title": "Short catchy title in character voice",
        "body": "Rewritten article with HTML tags (<strong>, <em>)",
        "analysis": "Short 2-sentence BTC/Web3 market insight",
        "banner": "SCENE DESCRIPTION FOR IMAGE GENERATION. Describe a concrete, logical scene that visually tells this article's story:\\n\\n1. WHAT: The article's core subject — name the specific coin, protocol, technology, event, or person.\\n2. WHERE: The physical setting — trading floor, server room, courtroom, mining farm, DeFi vault, government building.\\n3. OBJECTS: 3-5 specific real objects visible in the scene (Bitcoin coins, smart contract code on screen, ASIC rigs, vault door, trading charts with candlesticks, token logos, documents, servers).\\n4. ACTION: What is happening right now — coins flowing, charts spiking, code compiling, documents signing, vaults opening/closing.\\n5. FEELING: The emotional atmosphere — triumphant (green/gold), ominous (red/shadows), urgent (flashing alerts), calm (cool blue).\\n6. MASCOT: How ${activeDna.name} participates in this scene — analyzing a chart, inspecting code, pointing at data, guarding a vault. Not just standing there.\\n\\nWrite 4-5 flowing sentences. The scene must make logical physical sense and immediately communicate WHAT this article is about."
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

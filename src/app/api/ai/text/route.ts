import { NextResponse } from "next/server";
import { getCharacterSystemPrompt } from "@/lib/character";
import { getBtcAnalysisBlock, getMiningSponsorBlock } from "@/lib/character/blocks";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { verifySessionAnyAction } from "@/lib/auth";
import { finalFormat } from "@/lib/utils";
import { chatAnyModelJson } from "@/lib/anymodel";

// Model chain (primary + fallbacks) can take up to ~85s worst case while a
// gemini pool is down, so the function needs more than the default 60s.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content, title: providedTitle, mood = "neutral", atmosphere: providedAtmosphere, nftTokenId, userAddress, signature, message } = body;

    if (!userAddress) return NextResponse.json({ error: "User address required" }, { status: 400 });
    if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    const authError = await verifySessionAnyAction(normalizedAddress, signature, message);
    if (authError) return authError;

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase.from("profiles").select("*").eq("address", normalizedAddress).maybeSingle();

    const activeDna = await resolveDna(nftTokenId);
    if (!activeDna) return NextResponse.json({ error: `Mascot DNA not found for token #${nftTokenId}. This mascot may not have DNA uploaded. Try a different mascot.` }, { status: 404 });

    const VALID_TEXT_MODELS = new Set([
      "ag/gemini-3.5-flash-low",
      "ag/gemini-3.5-flash-extra-low",
      "gc/gemini-2.5-flash",
      "gc/gemini-2.5-pro",
    ]);
    const textModel = VALID_TEXT_MODELS.has(profile?.ai_text_model) ? profile.ai_text_model : undefined;

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
        "banner": "SHORT VISUAL SCENARIO FOR THE BANNER IMAGE. Read the article and write 4-5 flowing sentences that turn it into a concrete, logical, visually actionable scene. Cover ALL of these:\\n1. SUBJECT: The article's core story — name the specific coin, protocol, technology, event, or person.\\n2. BACKGROUND: The physical setting — trading floor, server room, courtroom, mining farm, DeFi vault, government building, city street.\\n3. MASCOT ACTION & GESTURE: Exactly what ${activeDna.name} does and how — pointing at a spiking chart, inspecting smart contract code on a screen, guarding a vault door, raising hands in triumph, tapping a hologram, reading a contract. Name ONE clear pose.\\n4. EFFECTS: 2-3 visual effects that sell the mood — green/gold sparks for a rally, red alert flashes for a hack, holograms and glowing charts, rain of binary code, confetti, lightning.\\n5. OBJECTS: 3-5 specific real objects visible — Bitcoin coins, trading candlesticks, ASIC rigs, vault door, token logos, documents, servers.\\n\\nRules: the scene must make logical physical sense, have ONE focal point, and immediately communicate what the article is about. ${activeDna.name} is the ONLY character in the scene — no other people, animals, or mascots. Do NOT describe the mascot's clothes or appearance — only what it does and its gesture."
      }

      ARTICLE:
      ${content.slice(0, 10000)}
    `;

    const result = await chatAnyModelJson({
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.8,
      timeoutMs: 40000,
      model: textModel,
    });

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

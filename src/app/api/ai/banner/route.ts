import { NextResponse } from "next/server";
import { getCharacterVisualPrompt } from "@/lib/character";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { generateBflImage } from "@/lib/image";
import { verifySession } from "@/lib/auth";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mood = "neutral", title, bannerDescription, atmosphere: providedAtmosphere, nftTokenId, userAddress, signature, message, content } = body;

    if (!userAddress) return NextResponse.json({ error: "Address required" }, { status: 400 });
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    const authError = await verifySession(normalizedAddress, signature, message);
    if (authError) return authError;

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase.from("profiles").select("ai_credits").eq("address", normalizedAddress).maybeSingle();

    const credits = profile?.ai_credits || 0;
    // Banner generation costs 10 $HASH credits. Top up in Profile settings.
    if (credits < 10) {
      return NextResponse.json({ error: `Not enough $HASH credits for banner. Top up in Profile settings.` }, { status: 402 });
    }

    // ATOMIC DEBIT: debit credits BEFORE generation to prevent race conditions
    const { error: debitErr } = await supabase.rpc("decrement_ai_credits", {
      user_address: normalizedAddress,
      dec_amount: 10,
    });
    if (debitErr) {
      // Fallback: manual update
      await supabase.from("profiles").update({ ai_credits: credits - 10 }).eq("address", normalizedAddress);
    }

    const activeDna = await resolveDna(nftTokenId);
    if (!activeDna) return NextResponse.json({ error: `Mascot DNA not found for token #${nftTokenId}. This mascot may not have DNA uploaded. Try a different mascot.` }, { status: 404 });

    let atmosphere = (providedAtmosphere || "Surrealism")
      .replace(/["`${}]/g, "").trim().slice(0, 100);
    if (!atmosphere) atmosphere = "Surrealism";

    // Extract concise article context for the visual prompt
    const articleContext = content
      ? content
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 800)
      : "";

    const prompt = getCharacterVisualPrompt(bannerDescription || title, mood, title, atmosphere, activeDna, articleContext);
    console.log(`🎨 [Banner] Generating with atmosphere="${atmosphere}", prompt length=${prompt.length}`);
    const imageUrl = await generateBflImage(prompt);

    if (!imageUrl) {
      // Refund credits if generation failed
      await supabase.rpc("increment_ai_credits", { user_address: normalizedAddress, inc_amount: 10 });
      return NextResponse.json({ error: "Banner generation failed" }, { status: 500 });
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

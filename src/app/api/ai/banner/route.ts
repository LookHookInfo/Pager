import { NextResponse } from "next/server";
import { getCharacterVisualPrompt } from "@/lib/character";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { generateBflImage } from "@/lib/image";
import { verifySession } from "@/lib/auth";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

async function atomicDebitCredits(
  address: string,
  amount: number,
): Promise<boolean> {
  const supabase = getSupabaseServer();
  // Try RPC first (PostgreSQL function — atomic, needs SQL migration)
  const { data: rpcResult, error: rpcErr } = await supabase
    .rpc("decrement_ai_credits", { user_address: address, dec_amount: amount });

  if (!rpcErr && rpcResult !== null && rpcResult !== undefined) {
    return true;
  }

  // RPC not available — use read-CAS-write (service_role bypasses RLS)
  const { data, error: readErr } = await supabase
    .from("profiles")
    .select("ai_credits")
    .eq("address", address)
    .single();

  if (readErr || !data) return false;
  if (data.ai_credits < amount) return false;

  const newBalance = data.ai_credits - amount;
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ ai_credits: newBalance })
    .eq("address", address)
    .eq("ai_credits", data.ai_credits);

  return !updateErr;
}

async function atomicRefundCredits(
  address: string,
  amount: number,
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .rpc("increment_ai_credits", { user_address: address, inc_amount: amount });

  if (!error) return;

  const { data } = await supabase
    .from("profiles")
    .select("ai_credits")
    .eq("address", address)
    .single();

  if (!data) return;
  await supabase
    .from("profiles")
    .update({ ai_credits: data.ai_credits + amount })
    .eq("address", address)
    .eq("ai_credits", data.ai_credits);
}

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
    if (credits < 10) {
      return NextResponse.json({ error: "Not enough $HASH credits for banner. Top up in Profile settings." }, { status: 402 });
    }

    // ATOMIC DEBIT: debit credits BEFORE generation
    const debited = await atomicDebitCredits(normalizedAddress, 10);
    if (!debited) {
      return NextResponse.json({ error: "Failed to debit credits. Try again." }, { status: 409 });
    }

    const activeDna = await resolveDna(nftTokenId);
    if (!activeDna) {
      await atomicRefundCredits(normalizedAddress, 10);
      return NextResponse.json({ error: `Mascot DNA not found for token #${nftTokenId}. Try a different mascot.` }, { status: 404 });
    }

    let atmosphere = (providedAtmosphere || "Surrealism")
      .replace(/["`${}]/g, "").trim().slice(0, 100);
    if (!atmosphere) atmosphere = "Surrealism";

    const articleContext = content
      ? content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 800)
      : "";

    const prompt = getCharacterVisualPrompt(bannerDescription || title, mood, title, atmosphere, activeDna, articleContext);

    const imageUrl = await generateBflImage(prompt);

    if (!imageUrl) {
      await atomicRefundCredits(normalizedAddress, 10);
      return NextResponse.json({ error: "Banner generation failed. Credits refunded." }, { status: 500 });
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

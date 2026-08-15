import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifySession } from "@/lib/auth";
import { MASCOTS_CONTRACT_ADDRESS } from "@/lib/web3";
import { sendMascotToForum } from "@/lib/tg-mascot";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tokenId, address, signature, message } = body;

    if (!tokenId || !address) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }
    if (!signature || !message) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const normalized = address.toLowerCase();

    const authError = await verifySession(normalized, signature, message, "notify mascot");
    if (authError) return authError;

    const supabase = getSupabaseServer();
    const { data: dna, error } = await supabase
      .from("mascots_dna")
      .select("*")
      .eq("id", Number(tokenId))
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!dna) {
      return NextResponse.json({ error: "Mascot DNA not found" }, { status: 404 });
    }

    if (dna.contract_address && dna.contract_address.toLowerCase() !== MASCOTS_CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Mascot belongs to an older contract version" }, { status: 410 });
    }

    if ((dna.creator_address || "").toLowerCase() !== normalized) {
      return NextResponse.json({ error: "Only the creator can announce a mascot" }, { status: 403 });
    }

    const result = await sendMascotToForum({
      tokenId: Number(tokenId),
      name: dna.name,
      personality: dna.personality,
      price: dna.price,
      creator: dna.creator_address,
      imageUrl: dna.image_url,
    });

    return result.success
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: result.error || "Telegram send failed" }, { status: 502 });
  } catch (e: any) {
    console.error("❌ [Notify Mascot] Critical:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

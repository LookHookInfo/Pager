import { NextResponse } from "next/server";
import { getCharacterVisualPrompt, CustomDna } from "@/lib/character";
import { resolveNftDna } from "@/lib/character/nft";
import { getSupabaseServer } from "@/lib/supabase";
import { generateBflImage } from "@/lib/image";
import { verifySignature, getAuthMessage } from "@/lib/auth";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mood = "neutral", title, bannerDescription, atmosphere: providedAtmosphere, nftTokenId, userAddress, signature, message, content } = body;

    if (!userAddress) return NextResponse.json({ error: "Address required" }, { status: 400 });
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
    const { data: profile } = await supabase.from("profiles").select("ai_credits, ai_atmosphere").eq("address", normalizedAddress).maybeSingle();

    const credits = profile?.ai_credits || 0;
    // Banner generation costs 10 $HASH credits. Top up in Profile settings.
    if (credits < 10) {
      return NextResponse.json({ error: `Not enough $HASH credits for banner. Top up in Profile settings.` }, { status: 402 });
    }

    const nftMetadata = await resolveNftDna(nftTokenId);
    if (!nftMetadata) return NextResponse.json({ error: "Failed to load NFT DNA" }, { status: 404 });

    const activeDna: CustomDna = {
      name: nftMetadata.name,
      personality: nftMetadata.pager_dna.personality,
      voice: nftMetadata.pager_dna.voice,
      physical_description: nftMetadata.pager_dna.physical_description,
      image_url: nftMetadata.image.startsWith("ipfs://")
        ? nftMetadata.image.replace("ipfs://", "https://gateway.ipn.io/ipfs/")
        : nftMetadata.image,
    };

    let atmosphere = (providedAtmosphere || profile?.ai_atmosphere || "Surrealism")
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

    const prompt = getCharacterVisualPrompt(bannerDescription || title, mood, "nft", title, atmosphere, activeDna, articleContext);
    console.log(`🎨 [Banner] Generating with atmosphere="${atmosphere}", prompt length=${prompt.length}`);
    const imageUrl = await generateBflImage(prompt);

    if (!imageUrl) return NextResponse.json({ error: "Banner generation failed" }, { status: 500 });

    const { error: debitError } = await supabase.rpc("decrement_ai_credits", {
      user_address: normalizedAddress,
      dec_amount: 10,
    });

    if (debitError) {
      await supabase.from("profiles").update({ ai_credits: credits - 10 }).eq("address", normalizedAddress);
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

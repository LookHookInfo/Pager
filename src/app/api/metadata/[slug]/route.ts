import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug; // e.g. "0.json"
    const tokenId = slug.replace(".json", "");
    
    if (isNaN(Number(tokenId))) {
      return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    }

    const { data: dna, error } = await supabase
      .from("mascots_dna")
      .select("*")
      .eq("id", tokenId)
      .single();

    if (error || !dna) {
      return NextResponse.json({ error: "Mascot DNA not found" }, { status: 404 });
    }

    // Return NFT Metadata in OpenSea format
    return NextResponse.json({
      name: dna.name,
      description: dna.personality,
      image: dna.image_url,
      external_url: `https://pager.lookhook.info/tape/${dna.creator_address}`,
      attributes: [
        { trait_type: "Creator", value: dna.creator_address },
        { trait_type: "Voice", value: dna.voice },
        { trait_type: "Price", value: `${Math.floor(dna.price / 1e18)} $HASH` }
      ],
      // Custom field for our internal AI logic
      pager_dna: {
        version: "2.0",
        voice: dna.voice,
        personality: dna.personality,
        physical_description: dna.physical_desc,
        reference_image: dna.image_url,
        art_style: "Dynamic"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

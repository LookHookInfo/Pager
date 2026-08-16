import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { MASCOTS_CONTRACT_ADDRESS } from "@/lib/web3";
import { getSiteUrl } from "@/lib/site";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug; 
    const tokenId = slug.replace(".json", "");

    if (isNaN(Number(tokenId))) {
      return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    }

    // Attempt to fetch with contract_address filter
    let query = supabase
      .from("mascots_dna")
      .select("*")
      .eq("id", tokenId);

    // We check for contract_address but don't fail hard if column is missing (though error might happen)
    // To be safe, we first try to find the record. If it has contract_address, we match it.
    const { data: dna, error } = await query.maybeSingle();

    if (error || !dna) {
      return NextResponse.json({ error: "Mascot DNA not found" }, { status: 404 });
    }

    // Validation: If the record has a contract_address, it MUST match the current one
    if (dna.contract_address && dna.contract_address.toLowerCase() !== MASCOTS_CONTRACT_ADDRESS.toLowerCase()) {
       return NextResponse.json({ error: "Mascot belongs to an older contract version" }, { status: 410 });
    }

    return NextResponse.json({
      name: dna.name,
      description: dna.personality,
      image: dna.image_url,
      external_url: `${getSiteUrl()}/tape/${dna.creator_address}`,
      attributes: [
        { trait_type: "Creator", value: dna.creator_address },
        { trait_type: "Voice", value: dna.voice },
        { trait_type: "Price", value: `${Math.floor(dna.price / 1e18)} $HASH` },
        { trait_type: "Protocol Version", value: "3.0" }
      ],
      pager_dna: {
        version: "3.0",
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


import { getContract, readContract } from "thirdweb";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI } from "@/lib/web3";
import { base } from "thirdweb/chains";
import { getSupabaseServer } from "@/lib/supabase";
import { ipfsGatewayVariants } from "@/lib/ipfs";

export interface PagerDna {
  version: string;
  voice: string;
  personality: string;
  physical_description: string;
  reference_image: string;
  art_style: string;
  market_context?: string;
}

export interface NftMascotMetadata {
  name: string;
  description: string;
  image: string;
  pager_dna: PagerDna;
}

async function fetchMetadataFromUri(uri: string): Promise<NftMascotMetadata | null> {
  // 1. If it's a standard HTTP URL, fetch directly
  if (uri.startsWith("http")) {
    try {
      console.log(`📡 [NFT DNA] Fetching direct URL: ${uri}`);
      const response = await fetch(uri, {
        signal: AbortSignal.timeout(12000),
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const metadata = await response.json();
        if (metadata.pager_dna) return metadata as NftMascotMetadata;
      }
    } catch (e) {
      console.warn(`⚠️ [NFT DNA] Direct fetch failed for ${uri}, trying IPFS logic if applicable.`);
    }
  }

  // 2. IPFS Multi-Gateway Fallback
  for (const fetchUrl of ipfsGatewayVariants(uri)) {
    try {
      console.log(`📡 [NFT DNA] Trying gateway/URL: ${fetchUrl}`);
      const response = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(12000),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const metadata = await response.json();
        if (metadata.pager_dna) {
          return metadata as NftMascotMetadata;
        }
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

async function fetchMetadataFromDb(tokenId: string): Promise<NftMascotMetadata | null> {
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("mascots_dna")
      .select("name, personality, voice, physical_desc, image_url")
      .eq("id", tokenId)
      .maybeSingle();

    if (!data || !data.personality) return null;

    console.log(`✅ [NFT DNA] Resolved Token #${tokenId} from mascots_dna table`);
    return {
      name: data.name || `Protocol #${tokenId}`,
      description: "",
      image: data.image_url || "",
      pager_dna: {
        version: "1.0",
        voice: data.voice || data.personality,
        personality: data.personality,
        physical_description: data.physical_desc || "",
        reference_image: "",
        art_style: "",
      },
    };
  } catch (e) {
    return null;
  }
}

/**
 * Resolves DNA from an NFT Mascot.
 * Tries contract URI first, falls back to mascots_dna table.
 */
export async function resolveNftDna(tokenId: string): Promise<NftMascotMetadata | null> {
  try {
    const contract = getContract({
      client,
      chain: base,
      address: MASCOTS_CONTRACT_ADDRESS,
      abi: MASCOTS_ABI as any,
    });

    const uri = await readContract({
      contract,
      method: "function uri(uint256) view returns (string)",
      params: [BigInt(tokenId)],
    });

    if (uri) {
      const metadata = await fetchMetadataFromUri(uri);
      if (metadata) {
        console.log(`✅ [NFT DNA] Resolved Token #${tokenId} from contract URI`);
        return metadata;
      }
    } else {
      console.warn(`⚠️ [NFT DNA] Token ${tokenId} has no URI in contract.`);
    }

    // Fallback: check mascots_dna table
    console.log(`🔄 [NFT DNA] Contract URI failed for Token #${tokenId}, trying mascots_dna table...`);
    const dbMetadata = await fetchMetadataFromDb(tokenId);
    if (dbMetadata) return dbMetadata;

    console.error(`❌ [NFT DNA] Failed to resolve Token #${tokenId} from all sources.`);
    return null;
  } catch (error) {
    console.error(`❌ [NFT DNA] Critical error resolving token ${tokenId}:`, error);

    // Even on contract error, try DB fallback
    const dbMetadata = await fetchMetadataFromDb(tokenId);
    if (dbMetadata) return dbMetadata;

    return null;
  }
}

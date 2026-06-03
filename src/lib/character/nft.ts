import { getContract, readContract } from "thirdweb";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI } from "@/lib/web3";
import { base } from "thirdweb/chains";

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

const GATEWAYS = [
  "https://gateway.ipn.io/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/"
];

/**
 * Resolves DNA from an NFT Mascot.
 * Handles both IPFS and Direct HTTP URIs from the contract.
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

    if (!uri) {
        console.error(`❌ [NFT DNA] Token ${tokenId} has no URI in contract.`);
        return null;
    }

    // 1. If it's a standard HTTP URL, fetch directly
    if (uri.startsWith("http")) {
        try {
            console.log(`📡 [NFT DNA] Fetching direct URL: ${uri}`);
            const response = await fetch(uri, { 
                signal: AbortSignal.timeout(8000),
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
    const cid = uri.replace("ipfs://", "");
    if (cid !== uri || !uri.startsWith("http")) {
        for (const gateway of GATEWAYS) {
          try {
            const fetchUrl = uri.startsWith("http") ? uri : `${gateway}${cid}`;
            console.log(`📡 [NFT DNA] Trying gateway/URL: ${fetchUrl}`);
            const response = await fetch(fetchUrl, { 
                signal: AbortSignal.timeout(8000),
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
              const metadata = await response.json();
              if (metadata.pager_dna) {
                 console.log(`✅ [NFT DNA] Resolved Token #${tokenId}`);
                 return metadata as NftMascotMetadata;
              }
            }
          } catch (e) {
            continue;
          }
        }
    }

    console.error(`❌ [NFT DNA] Failed to resolve Token #${tokenId}.`);
    return null;
  } catch (error) {
    console.error(`❌ [NFT DNA] Critical error resolving token ${tokenId}:`, error);
    return null;
  }
}

import { resolveNftDna } from "./nft";
import { normalizeIpfs } from "@/lib/ipfs";
import type { CustomDna } from "./index";

/**
 * Resolves NFT mascot DNA and returns a ready-to-use CustomDna object.
 * Returns null if the token has no DNA.
 */
export async function resolveDna(tokenId: string): Promise<CustomDna | null> {
  const metadata = await resolveNftDna(tokenId);
  if (!metadata) return null;

  return {
    name: metadata.name,
    personality: metadata.pager_dna.personality,
    voice: metadata.pager_dna.voice,
    physical_description: metadata.pager_dna.physical_description,
    image_url: normalizeIpfs(metadata.image),
  };
}

/**
 * Single source of truth for IPFS gateway handling.
 * Every consumer (image download rotation, client <img> fallback, NFT metadata
 * resolution, Telegram image URLs, OG generator) should use these helpers so
 * the gateway list and CID extraction stay in one place.
 */

export const IPFS_GATEWAYS = [
  "https://cf-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
] as const;

export function extractIpfsCid(url: string): string | null {
  const patterns = [
    /\/ipfs\/([a-zA-Z0-9]{46,})/,
    /\/ipfs\/([a-zA-Z0-9]+)/,
    /^ipfs:\/\/([a-zA-Z0-9]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Convert an ipfs:// URI to the primary gateway URL. HTTP(S) URLs pass through. */
export function normalizeIpfs(url: string): string {
  if (!url) return "";
  if (!url.startsWith("ipfs://")) return url;
  return `${IPFS_GATEWAYS[0]}${url.slice("ipfs://".length)}`;
}

/**
 * All usable gateway variants of a URL, starting with the normalized original.
 * Deduplicated so a URL already on a gateway doesn't repeat itself.
 */
export function ipfsGatewayVariants(url: string): string[] {
  if (!url) return [];
  const normalized = normalizeIpfs(url);
  const variants = [normalized];
  const cid = extractIpfsCid(normalized);
  if (cid) {
    for (const gateway of IPFS_GATEWAYS) {
      variants.push(`${gateway}${cid}`);
    }
  }
  return [...new Set(variants)];
}

export interface CommunityEntity {
  name: string;
  handle: string;
  tag: string;
  aliases: string[];
}

const COMMUNITIES: CommunityEntity[] = [
  { name: "Bitcoin", handle: "@Bitcoin", tag: "Bitcoin", aliases: ["bitcoin"] },
  { name: "Ethereum", handle: "@ethereum", tag: "Ethereum", aliases: ["ethereum"] },
  { name: "Solana", handle: "@solana", tag: "Solana", aliases: ["solana"] },
  { name: "Base", handle: "@BuildOnBase", tag: "Base", aliases: ["base"] },
  { name: "Coinbase", handle: "@coinbase", tag: "Coinbase", aliases: ["coinbase"] },
  { name: "Binance", handle: "@binance", tag: "Binance", aliases: ["binance"] },
  { name: "Tether", handle: "@Tether_to", tag: "Tether", aliases: ["tether", "usdt"] },
  { name: "Ripple", handle: "@Ripple", tag: "XRP", aliases: ["ripple", "xrp"] },
  { name: "Cardano", handle: "@Cardano", tag: "Cardano", aliases: ["cardano"] },
  { name: "Dogecoin", handle: "@dogecoin", tag: "Dogecoin", aliases: ["dogecoin"] },
  { name: "Polkadot", handle: "@Polkadot", tag: "Polkadot", aliases: ["polkadot"] },
  { name: "Chainlink", handle: "@chainlink", tag: "Chainlink", aliases: ["chainlink"] },
  { name: "Uniswap", handle: "@Uniswap", tag: "Uniswap", aliases: ["uniswap"] },
  { name: "Polygon", handle: "@0xPolygon", tag: "Polygon", aliases: ["polygon"] },
  { name: "Arbitrum", handle: "@arbitrum", tag: "Arbitrum", aliases: ["arbitrum"] },
  { name: "Optimism", handle: "@OptimismFND", tag: "Optimism", aliases: ["optimism"] },
  { name: "Aave", handle: "@AaveAave", tag: "Aave", aliases: ["aave"] },
  { name: "Worldcoin", handle: "@worldcoin", tag: "Worldcoin", aliases: ["worldcoin", "wld"] },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scans a text for known crypto/Web3 communities using word-boundary matching.
 * Only communities actually present in the article are returned, so @mentions
 * and hashtags generated from them are guaranteed to be on-topic.
 */
export function detectCommunities(text: string): CommunityEntity[] {
  const found: CommunityEntity[] = [];
  for (const community of COMMUNITIES) {
    const matched = community.aliases.some(
      alias => new RegExp(`\\b${escapeRegex(alias)}\\b`, "i").test(text),
    );
    if (matched) found.push(community);
  }
  return found;
}

/** Normalize a raw hashtag token into a valid "#Tag" (strips punctuation). */
export function cleanHashtag(raw: string): string {
  let tag = raw.trim();
  if (!tag.startsWith("#")) tag = `#${tag}`;
  return tag.replace(/[^#\w]/g, "");
}

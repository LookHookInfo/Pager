export interface DexToken {
  address: string;
  symbol: string;
  name: string;
  priceUsd: string;
  priceChange: { h1: number; h6: number; h24: number };
  volume: { h1: number; h6: number; h24: number };
  liquidity: { usd: number };
  fdv: number;
  pairAddress: string;
  baseToken: { address: string; symbol: string; name: string };
  dexId: string;
  url: string;
  info?: { imageUrl?: string; websites?: { url: string }[]; socials?: { type: string; url: string }[] };
}

export interface DexPairData {
  pairs: DexToken[];
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TokenOverview {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  pairAddress: string;
  dex: string;
  pairUrl: string;
  imageUrl?: string;
  website?: string;
  socials: { type: string; url: string }[];
}

async function fetchJson<T>(url: string, timeout = 8000): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`DEXScreener ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export async function searchToken(query: string): Promise<TokenOverview[]> {
  const data = await fetchJson<DexPairData>(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
  );
  if (!data.pairs?.length) return [];

  const bestPairByToken = new Map<string, typeof data.pairs[0]>();
  for (const p of data.pairs) {
    const addr = p.baseToken.address.toLowerCase();
    const existing = bestPairByToken.get(addr);
    if (!existing || (p.volume?.h24 || 0) > (existing.volume?.h24 || 0)) {
      bestPairByToken.set(addr, p);
    }
  }

  return Array.from(bestPairByToken.values())
    .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
    .slice(0, 5)
    .map((p) => ({
      address: p.baseToken.address,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      priceUsd: parseFloat(p.priceUsd) || 0,
      priceChange1h: p.priceChange?.h1 || 0,
      priceChange6h: p.priceChange?.h6 || 0,
      priceChange24h: p.priceChange?.h24 || 0,
      volume24h: p.volume?.h24 || 0,
      liquidity: p.liquidity?.usd || 0,
      fdv: p.fdv || 0,
      pairAddress: p.pairAddress,
      dex: p.dexId,
      pairUrl: p.url,
      imageUrl: p.info?.imageUrl,
      website: p.info?.websites?.[0]?.url,
      socials: p.info?.socials || [],
    }));
}

export async function getTokenByAddress(address: string): Promise<TokenOverview | null> {
  const data = await fetchJson<DexPairData>(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`
  );
  if (!data.pairs?.length) return null;

  const p = data.pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
  return {
    address: p.baseToken.address,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    priceUsd: parseFloat(p.priceUsd) || 0,
    priceChange1h: p.priceChange?.h1 || 0,
    priceChange6h: p.priceChange?.h6 || 0,
    priceChange24h: p.priceChange?.h24 || 0,
    volume24h: p.volume?.h24 || 0,
    liquidity: p.liquidity?.usd || 0,
    fdv: p.fdv || 0,
    pairAddress: p.pairAddress,
    dex: p.dexId,
    pairUrl: p.url,
    imageUrl: p.info?.imageUrl,
    website: p.info?.websites?.[0]?.url,
    socials: p.info?.socials || [],
  };
}

export async function getTokenCandles(pairAddress: string): Promise<CandleData[]> {
  try {
    const data = await fetchJson<{ data: { attributes: { ohlcv_list: [number, number, number, number, number, number][] } } }>(
      `https://api.geckoterminal.com/api/v2/networks/base/pools/${pairAddress}/ohlcv/hour?aggregate=1`,
      12000
    );
    const list = data?.data?.attributes?.ohlcv_list;
    if (!list?.length) return [];
    // GeckoTerminal format: [timestamp, open, close, high, low, volume]
    return list.map((c) => ({
      time: new Date(c[0] * 1000).toISOString(),
      open: c[1],
      close: c[2],
      high: c[3],
      low: c[4],
      volume: c[5],
    }));
  } catch {
    return [];
  }
}

export function calculateSMA(prices: number[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateRSI(prices: number[], period = 14): (number | undefined)[] {
  const result: (number | undefined)[] = [undefined];
  if (prices.length < period + 1) return prices.map(() => undefined);

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= period;
  avgLoss /= period;

  for (let i = 1; i < prices.length; i++) {
    if (i < period) {
      result.push(undefined);
      continue;
    }

    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

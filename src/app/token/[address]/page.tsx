"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, ExternalLink, BarChart3, Droplets, Flame } from "lucide-react";
import TokenChart from "@/components/TokenChart";
import Navbar from "@/components/Navbar";

interface TokenData {
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

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Indicators {
  sma20?: (number | undefined)[];
  sma50?: (number | undefined)[];
  rsi?: (number | undefined)[];
}

function formatNum(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n < 0.01) return `$${n.toExponential(2)}`;
  return `$${n.toFixed(6)}`;
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function TokenPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;

  const [token, setToken] = useState<TokenData | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/token?address=${address}&candles=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load token");
      setToken(data.token);
      setCandles(data.candles || []);
      setIndicators(data.indicators || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-black" size={24} />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-gray-400">{error || "Token not found"}</p>
        <button onClick={() => router.back()} className="btn-primary text-[10px]">Go Back</button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <nav className="border-b border-[var(--border-soft)] h-12 flex items-center px-6 md:px-12 sticky top-16 bg-white z-40">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-1.5 text-gray-400 hover:text-black transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="h-3 w-[1px] bg-gray-200" />
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Token Intel</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Header */}
        <div className="flex items-start gap-6">
          {token.imageUrl && (
            <img src={token.imageUrl} alt={token.symbol} className="w-16 h-16 rounded-full border border-gray-100 object-cover" />
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">{token.symbol}</h1>
              <span className="text-sm text-gray-400 font-medium">{token.name}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-300 bg-gray-50 px-2 py-0.5 rounded-sm">{token.dex}</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <span className="font-black">{formatNum(token.priceUsd)}</span>
              <span className={`flex items-center gap-1 font-bold ${token.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                {token.priceChange24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {formatPct(token.priceChange24h)} 24h
              </span>
            </div>
          </div>
          {token.pairUrl && (
            <a href={token.pairUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-gray-200 rounded-sm hover:border-black transition-all">
              DEXScreener <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="p-4 border border-gray-100 rounded-sm space-y-1">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-gray-400">
              <BarChart3 size={12} /> 1h Change
            </div>
            <span className={`text-lg font-black ${token.priceChange1h >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatPct(token.priceChange1h)}
            </span>
          </div>
          <div className="p-4 border border-gray-100 rounded-sm space-y-1">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-gray-400">
              <Flame size={12} /> 6h Change
            </div>
            <span className={`text-lg font-black ${token.priceChange6h >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatPct(token.priceChange6h)}
            </span>
          </div>
          <div className="p-4 border border-gray-100 rounded-sm space-y-1">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-gray-400">
              Volume 24h
            </div>
            <span className="text-lg font-black">{formatNum(token.volume24h)}</span>
          </div>
          <div className="p-4 border border-gray-100 rounded-sm space-y-1">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-gray-400">
              <Droplets size={12} /> Liquidity
            </div>
            <span className="text-lg font-black">{formatNum(token.liquidity)}</span>
          </div>
        </div>

        {/* Chart */}
        {candles.length > 0 ? (
          <div className="border border-gray-100 rounded-sm p-6">
            <TokenChart candles={candles} indicators={indicators || undefined} symbol={token.symbol} />
          </div>
        ) : (
          <div className="border border-gray-100 rounded-sm p-12 text-center">
            <p className="text-sm text-gray-400">No chart data available for this token</p>
          </div>
        )}

        {/* Token Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Token Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Contract</span><span className="font-mono text-[11px]">{token.address.slice(0, 10)}...{token.address.slice(-8)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">FDV</span><span className="font-bold">{formatNum(token.fdv)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Pair</span><span className="font-mono text-[11px]">{token.pairAddress.slice(0, 10)}...{token.pairAddress.slice(-8)}</span></div>
            </div>
          </div>
          {(token.website || token.socials.length > 0) && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Links</h3>
              <div className="space-y-2">
                {token.website && (
                  <a href={token.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-600">
                    Website <ExternalLink size={12} />
                  </a>
                )}
                {token.socials.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-600">
                    {s.type} <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

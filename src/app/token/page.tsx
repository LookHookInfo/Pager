"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, TrendingUp } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function TokenSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/token?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.tokens || []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-24 space-y-12">
        <div className="text-center space-y-4">
          <TrendingUp size={32} className="mx-auto text-gray-300" />
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Token Intel</h1>
          <p className="text-sm text-gray-400">Search any token by name or contract address on Base network</p>
        </div>

        <div className="flex items-center gap-3 max-w-xl mx-auto">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 border border-gray-200 focus-within:border-black rounded-sm transition-colors">
            <Search size={18} className="text-gray-300" />
            <input type="text" placeholder="Search token (e.g. PEPE, 0x...)" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="w-full text-sm font-medium outline-none" autoFocus />
          </div>
          <button onClick={handleSearch} disabled={isLoading || !query.trim()}
            className="bg-black text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-gray-800 transition-all disabled:opacity-50">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : "Search"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{results.length} results</span>
            {results.map((t: any) => (
              <button key={t.address} onClick={() => router.push(`/token/${t.address}`)}
                className="w-full flex items-center gap-4 p-4 border border-gray-100 rounded-sm hover:border-black transition-all text-left group">
                {t.imageUrl && <img src={t.imageUrl} alt={t.symbol} className="w-12 h-12 rounded-full object-cover border border-gray-100" />}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black uppercase">{t.symbol}</span>
                    <span className="text-xs text-gray-400">{t.name}</span>
                    <span className="text-[7px] font-bold uppercase text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">{t.dex}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-bold">${t.priceUsd < 0.01 ? t.priceUsd.toExponential(2) : t.priceUsd.toFixed(6)}</span>
                    <span className={`font-bold ${t.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                    </span>
                    <span className="text-gray-400">Vol: ${t.volume24h >= 1e6 ? (t.volume24h / 1e6).toFixed(1) + "M" : t.volume24h.toFixed(0)}</span>
                    <span className="text-gray-400">Liq: ${t.liquidity >= 1e6 ? (t.liquidity / 1e6).toFixed(1) + "M" : t.liquidity.toFixed(0)}</span>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase text-gray-300 group-hover:text-black transition-colors">View</span>
              </button>
            ))}
          </div>
        )}

        {!isLoading && results.length === 0 && query && (
          <p className="text-center text-sm text-gray-400">No tokens found</p>
        )}
      </div>
    </main>
  );
}

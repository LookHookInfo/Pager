"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search, ExternalLink, Loader2, Newspaper, Filter,
  ArrowUpRight, Sparkles, RefreshCw, ChevronDown
} from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  sourceIcon: string;
  category: string;
}

interface Source {
  name: string;
  icon: string;
  category: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "general", label: "Crypto" },
  { id: "bitcoin", label: "Bitcoin" },
  { id: "defi", label: "DeFi" },
  { id: "web3", label: "Web3" },
  { id: "regulation", label: "Regulation" },
  { id: "geopolitics", label: "Geopolitics" },
  { id: "economy", label: "Economy" },
  { id: "tech", label: "AI & Tech" },
  { id: "research", label: "Research" },
  { id: "analysis", label: "Analysis" },
  { id: "breaking", label: "Breaking" },
];

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSource, setActiveSource] = useState("all");
  const [showSources, setShowSources] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/news?limit=80");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch news");
      setItems(data.items);
      setSources(data.sources);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;
      const matchesSource =
        activeSource === "all" || item.source === activeSource;
      return matchesSearch && matchesCategory && matchesSource;
    });
  }, [items, search, activeCategory, activeSource]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      counts[item.source] = (counts[item.source] || 0) + 1;
    });
    return counts;
  }, [items]);

  return (
    <main className="min-h-screen bg-[var(--bg-main)]">
      <Navbar />

      <section className="max-w-7xl mx-auto px-4 md:px-10 pt-20 pb-12 border-b border-[var(--border-soft)]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-7xl typography-title mb-4">
              Fresh <span className="text-[var(--text-secondary)]">Signal.</span>
            </h1>
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
              Real-time crypto news from 12 sources. Pick a story, rewrite it with AI, publish on Pager.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchNews}
              disabled={loading}
              className="btn-secondary flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {filteredItems.length} stories
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-10 py-8">
        <div className="flex flex-col gap-6">
          {/* Search + Source filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                placeholder="Search news..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 text-sm border border-[var(--border-soft)] focus:border-black outline-none bg-white transition-colors rounded-sm"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-[var(--border-soft)] rounded-sm hover:border-black transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <Filter size={14} />
                {activeSource === "all" ? "All Sources" : activeSource}
                <ChevronDown size={14} className={`transition-transform ${showSources ? "rotate-180" : ""}`} />
              </button>
              {showSources && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-[var(--border-soft)] rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50 max-h-80 overflow-y-auto">
                  <div
                    onClick={() => { setActiveSource("all"); setShowSources(false); }}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 text-[10px] font-black uppercase tracking-widest border-b border-gray-50 ${activeSource === "all" ? "bg-blue-50/50" : ""}`}
                  >
                    <span>All Sources</span>
                    <span className="text-gray-400">{items.length}</span>
                  </div>
                  {sources.map((s) => (
                    <div
                      key={s.name}
                      onClick={() => { setActiveSource(s.name); setShowSources(false); }}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${activeSource === s.name ? "bg-blue-50/50" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{s.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase">{s.name}</span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase">{s.category}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">{sourceCounts[s.name] || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  activeCategory === cat.id
                    ? "bg-black text-white border-black"
                    : "bg-white text-[var(--text-secondary)] border-[var(--border-soft)] hover:border-black"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-10 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={32} className="animate-spin text-gray-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Fetching 12 feeds...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-32">
            <p className="text-sm font-bold text-red-500 mb-4">{error}</p>
            <button onClick={fetchNews} className="btn-primary text-[10px] font-black uppercase tracking-widest">
              Retry
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-32">
            <Newspaper size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">No stories found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item, i) => (
              <div
                key={`${item.source}-${item.link}-${i}`}
                className="card-medium p-6 flex flex-col gap-4 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.sourceIcon}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {item.source}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-gray-300 uppercase">
                    {timeAgo(item.pubDate)}
                  </span>
                </div>

                <h3 className="text-lg font-bold leading-snug line-clamp-3 group-hover:text-[var(--text-secondary)] transition-colors">
                  {item.title}
                </h3>

                {item.description && (
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-gray-300">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-black transition-colors"
                    >
                      Source <ExternalLink size={10} />
                    </a>
                    <Link
                      href={`/write?url=${encodeURIComponent(item.link)}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all"
                    >
                      <Sparkles size={10} /> Rewrite
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

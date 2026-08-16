"use client";

import { Twitter, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

const ecosystem = [
  { name: "Mining Hash", url: "https://hashcoin.farm" },
  { name: "GemFun", url: "https://hashcoin.farm/gem" },
  { name: "Lock Staking", url: "https://lookhook.info/" },
  { name: "NFT claim", url: "https://nft.lookhook.info/" },
  { name: "De Vote", url: "https://vote.lookhook.info/" },
  { name: "Coin Info", url: "https://hashcoin.farm/coin" },
  { name: "Name Service", url: "https://lookhook.info/" },
  { name: "Guild", url: "https://guild.xyz/hashcoin" },
  { name: "Galxe", url: "https://app.galxe.com/quest/bAFdwDecXS6NRWsbYqVAgh" },
  { name: "Pager", url: `${siteUrl}/` },
];

export default function Footer() {
  return (
    <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-7xl">
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-soft)] rounded-full px-6 py-3 shadow-sm flex items-center justify-between gap-8 overflow-hidden">
        
        {/* Left: Developer Info */}
        <div className="flex items-center gap-4 shrink-0 border-r border-[var(--border-soft)] pr-6">
          <span className="text-xs font-black uppercase tracking-tighter">LookHook</span>
          <Link 
            href="https://x.com/LookHookInfo" 
            target="_blank" 
            className="text-[var(--text-secondary)] hover:text-black transition-colors"
          >
            <Twitter size={16} />
          </Link>
        </div>

        {/* Center: Ecosystem Live Feed (Horizontal Ticker) */}
        <div className="flex-1 overflow-hidden relative mx-4">
          <div className="flex items-center gap-8 animate-scroll whitespace-nowrap group w-max">
            {/* Тройное дублирование для 100% гарантии отсутствия пустот при любой ширине экрана */}
            {[...ecosystem, ...ecosystem, ...ecosystem].map((item, index) => (
              <Link
                key={`${item.name}-${index}`}
                href={item.url}
                target="_blank"
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-black transition-colors shrink-0"
              >
                {item.name}
                <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
          
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white/80 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white/80 to-transparent pointer-events-none z-10" />
        </div>

        {/* Right: Ecosystem Label */}
        <div className="hidden md:flex items-center gap-2 shrink-0 border-l border-[var(--border-soft)] pl-6">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">Ecosystem</span>
        </div>
      </div>
    </footer>
  );
}

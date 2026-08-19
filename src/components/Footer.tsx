import { Twitter, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export default function Footer() {
  return (
    <footer className="bg-[var(--accent)] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-black tracking-tight">Pager</span>
          <span className="text-[11px] text-white/40">
            Web3 media for $HASH on Base. Powered by LookHook.
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-white/50">
          <Link
            href={siteUrl}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            Ecosystem
            <ExternalLink size={10} />
          </Link>
          <Link
            href="https://x.com/LookHookInfo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Twitter size={12} />
            X
          </Link>
        </div>
      </div>
    </footer>
  );
}

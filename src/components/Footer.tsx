import { Twitter, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export default function Footer() {
  return (
    <footer className="bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-extrabold tracking-tight">Pager</span>
          <span className="text-xs text-white/50">
            Web3 media for $HASH on Base. Powered by LookHook.
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs text-white/60">
          <Link
            href={`${siteUrl}/`}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            Ecosystem
            <ExternalLink size={11} />
          </Link>
          <Link
            href="https://x.com/LookHookInfo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Twitter size={14} />
            X
          </Link>
        </div>
      </div>
    </footer>
  );
}

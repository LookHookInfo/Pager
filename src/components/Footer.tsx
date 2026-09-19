import Link from "next/link";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

export default function Footer() {
  return (
    <footer className="bg-[var(--accent)] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Link
            href="https://github.com/LookHookInfo/Pager"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-[15px] font-black tracking-tight hover:text-white/80 transition-colors"
          >
            Pager
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-white/40 group-hover:text-white transition-colors"
              aria-hidden="true"
            >
              <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.12-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.14 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.3 0 .32.21.7.82.58A11.9 11.9 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
            </svg>
          </Link>
          <span className="text-[11px] text-white/40">
            Web3 media AI.
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-white/50">
          <Link
            href="https://road.lookhook.info"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Ecosystem
          </Link>
          <Link
            href="https://x.com/LookHookInfo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </Link>
        </div>
      </div>
    </footer>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useActiveAccount, useActiveWallet, useDisconnect, useWalletBalance } from "thirdweb/react";
import { base } from "thirdweb/chains";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Layers } from "lucide-react";
import { client } from "@/lib/web3";

const WalletConnect = dynamic(() => import("./WalletConnect"), {
  ssr: false,
  loading: () => (
    <div className="connect-btn pointer-events-none">Sign In</div>
  ),
});

export default function Navbar() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();

  const [credits, setCredits] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: ethBalance } = useWalletBalance({
    client,
    chain: base,
    address: account?.address,
  });

  useEffect(() => {
    if (!account?.address) {
      setCredits(null);
      return;
    }
    fetch(`/api/profile?address=${account.address}`)
      .then((r) => r.json())
      .then((d) => setCredits(d.profile?.ai_credits ?? 0))
      .catch(() => setCredits(0));
  }, [account?.address]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`text-sm transition-colors ${
        active
          ? "text-primary font-semibold"
          : "text-[var(--text-secondary)] hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="border-b border-[var(--border-soft)] bg-[var(--bg-main)] sticky top-0 z-50 h-16 flex items-center">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-10 flex justify-between items-center">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-primary">
          Pager
        </Link>

        <div className="flex items-center gap-6">
          {link("/news", "News", pathname === "/news")}
          {link("/token", "Tokens", pathname.startsWith("/token"))}
          {account && (
            <>
              {link("/write", "Write", pathname === "/write")}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-full border border-[var(--border-soft)] hover:border-black transition-colors bg-white"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-[10px] font-bold">
                    {(account.address.slice(2, 4) || "").toUpperCase()}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[var(--text-secondary)] transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {menuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-[var(--border-soft)] rounded-lg shadow-[0_16px_40px_rgba(0,0,0,0.08)] z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border-soft)]">
                      <p className="font-mono text-xs text-[var(--text-secondary)] truncate">
                        {account.address.slice(0, 6)}...{account.address.slice(-4)}
                      </p>
                      <p className="text-sm font-semibold mt-0.5">
                        {ethBalance?.displayValue.slice(0, 6)} ETH
                      </p>
                    </div>
                    <div className="py-1.5">
                      <Link
                        href={`/tape/${account.address}`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <span>My Tape</span>
                        {credits !== null && (
                          <span className="text-xs text-[var(--text-secondary)]">
                            {credits} credits
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/mascots"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <Layers size={14} className="text-[var(--text-secondary)]" />
                        Mascots
                      </Link>
                    </div>
                    <button
                      onClick={() => wallet && disconnect(wallet)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm border-t border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-black hover:bg-gray-50 transition-colors"
                    >
                      <LogOut size={14} />
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {!account && <WalletConnect />}
        </div>
      </div>
    </nav>
  );
}

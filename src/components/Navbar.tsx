"use client";

import dynamic from "next/dynamic";
import { useActiveAccount, useActiveWallet, useDisconnect, useWalletBalance } from "thirdweb/react";
import { base } from "thirdweb/chains";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Layers, User } from "lucide-react";
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
    if (!account?.address) { setCredits(null); return; }
    fetch(`/api/profile?address=${account.address}`)
      .then((r) => r.json())
      .then((d) => setCredits(d.profile?.ai_credits ?? 0))
      .catch(() => setCredits(0));
  }, [account?.address]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`text-[13px] font-medium transition-colors ${
        active ? "text-[var(--text)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center bg-[var(--surface)] shadow-sm">
      <div className="max-w-6xl mx-auto w-full px-4 md:px-8 flex justify-between items-center">
        <Link href="/" className="text-[18px] font-black tracking-tight text-[var(--text)]">
          Pager
        </Link>

        <div className="flex items-center gap-5">
          {link("/news", "News", pathname === "/news")}
          {link("/token", "Tokens", pathname.startsWith("/token"))}
          {account && link("/write", "Write", pathname === "/write")}

          {account && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 pl-1.5 pr-2 h-8 rounded-lg bg-[var(--surface-dim)] hover:bg-[var(--border)] transition-colors"
              >
                <span className="avatar avatar--sm bg-[var(--accent)] text-white">
                  <User size={14} />
                </span>
                <ChevronDown
                  size={12}
                  className={`text-[var(--text-dim)] transition-transform ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {menuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-[var(--border)]">
                    <p className="font-mono text-[11px] text-[var(--text-dim)] truncate">
                      {account.address.slice(0, 6)}...{account.address.slice(-4)}
                    </p>
                    <p className="text-[13px] font-semibold mt-0.5">
                      {ethBalance?.displayValue.slice(0, 6)} ETH
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      href={`/tape/${account.address}`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 text-[13px] hover:bg-[var(--surface-dim)] transition-colors"
                    >
                      <span>My Tape</span>
                      {credits !== null && (
                        <span className="badge badge--dim">{credits}</span>
                      )}
                    </Link>
                    <Link
                      href="/mascots"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--surface-dim)] transition-colors"
                    >
                      <Layers size={14} className="text-[var(--text-dim)]" />
                      Mascots
                    </Link>
                  </div>
                  <button
                    onClick={() => wallet && disconnect(wallet)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] border-t border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-dim)] transition-colors"
                  >
                    <LogOut size={14} />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}

          {!account && <WalletConnect />}
        </div>
      </div>
    </nav>
  );
}

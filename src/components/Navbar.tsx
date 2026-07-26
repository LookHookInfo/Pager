"use client";

import { ConnectButton, useActiveAccount, useWalletBalance, useActiveWallet, useDisconnect } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { client } from "@/lib/web3";

const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "email", "passkey", "phone", "apple"],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("io.rabby"),
  createWallet("me.rainbow"),
  createWallet("com.trustwallet.app"),
];

export default function Navbar() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();
  const [credits, setCredits] = useState(0);
  const [creditsLoading, setCreditsLoading] = useState(true);

  const { data: ethBalance } = useWalletBalance({
    client,
    chain: base,
    address: account?.address,
  });

  useEffect(() => {
    if (!account?.address) { setCreditsLoading(false); return; }
    setCreditsLoading(true);
    fetch(`/api/profile?address=${account.address}`)
      .then(r => r.json())
      .then(d => setCredits(d.profile?.ai_credits || 0))
      .catch(() => {})
      .finally(() => setCreditsLoading(false));
  }, [account?.address]);

  const isMyTapePage = account && pathname === `/tape/${account.address}`;

  return (
    <nav className="border-b border-[var(--border-soft)] bg-[var(--bg-main)] sticky top-0 z-50 h-16 flex items-center">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-black">Pager</Link>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">beta</span>
        </div>
        
          <div className="flex items-center gap-6">
          <Link href="/news" className={`text-sm font-medium transition-colors ${pathname === "/news" ? "text-black" : "text-[var(--text-secondary)] hover:text-black"}`}>News</Link>
          {account && (
            <div className="hidden md:flex items-center gap-6">
              <Link href="/mascots" className="text-sm font-medium text-[var(--text-secondary)] hover:text-black transition-colors">Mascots</Link>
              <Link href="/write" className="text-sm font-medium text-[var(--text-secondary)] hover:text-black transition-colors">Write</Link>
              <div className="h-4 w-[1px] bg-[var(--border-soft)]" />
              <Link href={`/tape/${account.address}`} className="text-sm font-medium text-[var(--text-secondary)] hover:text-black transition-colors">
                {isMyTapePage ? (
                  creditsLoading ? "..." : `${credits} Credits`
                ) : (
                  "My Tape"
                )}
              </Link>
            </div>
          )}

          {!account ? (
            <ConnectButton
              client={client}
              chain={base}
              wallets={wallets}
              appMetadata={{ 
                name: "Pager", 
                url: "https://pager.lookhook.info",
                description: "Web3 Media"
              }}
              connectButton={{ className: "connect-btn-medium", label: "Sign In" }}
            />
          ) : (
            <div className="relative group">
              <button 
                onClick={() => wallet && disconnect(wallet)}
                className="flex items-center justify-center w-10 h-10 rounded-full border border-[var(--border-soft)] hover:border-black transition-all bg-white"
              >
                <LogOut size={16} className="text-[var(--text-secondary)] group-hover:text-black transition-colors" />
              </button>
              
              {/* Tooltip */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-[60] translate-y-1 group-hover:translate-y-0 shadow-lg">
                {ethBalance?.displayValue.slice(0, 6)} ETH
                {/* Triangle arrow */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45" />
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

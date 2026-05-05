"use client";

import { ConnectButton, useActiveAccount, useWalletBalance } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useState } from "react";
import { base } from "thirdweb/chains";
import { Copy, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { client, HASH_TOKEN_ADDRESS } from "@/lib/web3";

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
  const [copied, setCopied] = useState(false);

  const { data: balance, isLoading: isBalanceLoading } = useWalletBalance({
    client,
    chain: base,
    address: account?.address,
    tokenAddress: HASH_TOKEN_ADDRESS,
  });

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <nav className="border-b border-[var(--border-soft)] bg-[var(--bg-main)] sticky top-0 z-50 h-16 flex items-center">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-black">Pager</Link>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">beta</span>
        </div>
        
        <div className="flex items-center gap-6">
          {account && (
            <div className="hidden md:flex items-center gap-6">
              <Link href="/write" className="text-sm font-medium text-[var(--text-secondary)] hover:text-black transition-colors">Write</Link>
              <div className="h-4 w-[1px] bg-[var(--border-soft)]" />
              <Link href={`/tape/${account.address}`} className="flex flex-col items-end group">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-widest leading-none">My Tape</span>
                <span className="text-sm font-bold group-hover:underline">
                  {isBalanceLoading ? "..." : `${Math.floor(parseFloat(balance?.displayValue || "0"))} $HASH`}
                </span>
              </Link>
              <div className="h-4 w-[1px] bg-[var(--border-soft)]" />
              <button onClick={copyAddress} className="text-[var(--text-secondary)] hover:text-black transition-colors">
                {copied ? <CheckCircle2 size={18} className="text-green-600" /> : <Copy size={18} />}
              </button>
            </div>
          )}
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
        </div>
      </div>
    </nav>
  );
}

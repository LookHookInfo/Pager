"use client";

import { ConnectButton } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import { client } from "@/lib/web3";
import { getSiteUrl } from "@/lib/site";

const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "email", "passkey", "phone", "apple"],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

export default function WalletConnect() {
  return (
    <ConnectButton
      client={client}
      chain={base}
      wallets={wallets}
      appMetadata={{
        name: "Pager",
        url: getSiteUrl(),
        description: "Web3 Media",
      }}
      connectButton={{ className: "connect-btn", label: "Sign In" }}
    />
  );
}

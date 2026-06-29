"use client";

import { useState, useCallback } from "react";
import { Newspaper } from "lucide-react";

const FALLBACK_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.ipn.io/ipfs/",
];

function extractIpfsCid(url: string): string | null {
  const patterns = [
    /\/ipfs\/([a-zA-Z0-9]{46,})/,
    /\/ipfs\/([a-zA-Z0-9]+)/,
    /^ipfs:\/\/([a-zA-Z0-9]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function buildGatewayUrl(originalUrl: string, gatewayIndex: number): string {
  const cid = extractIpfsCid(originalUrl);
  if (cid && gatewayIndex < FALLBACK_GATEWAYS.length) {
    return `${FALLBACK_GATEWAYS[gatewayIndex].replace(/\/+$/, "")}/${cid}`;
  }
  return originalUrl;
}

export default function BannerImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const currentSrc = buildGatewayUrl(src, gatewayIdx);

  const handleError = useCallback(() => {
    const next = gatewayIdx + 1;
    if (next < FALLBACK_GATEWAYS.length) {
      setGatewayIdx(next);
    } else {
      setFailed(true);
    }
  }, [gatewayIdx]);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Newspaper size={40} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Banner unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Newspaper } from "lucide-react";

const FALLBACK_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.ipn.io/ipfs/",
];

// A freshly-pinned CID (article just generated) can be unreachable on the
// public gateways for a few seconds even though pinFileToIPFS already returned
// the hash. So: retry the same gateway once before moving on, and if every
// gateway fails, keep cycling in the background instead of showing a permanent
// error — the image self-heals as soon as the CID warms up.
const SAME_GATEWAY_RETRIES = 1;
const GATEWAY_RETRY_DELAY_MS = 1000;
const RECYCLE_MS = 5000;

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
  const [gatewayRetries, setGatewayRetries] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const currentSrc = buildGatewayUrl(src, gatewayIdx);

  const handleError = useCallback(() => {
    const retrySame = gatewayRetries < SAME_GATEWAY_RETRIES;
    setTimeout(() => {
      if (retrySame) {
        setReloadKey((k) => k + 1);
        setGatewayRetries((r) => r + 1);
      } else {
        const next = gatewayIdx + 1;
        if (next < FALLBACK_GATEWAYS.length) {
          setGatewayIdx(next);
          setGatewayRetries(0);
        } else {
          setFailed(true);
        }
      }
    }, retrySame ? GATEWAY_RETRY_DELAY_MS : 0);
  }, [gatewayIdx, gatewayRetries]);

  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => {
      setGatewayIdx(0);
      setGatewayRetries(0);
      setFailed(false);
    }, RECYCLE_MS);
    return () => clearTimeout(t);
  }, [failed]);

  const prevSrc = useRef(src);
  useEffect(() => {
    if (prevSrc.current !== src) {
      prevSrc.current = src;
      setGatewayIdx(0);
      setGatewayRetries(0);
      setFailed(false);
    }
  }, [src]);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Newspaper size={40} className="text-gray-300 mx-auto mb-2 animate-pulse" />
          <p className="text-xs text-gray-400">Banner unavailable</p>
          <p className="text-[10px] text-gray-300 mt-0.5">Retrying…</p>
        </div>
      </div>
    );
  }

  return (
    <img
      key={reloadKey}
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}

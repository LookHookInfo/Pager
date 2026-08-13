import { getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { client, HASH_TOKEN_ADDRESS } from "@/lib/web3";

export const GEMFUN_ADDRESS = "0xea4831Df95738d6Ef0f2b47e5345fa75A2E59e86";

export const CURVE_SUPPLY = 300_000_000n * 10n ** 18n;

export const MAX_UINT_APPROVE =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

export function gemContract() {
  return getContract({ client, chain: base, address: GEMFUN_ADDRESS });
}

export function hashContract() {
  return getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
}

export function isValidTokenAddress(value: string | null | undefined): boolean {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function normalizeTokenAddress(value: string | null | undefined): string | null {
  if (!isValidTokenAddress(value)) return null;
  return value!.trim().toLowerCase();
}

export function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function reserveFor(sold: bigint): bigint {
  if (sold <= 0n) return 0n;
  return sold / 1000n + (sold * sold) / (45_000_000_000n * 10n ** 18n);
}

export function costFor(sold: bigint, memeOut: bigint): bigint {
  if (memeOut <= 0n) return 0n;
  const before = reserveFor(sold);
  const after = reserveFor(sold + memeOut);
  return after > before ? after - before : 0n;
}

export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("negative sqrt");
  if (n < 2n) return n;
  let x0 = n >> 1n;
  let x1 = (x0 + n / x0) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) >> 1n;
  }
  return x0;
}

export function memeOutForCost(sold: bigint, targetCost: bigint): bigint {
  if (targetCost <= 0n) return 0n;
  const D = 45_000_000_000n * 10n ** 18n;
  const b = 2n * sold + D / 1000n;
  const discriminant = b * b + 4n * targetCost * D;
  const m = (isqrt(discriminant) - b) / 2n;
  return m > 0n ? m : 0n;
}

export function curveProgressPercent(sold: bigint): number {
  if (sold <= 0n) return 0;
  const pct = (sold * 10_000n) / CURVE_SUPPLY;
  return Number(pct) / 100;
}

export function gemLogoUrl(description: string): string | null {
  if (!description) return null;
  const raw = (description.includes("|") ? description.split("|")[0] : description).trim();
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  let cid = raw.startsWith("ipfs://") ? raw.slice("ipfs://".length) : raw;
  cid = cid.split(/[\/?#]/)[0];
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|ba[a-zA-Z0-9]{56,60})$/.test(cid)) {
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
    return `${gateway.replace(/\/+$/, "")}/${cid}`;
  }
  return null;
}

export interface GemTokenData {
  token: string;
  name: string;
  symbol: string;
  description: string;
  logoUrl: string | null;
  sold: string;
  raised: string;
  miningReserve: string;
  isMigrated: boolean;
  isCurveCompleted: boolean;
  canBuy: boolean;
  curvePct: number;
}

function toBigint(v: unknown, fallback = 0n): bigint {
  try {
    return typeof v === "bigint" ? v : BigInt(v as string);
  } catch {
    return fallback;
  }
}

export async function fetchGemTokenData(tokenAddress: string): Promise<GemTokenData | null> {
  const token = normalizeTokenAddress(tokenAddress);
  if (!token) return null;

  try {
    const contract = gemContract();
    const [core, state] = await Promise.all([
      readContract({
        contract,
        method: "function tokenCore(address) view returns (string,string,bytes32,string)",
        params: [token],
      }),
      readContract({
        contract,
        method: "function tokens(address) view returns (bool,bool,uint256,uint256,uint256)",
        params: [token],
      }),
    ]);

    const name = String(core[0] || "Unnamed");
    const symbol = String(core[1] || "TOKEN");
    const description = String(core[3] || "");

    const isMigrated = Boolean(state[0]);
    const isCurveCompleted = Boolean(state[1]);
    const stateSold = toBigint(state[2]);
    const stateRaised = toBigint(state[3]);
    const stateMiningReserve = toBigint(state[4]);

    return {
      token,
      name,
      symbol,
      description,
      logoUrl: gemLogoUrl(description),
      sold: stateSold.toString(),
      raised: stateRaised.toString(),
      miningReserve: stateMiningReserve.toString(),
      isMigrated,
      isCurveCompleted,
      canBuy: !isMigrated && !isCurveCompleted && stateSold < CURVE_SUPPLY,
      curvePct: curveProgressPercent(stateSold),
    };
  } catch (e) {
    console.error("[GemFun] fetch token data failed:", e);
    return null;
  }
}

export function formatCompact(wei: bigint, decimals = 18): string {
  const scale = 10n ** BigInt(decimals);
  const x = Number(wei) / Number(scale);
  if (x >= 1_000_000_000) return `${(x / 1_000_000_000).toFixed(2)}B`;
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(2)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
  if (x >= 1) return `${x.toFixed(x > 100 ? 0 : 2)}`;
  return `${x.toFixed(4)}`;
}

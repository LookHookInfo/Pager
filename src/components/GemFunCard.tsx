"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Loader2, CheckCircle2 } from "lucide-react";
import {
  GEMFUN_ADDRESS, CURVE_SUPPLY, MAX_UINT_APPROVE,
  costFor, memeOutForCost, formatCompact, shortAddress, gemContract, hashContract,
} from "@/lib/gemfun";
import type { GemTokenData } from "@/lib/gemfun";

export default function GemFunCard({
  tokenAddress,
  tokenData,
}: {
  tokenAddress: string;
  tokenData: GemTokenData;
}) {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const router = useRouter();

  const [pct, setPct] = useState(0);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const sold = useMemo(() => BigInt(tokenData.sold), [tokenData]);
  const remaining = useMemo(() => (CURVE_SUPPLY - sold > 0n ? CURVE_SUPPLY - sold : 0n), [sold]);

  const balanceBig = balance ?? 0n;
  const hashIn = useMemo(
    () => (balanceBig * BigInt(Math.round(pct * 10))) / 1000n,
    [balanceBig, pct]
  );
  const memeOut = useMemo(() => {
    if (hashIn <= 0n || remaining <= 0n) return 0n;
    const want = memeOutForCost(sold, hashIn);
    return want > remaining ? remaining : want;
  }, [hashIn, remaining, sold]);
  const cost = useMemo(() => costFor(sold, memeOut), [sold, memeOut]);
  const maxHashIn = useMemo(() => {
    if (hashIn <= 0n) return 0n;
    const slip = (hashIn * 11n) / 10n;
    return slip > balanceBig ? balanceBig : slip;
  }, [hashIn, balanceBig]);

  const fetchWallet = useCallback(async () => {
    if (!account?.address) { setBalance(null); setAllowance(null); return; }
    try {
      const [bal, allow] = await Promise.all([
        readContract({ contract: hashContract(), method: "function balanceOf(address) view returns (uint256)", params: [account.address] }),
        readContract({ contract: hashContract(), method: "function allowance(address,address) view returns (uint256)", params: [account.address as string, GEMFUN_ADDRESS] }),
      ]);
      setBalance(BigInt(bal));
      setAllowance(BigInt(allow));
    } catch {
      setBalance(0n);
      setAllowance(0n);
    }
  }, [account?.address]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const handleBuy = async () => {
    if (!account) { setStatus("Connect your wallet to buy."); return; }
    if (memeOut <= 0n || cost <= 0n) return;
    setBusy(true);
    setStatus("Checking $HASH allowance...");
    const isUserRejected = (e: any) =>
      /user (rejected|denied)|rejected the request|denied transaction signature|user rejected transaction/i.test(
        (e?.message || e?.reason || "") + ""
      );
    try {
      const needApprove = allowance === null || allowance < cost;
      if (needApprove) {
        setStatus("Approving $HASH for GemFun...");
        const approveTx = prepareContractCall({
          contract: hashContract(),
          method: "function approve(address,uint256)",
          params: [GEMFUN_ADDRESS, MAX_UINT_APPROVE],
        });
        await new Promise<void>((resolve, reject) =>
          sendTransaction(approveTx, { onSuccess: () => resolve(), onError: (err) => reject(err) })
        );
        setAllowance(MAX_UINT_APPROVE);
      }
      setStatus("");
      const buyTx = prepareContractCall({
        contract: gemContract(),
        method: "function buy(address,uint256,uint256)",
        params: [tokenAddress, memeOut, maxHashIn],
      });
      sendTransaction(buyTx, {
        onSuccess: async () => {
          setStatus("");
          setBusy(false);
          fetchWallet();
          router.refresh();
        },
        onError: (err) => {
          if (!isUserRejected(err)) setStatus(err.message);
          setBusy(false);
        },
      });
    } catch (e: any) {
      if (!isUserRejected(e)) setStatus(e.message);
      setBusy(false);
    }
  };

  const curveW = Math.min(100, tokenData.curvePct);
  const canBuy = tokenData.canBuy;
  const insufficient = balance !== null && cost > balance;

  const setPctFromPointer = useCallback((clientX: number) => {
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    let p = ((clientX - rect.left) / rect.width) * 100;
    p = Math.max(0, Math.min(100, p));
    setPct(Math.round(p * 10) / 10);
  }, []);

  return (
    <section className="mb-12 card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-dim)]">
        <span className="badge badge--blue">TGE</span>
        <div className="flex-1 progress">
          <div className="progress-fill progress-fill--blue" style={{ width: `${curveW}%` }} />
        </div>
        <span className="text-[11px] font-bold text-[var(--text-dim)]">{formatCompact(sold)} / {formatCompact(CURVE_SUPPLY)}</span>
      </div>

      <div className="p-4 flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          {tokenData.logoUrl ? (
            <div className="avatar avatar--md border border-[var(--border)]">
              <img src={tokenData.logoUrl} alt="" className="w-full h-full rounded-[12px] object-cover" />
            </div>
          ) : (
            <div className="avatar avatar--md bg-[var(--accent)] text-white font-bold text-[13px]">
              {tokenData.symbol.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <a href="https://hashcoin.farm/gem" target="_blank" rel="noopener noreferrer" className="block">
              <h4 className="text-[13px] font-bold tracking-tight truncate leading-tight hover:underline">
                {tokenData.name} <span className="text-[11px] text-[var(--text-dim)]">${tokenData.symbol}</span>
              </h4>
            </a>
            <a
              href={`https://basescan.org/address/${tokenAddress}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono text-[var(--blue)] hover:underline"
            >
              {shortAddress(tokenAddress)}
            </a>
          </div>
        </div>

        {canBuy ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="section-label text-[var(--text-faint)] shrink-0">Buy</span>
              <div
                ref={barRef}
                onPointerDown={e => {
                  if (busy || !account) return;
                  draggingRef.current = true;
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  setPctFromPointer(e.clientX);
                }}
                onPointerMove={e => { if (draggingRef.current) setPctFromPointer(e.clientX); }}
                onPointerUp={() => { draggingRef.current = false; }}
                onPointerCancel={() => { draggingRef.current = false; }}
                className="relative flex-1 h-8 flex items-center cursor-pointer select-none touch-none"
              >
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 progress">
                  <div className="progress-fill progress-fill--blue" style={{ width: `${pct}%` }} />
                </div>
                {account && balance !== null && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-bold bg-[var(--accent)]/80 text-white px-2 py-0.5 rounded-lg whitespace-nowrap">
                      {formatCompact(cost)} / {formatCompact(balance)} $HASH
                    </span>
                  </div>
                )}
                <div
                  className="absolute w-5 h-5 rounded-full border-[3px] border-[var(--blue)] bg-white shadow-sm pointer-events-none"
                  style={{ left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)" }}
                />
              </div>
              <span className="text-[11px] font-bold shrink-0 w-10 text-right">{pct}%</span>
            </div>
            {status && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-dim)] animate-in fade-in duration-300">
                <Loader2 size={11} className="animate-spin" /> {status}
              </div>
            )}
            {account ? (
              <button
                onClick={handleBuy}
                disabled={busy || memeOut <= 0n || insufficient}
                className={`btn btn--full ${insufficient ? "btn--danger" : "btn--primary"}`}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                {insufficient ? "Insufficient $HASH" : `Buy ${formatCompact(memeOut)} ${tokenData.symbol}`}
              </button>
            ) : (
              <div className="btn btn--ghost btn--full opacity-50 pointer-events-none">
                Connect wallet to buy
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--green)]">
            <CheckCircle2 size={13} />
            {tokenData.isMigrated ? "Migrated to Uniswap V3" : "Curve complete — TGE"}
          </div>
        )}
      </div>
    </section>
  );
}

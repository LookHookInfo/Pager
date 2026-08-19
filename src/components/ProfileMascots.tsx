"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall, toWei } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { ShoppingCart, Loader2, Zap, CheckCircle2, RefreshCw, UserCheck, Flame, Trash2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { getAuthMessage } from "@/lib/auth";

export default function ProfileMascots({ address }: { address: string }) {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const router = useRouter();

  const [mascots, setMascots] = useState<any[]>([]);
  const [activeMascotId, setActiveMascotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingActive, setIsSettingActive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [selectedMascot, setSelectedMascot] = useState<any>(null);
  const [articleCount, setArticleCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMascot?.creator) { setArticleCount(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase.from("articles").select("id", { count: "exact", head: true }).eq("author_address", address.toLowerCase());
        if (!cancelled) setArticleCount(count ?? 0);
      } catch { if (!cancelled) setArticleCount(0); }
    })();
    return () => { cancelled = true; };
  }, [selectedMascot?.creator, address]);

  const isOwner = account?.address?.toLowerCase() === address?.toLowerCase();

  const fetchAuthorMascots = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("ai_nft_token_id").eq("address", address.toLowerCase()).single();
      setActiveMascotId(profile?.ai_nft_token_id || null);

      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const mascotMap = new Map<number, any>();

      const { data: createdDnas } = await supabase
        .from("mascots_dna").select("*").eq("creator_address", address.toLowerCase())
        .eq("contract_address", MASCOTS_CONTRACT_ADDRESS.toLowerCase());

      if (createdDnas) {
        for (const dna of createdDnas) {
          mascotMap.set(dna.id, { ...dna, source: "created" });
        }
      }

      const { data: ownedDnas } = await supabase
        .from("mascots_dna").select("id, name, image_url, voice, personality, physical_desc").eq("contract_address", MASCOTS_CONTRACT_ADDRESS.toLowerCase());

      let ownedData: {
        tokenIds: readonly bigint[];
        balances: readonly bigint[];
        details: readonly (readonly [string, bigint, number, number, boolean])[];
      } | null = null;
      if (account?.address) {
        try {
          const result = await readContract({
            contract,
            method: "function getUserMascots(address) view returns (uint256[], uint256[], (address,uint256,uint32,uint32,bool)[])",
            params: [account.address],
          });
          ownedData = {
            tokenIds: result[0] as readonly bigint[],
            balances: result[1] as readonly bigint[],
            details: result[2] as readonly (readonly [string, bigint, number, number, boolean])[],
          };
        } catch {}
      }

      const ownedDetailsMap = new Map<number, { balance: bigint; detail: readonly [string, bigint, number, number, boolean] }>();
      const ownedTokenIds: number[] = [];
      if (ownedData) {
        for (let i = 0; i < ownedData.tokenIds.length; i++) {
          const id = Number(ownedData.tokenIds[i]);
          if (ownedData.details[i][4]) {
            ownedTokenIds.push(id);
            ownedDetailsMap.set(id, {
              balance: ownedData.balances[i],
              detail: ownedData.details[i],
            });
          }
        }
      }

      const ownedSet = new Set(ownedTokenIds);
      const neededIds = new Set([...mascotMap.keys(), ...ownedTokenIds]);
      if (!neededIds.size) { setMascots([]); setIsLoading(false); return; }

      if (ownedDnas) {
        for (const dna of ownedDnas) {
          if (ownedSet.has(dna.id) && !mascotMap.has(dna.id)) {
            mascotMap.set(dna.id, { ...dna, source: "owned" });
          }
        }
      }

      const mascotIds = [...mascotMap.keys()];
      const ownedIds = mascotIds.filter(id => ownedDetailsMap.has(id));
      const unknownIds = mascotIds.filter(id => !ownedDetailsMap.has(id));

      let unknownKeys = new Map<number, readonly [string, bigint, number, number, boolean]>();
      if (unknownIds.length > 0) {
        try {
          const batched = await Promise.allSettled(
            unknownIds.map(id =>
              readContract({
                contract,
                method: "function keys(uint256) view returns (address,uint256,uint32,uint32,bool)",
                params: [BigInt(id)],
              })
            )
          );
          batched.forEach((r, i) => {
            if (r.status === "fulfilled") {
              unknownKeys.set(unknownIds[i], r.value as readonly [string, bigint, number, number, boolean]);
            }
          });
        } catch {}
      }

      const foundMascots: any[] = [];

      for (const id of ownedIds) {
        const dna = mascotMap.get(id)!;
        const cached = ownedDetailsMap.get(id)!;
        const k = cached.detail;
        const isActive = k[4] && k[0] !== "0x0000000000000000000000000000000000000000";
        foundMascots.push({
          id, price: k[1], currentSupply: k[2], totalSold: k[3], maxSupply: 10000n, isActive, creator: k[0],
          metadata: { name: dna.name, image: dna.image_url, voice: dna.voice, personality: dna.personality, physical_desc: dna.physical_desc },
          owned: cached.balance > 0n,
          isCreator: dna.creator_address?.toLowerCase() === address.toLowerCase(),
        });
      }

      for (const id of unknownIds) {
        const dna = mascotMap.get(id)!;
        const k = unknownKeys.get(id);
        if (!k) continue;
        const isActive = k[4] && k[0] !== "0x0000000000000000000000000000000000000000";
        foundMascots.push({
          id, price: isActive ? k[1] : BigInt(toWei(dna.price || "101")),
          currentSupply: k[2], totalSold: k[3], maxSupply: 10000n, isActive, creator: k[0],
          metadata: { name: dna.name, image: dna.image_url, voice: dna.voice, personality: dna.personality, physical_desc: dna.physical_desc },
          owned: false, isCreator: dna.creator_address?.toLowerCase() === address.toLowerCase(),
        });
      }

      foundMascots.sort((a, b) => b.id - a.id);
      setMascots(foundMascots);
    } catch (err) {
      console.error("ProfileMascots error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address, account?.address]);

  useEffect(() => { fetchAuthorMascots(); }, [fetchAuthorMascots]);

  const handleSetActive = async (tokenId: number) => {
    if (!isOwner || !account) return;
    setIsSettingActive(true);
    setErrorMsg(null);
    try {
      const msg = getAuthMessage("update Pager profile", address.toLowerCase());
      const sig = await account.signMessage({ message: msg });
      const res = await fetch("/api/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ai_nft_token_id: String(tokenId), signature: sig, message: msg }),
      });
      if (!res.ok) {
        let errMsg = "Failed to update mascot";
        try { const errBody = await res.json(); errMsg = errBody.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      setActiveMascotId(String(tokenId));
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to change mascot");
    } finally { setIsSettingActive(false); }
  };

  const handleDeleteProtocol = async (tokenId: number) => {
    if (!account) return;
    if (!confirm("Permanently delete this protocol? Only possible if 0 keys sold.")) return;
    setBusyId(String(tokenId)); setStatusText("Deleting...");
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const tx = prepareContractCall({ contract, method: "function deleteMascot(uint256)", params: [BigInt(tokenId)] });
      sendTransaction(tx, {
        onSuccess: async () => {
          await supabase.from("mascots_dna").delete().eq("id", tokenId);
          setBusyId(null); setStatusText(""); fetchAuthorMascots();
        },
        onError: (err) => { setBusyId(null); setStatusText(""); setErrorMsg(err.message); },
      });
    } catch (e: any) { setBusyId(null); setStatusText(""); setErrorMsg(e.message); }
  };

  const handleDiscard = async (tokenId: number) => {
    if (!account) return;
    if (!confirm("Remove 1 Key from your wallet?")) return;
    setBusyId(String(tokenId)); setStatusText("Burning...");
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const tx = prepareContractCall({ contract, method: "function discardMascot(uint256)", params: [BigInt(tokenId)] });
      sendTransaction(tx, {
        onSuccess: () => { setBusyId(null); setStatusText(""); fetchAuthorMascots(); },
        onError: (err) => { setBusyId(null); setStatusText(""); setErrorMsg(err.message); },
      });
    } catch (e: any) { setBusyId(null); setStatusText(""); setErrorMsg(e.message); }
  };

  const handleIgniteMascot = async (tokenId: number, price: bigint) => {
    if (!isOwner) return;
    setBusyId(String(tokenId)); setStatusText("Approving...");
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const creationFee = await readContract({ contract, method: "function CREATION_FEE() view returns (uint256)", params: [] });
      const allowance = await readContract({ contract: hashContract, method: "function allowance(address,address) view returns (uint256)", params: [account?.address as any, MASCOTS_CONTRACT_ADDRESS as any] });

      if (allowance < creationFee) {
        setStatusText("Approving...");
        const approve = prepareContractCall({ contract: hashContract, method: "function approve(address,uint256)", params: [MASCOTS_CONTRACT_ADDRESS, creationFee] });
        await new Promise((res, rej) => sendTransaction(approve, { onSuccess: res, onError: rej }));
      }
      setStatusText("Forging...");
      const tx = prepareContractCall({ contract, method: "function createMascot(uint256)", params: [price] });
      sendTransaction(tx, {
        onSuccess: () => { setBusyId(null); setStatusText(""); notifyTelegram(tokenId); fetchAuthorMascots(); },
        onError: (err) => { setBusyId(null); setStatusText(""); setErrorMsg(err.message); },
      });
    } catch (e: any) { setBusyId(null); setStatusText(""); setErrorMsg(e.message); }
  };

  const notifyTelegram = async (tokenId: number) => {
    if (!account) return;
    try {
      const msg = getAuthMessage("notify mascot", account.address);
      const sig = await account.signMessage({ message: msg });
      await fetch("/api/notify/mascot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, address: account.address, signature: sig, message: msg }),
      });
    } catch {}
  };

  const handlePurchase = async (tokenId: number, price: bigint) => {
    if (!account) return;
    setBusyId(String(tokenId)); setStatusText("Approving...");
    try {
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const allowance = await readContract({ contract: hashContract, method: "function allowance(address,address) view returns (uint256)", params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any] });
      if (allowance < price) {
        const approve = prepareContractCall({ contract: hashContract, method: "function approve(address,uint256)", params: [MASCOTS_CONTRACT_ADDRESS, BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")] });
        await new Promise((res, rej) => sendTransaction(approve, { onSuccess: res, onError: rej }));
      }
      setStatusText("Minting...");
      const mint = prepareContractCall({ contract: getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any }), method: "function mintKey(uint256)", params: [BigInt(tokenId)] });
      sendTransaction(mint, {
        onSuccess: () => { setBusyId(null); setStatusText(""); fetchAuthorMascots(); },
        onError: (err) => { setBusyId(null); setStatusText(""); setErrorMsg(err.message); },
      });
    } catch (e: any) { setBusyId(null); setStatusText(""); setErrorMsg(e.message); }
  };

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  if (isLoading && !mascots.length) {
    return <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-[var(--text)]" size={20} /></div>;
  }
  if (!mascots.length) return null;

  return (
    <section className="mb-12">
      {errorMsg && (
        <div className="mb-4 toast toast--error">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-5">
        <h3 className="section-label">Mascots</h3>
        <button onClick={() => fetchAuthorMascots()} className="text-[10px] font-semibold text-[var(--text-faint)] hover:text-[var(--text)] flex items-center gap-1">
          <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} /> Sync
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {mascots.map(m => (
          <div key={m.id} className={`card overflow-hidden flex flex-col ${String(m.id) === activeMascotId ? "card--active" : ""}`}>
            <div className="aspect-square bg-[var(--surface-dim)] relative overflow-hidden cursor-pointer" onClick={() => setSelectedMascot(m)}>
              <img src={m.metadata.image} className={`w-full h-full object-cover transition-transform duration-700 ${m.isActive ? "group-hover:scale-105" : "grayscale opacity-50"}`} alt={m.metadata.name} />
              <div className="absolute top-2 right-2 badge badge--accent">{m.id}</div>
              {String(m.id) === activeMascotId && (
                <div className="absolute top-2 left-2 badge badge--yellow"><UserCheck size={10} /></div>
              )}
              {!m.isActive && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-[1px] p-2 text-center">
                  <span className="badge badge--accent">Forging...</span>
                  {isOwner && <button onClick={() => handleDeleteProtocol(m.id)} className="mt-2 p-1.5 text-white/50 hover:text-[var(--red)]"><Trash2 size={12} /></button>}
                </div>
              )}
              {busyId === String(m.id) && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5 z-20">
                  <Loader2 size={14} className="animate-spin text-[var(--text)]" />
                  <span className="badge badge--accent">{statusText}</span>
                </div>
              )}
            </div>
            <div className="p-3 flex flex-col flex-1 gap-2">
              <div className="flex items-center justify-between min-h-[20px]">
                <h4 className="text-[12px] font-bold tracking-tight truncate">{m.metadata.name}</h4>
                <span className="text-[10px] font-bold text-[var(--text-dim)]">{Math.floor(Number(m.price) / 1e18)} $HASH</span>
              </div>
              <div className="text-[10px] font-medium text-[var(--text-faint)]">
                {m.isActive ? `${m.totalSold} / ${Number(m.maxSupply)}` : "Genome"}
              </div>
              <div className="flex flex-col gap-1 mt-auto">
                {isOwner && !m.isActive ? (
                  <button onClick={() => handleIgniteMascot(m.id, m.price)} disabled={busyId !== null} className="btn btn--primary btn--sm btn--full">
                    <Flame size={10} /> Ignite
                  </button>
                ) : m.owned ? (
                  <div className="flex gap-1">
                    <button onClick={() => handleSetActive(m.id)} disabled={isSettingActive || String(m.id) === activeMascotId}
                      className={`flex-1 btn btn--sm ${String(m.id) === activeMascotId ? "btn--ghost opacity-50 cursor-default" : "btn--primary"}`}>
                      {String(m.id) === activeMascotId ? "Active" : "Select"}
                    </button>
                    <button onClick={() => handleDiscard(m.id)} disabled={busyId !== null || String(m.id) === activeMascotId}
                      className="btn btn--ghost btn--sm !p-1.5 text-[var(--text-faint)] hover:text-[var(--red)] disabled:opacity-30">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => handlePurchase(m.id, m.price)} disabled={busyId !== null || !m.isActive}
                      className="flex-1 btn btn--primary btn--sm">
                      <ShoppingCart size={10} /> Buy
                    </button>
                    {isOwner && m.totalSold === 0 && (
                      <button onClick={() => handleDeleteProtocol(m.id)} disabled={busyId !== null}
                        className="btn btn--ghost btn--sm !p-1.5 text-[var(--text-faint)] hover:text-[var(--red)]">
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedMascot && (() => {
        const priceNum = Math.floor(Number(selectedMascot.price) / 1e18);
        return (
          <div className="modal-overlay" onClick={() => setSelectedMascot(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="relative h-24 bg-[var(--surface-dim)] shrink-0">
                <button onClick={() => setSelectedMascot(null)} className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[var(--border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"><X size={14} /></button>
              </div>
              <div className="px-5 -mt-10 pb-5 flex flex-col items-center relative z-10">
                <div className="avatar avatar--lg border-4 border-[var(--surface)] shadow-md">
                  <img src={selectedMascot.metadata.image} className="w-full h-full object-cover" alt={selectedMascot.metadata.name} />
                </div>
                <h3 className="text-sm font-bold tracking-tight mt-3 text-center">{selectedMascot.metadata.name}</h3>
                <p className="text-[10px] font-medium text-[var(--text-dim)]">Protocol #{selectedMascot.id}</p>
                <div className="flex items-center gap-5 mt-4 py-3 border-y border-[var(--border)] w-full justify-center">
                  <div className="stat"><span className="stat-value">{selectedMascot.totalSold}</span><span className="stat-label">Holders</span></div>
                  <div className="stat"><span className="stat-value">{priceNum}</span><span className="stat-label">$HASH</span></div>
                  <div className="stat"><span className="stat-value">{Number(selectedMascot.totalSold)}/{Number(selectedMascot.maxSupply || 10000)}</span><span className="stat-label">Supply</span></div>
                  {articleCount !== null && <div className="stat"><span className="stat-value">{articleCount}</span><span className="stat-label">Stories</span></div>}
                </div>
              </div>
              <div className="border-t border-[var(--border)] overflow-y-auto max-h-[40vh] p-4 space-y-2">
                {selectedMascot.metadata.personality && (
                  <div className="dna-pill dna-pill--personality">{selectedMascot.metadata.personality}</div>
                )}
                {selectedMascot.metadata.voice && (
                  <div className="dna-pill dna-pill--voice">{selectedMascot.metadata.voice}</div>
                )}
                {selectedMascot.metadata.physical_desc && (
                  <div className="dna-pill dna-pill--physical">{selectedMascot.metadata.physical_desc}</div>
                )}
                {!selectedMascot.metadata.personality && !selectedMascot.metadata.voice && !selectedMascot.metadata.physical_desc && (
                  <p className="text-center text-[12px] text-[var(--text-faint)] py-4">No DNA data available.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

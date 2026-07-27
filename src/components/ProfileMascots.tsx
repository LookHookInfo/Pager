"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall, toWei } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { ShoppingCart, Loader2, Zap, CheckCircle2, RefreshCw, UserCheck, Flame, Trash2, X } from "lucide-react";
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

      // getUserMascots returns tokenIds + balances + details in ONE RPC call
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

      // Build owned lookup from single RPC response — saves N balanceOf + keys calls
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

      // Separate owned (have cached data) and unknown (need on-chain fetch)
      const ownedIds = mascotIds.filter(id => ownedDetailsMap.has(id));
      const unknownIds = mascotIds.filter(id => !ownedDetailsMap.has(id));

      // Batch fetch unknown keys — single RPC for all non-owned tokens
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

      // Owned tokens — data already cached from getUserMascots (NO extra RPC)
      for (const id of ownedIds) {
        const dna = mascotMap.get(id)!;
        const cached = ownedDetailsMap.get(id)!;
        const k = cached.detail;
        const isActive = k[4] && k[0] !== "0x0000000000000000000000000000000000000000";
        foundMascots.push({
          id,
          price: k[1],
          currentSupply: k[2], totalSold: k[3], maxSupply: 10000n, isActive, creator: k[0],
          metadata: { name: dna.name, image: dna.image_url, voice: dna.voice, personality: dna.personality, physical_desc: dna.physical_desc },
          owned: cached.balance > 0n,
          isCreator: dna.creator_address?.toLowerCase() === address.toLowerCase(),
        });
      }

      // Unknown tokens — already batched above (1 RPC total)
      for (const id of unknownIds) {
        const dna = mascotMap.get(id)!;
        const k = unknownKeys.get(id);
        if (!k) continue;
        const isActive = k[4] && k[0] !== "0x0000000000000000000000000000000000000000";
        foundMascots.push({
          id,
          price: isActive ? k[1] : BigInt(toWei(dna.price || "101")),
          currentSupply: k[2], totalSold: k[3], maxSupply: 10000n, isActive, creator: k[0],
          metadata: { name: dna.name, image: dna.image_url, voice: dna.voice, personality: dna.personality, physical_desc: dna.physical_desc },
          owned: false,
          isCreator: dna.creator_address?.toLowerCase() === address.toLowerCase(),
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
    try {
      const msg = getAuthMessage("update Pager profile", address.toLowerCase());
      const sig = await account.signMessage({ message: msg });
      await fetch("/api/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ai_nft_token_id: String(tokenId), signature: sig, message: msg }),
      });
      setActiveMascotId(String(tokenId));
      router.refresh();
    } catch (e) { console.error(e); } finally { setIsSettingActive(false); }
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
        onError: (err) => { alert(err.message); setBusyId(null); setStatusText(""); },
      });
    } catch (e: any) { alert(e.message); setBusyId(null); setStatusText(""); }
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
        onError: (err) => { alert(err.message); setBusyId(null); setStatusText(""); },
      });
    } catch (e: any) { alert(e.message); setBusyId(null); setStatusText(""); }
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
        setStatusText("Approving Fee...");
        const approve = prepareContractCall({ contract: hashContract, method: "function approve(address,uint256)", params: [MASCOTS_CONTRACT_ADDRESS, creationFee] });
        await new Promise((res, rej) => sendTransaction(approve, { onSuccess: res, onError: rej }));
      }
      setStatusText("Forging...");
      const tx = prepareContractCall({ contract, method: "function createMascot(uint256)", params: [price] });
      sendTransaction(tx, {
        onSuccess: () => { setBusyId(null); setStatusText(""); fetchAuthorMascots(); },
        onError: (err) => { alert(err.message); setBusyId(null); setStatusText(""); },
      });
    } catch (e: any) { alert(e.message); setBusyId(null); setStatusText(""); }
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
        onError: (err) => { alert(err.message); setBusyId(null); setStatusText(""); },
      });
    } catch (e: any) { alert(e.message); setBusyId(null); setStatusText(""); }
  };

  if (isLoading && !mascots.length) {
    return <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-black" size={24} /></div>;
  }
  if (!mascots.length) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-yellow-400 fill-yellow-400" />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Mascots</h3>
        </div>
        <button onClick={() => fetchAuthorMascots()} className="text-[8px] font-black uppercase text-gray-400 hover:text-black flex items-center gap-1">
          <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} /> Sync
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {mascots.map(m => (
          <div key={m.id} className={`group relative bg-white border rounded-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg ${String(m.id) === activeMascotId ? "border-yellow-400 border-2 shadow-md" : "border-gray-100"}`}>
            <div className="aspect-square bg-gray-50 relative overflow-hidden cursor-pointer" onClick={() => setSelectedMascot(m)}>
              <img src={m.metadata.image} className={`w-full h-full object-cover transition-transform duration-700 ${m.isActive ? "group-hover:scale-110" : "grayscale opacity-50"}`} alt={m.metadata.name} />
              <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm z-10">#{m.id}</div>
              {String(m.id) === activeMascotId && <div className="absolute top-2 left-2 bg-yellow-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm z-10"><UserCheck size={10} /></div>}
              {m.owned && !busyId && <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><CheckCircle2 size={24} className="text-white drop-shadow-lg" /></div>}
              {!m.isActive && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-[1px] p-2 text-center">
                  <span className="text-white text-[8px] font-black uppercase tracking-widest bg-black/50 px-2 py-1 mb-1">Forging...</span>
                  {isOwner && <button onClick={() => handleDeleteProtocol(m.id)} className="p-2 text-white/50 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              )}
              {busyId === String(m.id) && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                  <Loader2 size={16} className="animate-spin text-black" />
                  <span className="text-[8px] font-black uppercase">{statusText}</span>
                </div>
              )}
            </div>
            <div className="p-3 flex flex-col flex-1 gap-2">
              <div className="min-h-[32px]">
                <h4 className="text-[10px] font-black uppercase leading-tight line-clamp-1">{m.metadata.name}</h4>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[8px] font-bold text-gray-400">{m.isActive ? `${m.totalSold}/${Number(m.maxSupply)}` : "GENOME"}</span>
                  <span className="text-[8px] font-black text-black">{Math.floor(Number(m.price) / 1e18)} $HASH</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-auto">
                {isOwner && !m.isActive ? (
                  <button onClick={() => handleIgniteMascot(m.id, m.price)} disabled={busyId !== null} className="w-full py-2 bg-yellow-400 text-black text-[8px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-all flex items-center justify-center gap-1">
                    <Flame size={10} /> Ignite Key
                  </button>
                ) : m.owned ? (
                  <div className="flex gap-1">
                    <button onClick={() => handleSetActive(m.id)} disabled={isSettingActive || String(m.id) === activeMascotId} className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${String(m.id) === activeMascotId ? "bg-gray-100 text-gray-400 cursor-default" : "bg-black text-white hover:bg-gray-800"}`}>
                      {String(m.id) === activeMascotId ? "Active" : "Select"}
                    </button>
                    <button onClick={() => handleDiscard(m.id)} disabled={busyId !== null || String(m.id) === activeMascotId} className="p-2 border border-gray-100 rounded-sm text-gray-300 hover:text-red-500 hover:border-red-100 disabled:opacity-30"><Trash2 size={12} /></button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => handlePurchase(m.id, m.price)} disabled={busyId !== null || !m.isActive} className="flex-1 py-2 bg-black text-white text-[8px] font-black uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-1">
                      <ShoppingCart size={10} /> Buy Access
                    </button>
                    {isOwner && m.totalSold === 0 && (
                      <button onClick={() => handleDeleteProtocol(m.id)} disabled={busyId !== null} className="p-2 border border-gray-100 rounded-sm text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
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
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={() => setSelectedMascot(null)}>
            <div className="relative w-full sm:max-w-md max-h-[90vh] bg-white sm:rounded-sm rounded-t-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="h-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black relative shrink-0">
                <button onClick={() => setSelectedMascot(null)} className="absolute top-3 right-3 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"><X size={14} /></button>
              </div>
              <div className="px-5 -mt-10 pb-5 flex flex-col items-center relative z-10">
                <img src={selectedMascot.metadata.image} className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-lg" alt={selectedMascot.metadata.name} />
                <h3 className="text-sm font-black uppercase tracking-tight mt-3 text-center">{selectedMascot.metadata.name}</h3>
                <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mt-0.5">Protocol #{selectedMascot.id}</p>
                <div className="flex items-center gap-6 mt-4 py-3 border-y border-gray-100 w-full justify-center">
                  <div className="text-center"><span className="text-sm font-black block">{selectedMascot.totalSold}</span><span className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Holders</span></div>
                  <div className="text-center"><span className="text-sm font-black block">{priceNum}</span><span className="text-[7px] font-black uppercase text-gray-400 tracking-widest">$HASH</span></div>
                  <div className="text-center"><span className="text-sm font-black block">{Number(selectedMascot.totalSold)}/{Number(selectedMascot.maxSupply || 10000)}</span><span className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Supply</span></div>
                  {articleCount !== null && <div className="text-center"><span className="text-sm font-black block">{articleCount}</span><span className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Stories</span></div>}
                </div>
              </div>
              <div className="border-t border-gray-100 overflow-y-auto max-h-[40vh]">
                {selectedMascot.metadata.personality && (
                  <div className="px-5 py-4 border-b border-gray-50">
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-blue-500 tracking-widest mb-2"><span className="w-1 h-1 bg-blue-500 rounded-full" /> Personality</div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{selectedMascot.metadata.personality}</p>
                  </div>
                )}
                {selectedMascot.metadata.voice && (
                  <div className="px-5 py-4 border-b border-gray-50">
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-purple-500 tracking-widest mb-2"><span className="w-1 h-1 bg-purple-500 rounded-full" /> Voice</div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{selectedMascot.metadata.voice}</p>
                  </div>
                )}
                {selectedMascot.metadata.physical_desc && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-green-500 tracking-widest mb-2"><span className="w-1 h-1 bg-green-500 rounded-full" /> Physical DNA</div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{selectedMascot.metadata.physical_desc}</p>
                  </div>
                )}
                {!selectedMascot.metadata.personality && !selectedMascot.metadata.voice && !selectedMascot.metadata.physical_desc && (
                  <div className="px-5 py-6 text-center"><p className="text-[10px] text-gray-300 italic">No DNA data available for this protocol.</p></div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

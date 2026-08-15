"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall, toWei } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { ShoppingCart, Loader2, Zap, CheckCircle2, RefreshCw, Info, Trash2, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAuthMessage } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProfileForge from "@/components/ProfileForge";

export default function MascotsPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();

  const [mascots, setMascots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showForge, setShowForge] = useState(false);

  const [forgeData, setForgeData] = useState({
    name: "", personality: "", voice: "", visual_desc: "", image_url: "", price: "",
  });
  const [isForging, setIsForging] = useState(false);
  const [isAnalyzingDna, setIsAnalyzingDna] = useState(false);
  const [forgeErrors, setForgeErrors] = useState<string[]>([]);
  const [selectedMascot, setSelectedMascot] = useState<any>(null);
  const [articleCount, setArticleCount] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedMascot?.creator) { setArticleCount(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase.from("articles").select("id", { count: "exact", head: true }).eq("author_address", selectedMascot.creator.toLowerCase());
        if (!cancelled) setArticleCount(count ?? 0);
      } catch { if (!cancelled) setArticleCount(0); }
    })();
    return () => { cancelled = true; };
  }, [selectedMascot?.creator]);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
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
    } catch (e: any) {
      console.warn("TG notification skipped:", e?.message);
    }
  };

  const fetchAllMascots = useCallback(async () => {
    setIsLoading(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });

      const result = await readContract({
        contract,
        method: "function getActiveMascots(uint256,uint256) view returns (uint256[], (address,uint256,uint32,uint32,bool)[], uint256)",
        params: [0n, 100n],
      });

      const [activeTokenIds, details] = result;
      if (activeTokenIds.length === 0) { setMascots([]); setIsLoading(false); return; }

      const numericIds = activeTokenIds.map(id => Number(id));

      const { data: dnas } = await supabase
        .from("mascots_dna").select("id, name, image_url, voice, personality, physical_desc")
        .in("id", numericIds)
        .eq("contract_address", MASCOTS_CONTRACT_ADDRESS.toLowerCase());

      const dnaMap = new Map(dnas?.map(d => [d.id, d]) || []);

      let ownedBalances = new Map<number, boolean>();
      if (account?.address && numericIds.length > 0) {
        try {
          const balances = await readContract({
            contract,
            method: "function balanceOfBatch(address[],uint256[]) view returns (uint256[])",
            params: [numericIds.map(() => account.address), numericIds.map(BigInt)],
          });
          ownedBalances = new Map(numericIds.map((id, i) => [id, balances[i] > 0n]));
        } catch {}
      }

      const foundMascots = activeTokenIds.map((tokenId, i) => {
        const detail = details[i];
        const numId = Number(tokenId);
        const dna = dnaMap.get(numId);
        return {
          id: numId, creator: detail[0], price: detail[1],
          currentSupply: detail[2], totalSold: detail[3], isActive: detail[4],
          metadata: dna
            ? { name: dna.name, image: dna.image_url, voice: dna.voice, personality: dna.personality, physical_desc: dna.physical_desc }
            : { name: `Protocol #${numId}`, image: "/logo-pager.png", voice: "Genome encrypted.", personality: "", physical_desc: "" },
          owned: ownedBalances.get(numId) || false,
        };
      });

      setMascots(foundMascots);
    } catch (err) {
      console.error("Market error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [account?.address]);

  useEffect(() => { fetchAllMascots(); }, [fetchAllMascots]);

  const handleDiscard = async (tokenId: number) => {
    if (!account) { alert("Connect wallet"); return; }
    if (!confirm("Remove your key for this mascot?")) return;
    setBusyId(String(tokenId));
    setStatusText("Burning...");
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const tx = prepareContractCall({ contract, method: "function discardMascot(uint256)", params: [BigInt(tokenId)] });
      sendTransaction(tx, {
        onSuccess: () => {
          setMascots(prev => prev.map(m => m.id === tokenId ? { ...m, owned: false, totalSold: Number(m.totalSold) - 1 } : m));
          setBusyId(null); setStatusText("");
        },
        onError: (err) => { alert(err.message); setBusyId(null); setStatusText(""); },
      });
    } catch (e: any) { alert(e.message); setBusyId(null); setStatusText(""); }
  };

  const handlePurchase = async (tokenId: number, price: bigint) => {
    if (!account) { alert("Connect wallet"); return; }
    setBusyId(String(tokenId));
    try {
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const allowance = await readContract({ contract: hashContract, method: "function allowance(address,address) view returns (uint256)", params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any] });

      if (allowance < price) {
        setStatusText("Approval...");
        const approve = prepareContractCall({ contract: hashContract, method: "function approve(address,uint256)", params: [MASCOTS_CONTRACT_ADDRESS, BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")] });
        await new Promise((res, rej) => sendTransaction(approve, { onSuccess: res, onError: rej }));
      }

      setStatusText("Minting...");
      const mint = prepareContractCall({
        contract: getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any }),
        method: "function mintKey(uint256 _tokenId)", params: [BigInt(tokenId)],
      });

      sendTransaction(mint, {
        onSuccess: () => {
          setMascots(prev => prev.map(m => m.id === tokenId ? { ...m, owned: true, totalSold: Number(m.totalSold) + 1 } : m));
          setBusyId(null); setStatusText("");
        },
        onError: (err) => { alert(err.message); setBusyId(null); setStatusText(""); },
      });
    } catch (e: any) { setBusyId(null); setStatusText(""); alert(e.message); }
  };

  const handleMascotImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !account) return;
    setIsForging(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setForgeData(prev => ({ ...prev, image_url: data.url }));

      setIsAnalyzingDna(true);
      try {
        const scan = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: data.url, userAddress: account.address }),
        });
        const scanData = await scan.json();
        if (!scan.ok) {
          notify("AI DNA scan unavailable — fill fields manually", "error");
        } else if (scanData.personality || scanData.visual) {
          setForgeData(prev => ({
            ...prev, image_url: data.url,
            personality: scanData.personality || prev.personality,
            voice: scanData.voice || prev.voice,
            visual_desc: scanData.visual || prev.visual_desc,
          }));
          notify("DNA extracted from image", "success");
        }
      } catch {
        notify("AI DNA scan unavailable — fill fields manually", "error");
      }
      setIsAnalyzingDna(false);
    } catch (e: any) { notify(e.message, "error"); } finally { setIsForging(false); setIsAnalyzingDna(false); }
  };

  const handleForge = async () => {
    if (!account) { notify("Connect wallet", "error"); return; }
    const errors: string[] = [];
    if (!forgeData.image_url) errors.push("image");
    if (!forgeData.name) errors.push("name");
    if (!forgeData.personality) errors.push("personality");
    if (!forgeData.price || +forgeData.price <= 0) errors.push("price");
    if (errors.length) { setForgeErrors(errors); notify("Fill required fields", "error"); return; }
    setForgeErrors([]);
    setIsForging(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });

      const tokenId = Number(await readContract({ contract, method: "function nextTokenId() view returns (uint256)", params: [] }));

      const { error: dbError } = await supabase.from("mascots_dna").upsert([{
        id: tokenId, name: forgeData.name, personality: forgeData.personality,
        voice: forgeData.voice || forgeData.personality, physical_desc: forgeData.visual_desc,
        image_url: forgeData.image_url, creator_address: account.address.toLowerCase(),
        price: forgeData.price, max_supply: 10000, contract_address: MASCOTS_CONTRACT_ADDRESS.toLowerCase(),
      }], { onConflict: "id" });

      if (dbError) throw dbError;

      const creationFee = await readContract({ contract, method: "function CREATION_FEE() view returns (uint256)", params: [] });
      const allowance = await readContract({ contract: hashContract, method: "function allowance(address,address) view returns (uint256)", params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any] });

      if (allowance < creationFee) {
        const approve = prepareContractCall({ contract: hashContract, method: "function approve(address,uint256)", params: [MASCOTS_CONTRACT_ADDRESS, creationFee] });
        await new Promise((res, rej) => sendTransaction(approve, { onSuccess: res, onError: rej }));
      }

      const tx = prepareContractCall({ contract, method: "function createMascot(uint256)", params: [BigInt(toWei(forgeData.price))] });
      sendTransaction(tx, {
        onSuccess: () => {
          notify("Protocol activated!");
          notifyTelegram(tokenId);
          setForgeData({ name: "", personality: "", voice: "", visual_desc: "", image_url: "", price: "" });
          fetchAllMascots();
          setIsForging(false);
          setShowForge(false);
        },
        onError: (err) => { notify(err.message, "error"); setIsForging(false); },
      });
    } catch (e: any) { notify(e.message, "error"); setIsForging(false); }
  };

  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-sm shadow-2xl border-l-4 animate-in slide-in-from-top-4 duration-300 flex items-center gap-4 ${notification.type === "success" ? "bg-black text-white border-green-500" : "bg-red-600 text-white border-red-800"}`}>
          {notification.type === "success" ? <CheckCircle2 size={20} /> : <Zap size={20} />}
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Protocol</span>
            <span className="text-sm font-bold">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-10 py-12">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-400">
              <Zap size={16} className="fill-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black">Live Protocols</span>
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Mascot Market</h1>
            <p className="text-sm text-gray-500 max-w-lg font-medium">
              Acquire NFT Keys to unlock unique AI voices and visual styles.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {account && (
              <button onClick={() => setShowForge(!showForge)}
                className="text-[9px] font-black uppercase tracking-widest text-white bg-black hover:bg-gray-800 flex items-center gap-2 px-4 py-2.5 rounded-sm shadow-lg transition-all">
                <Plus size={12} /> {showForge ? "Close Forge" : "Create Mascot"}
              </button>
            )}
            <button onClick={fetchAllMascots} className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-sm border border-gray-100">
              <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} />
              {isLoading ? "Syncing..." : `${mascots.length} Protocols`}
            </button>
          </div>
        </header>

        {showForge && account && (
          <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-300">
            <ProfileForge
              forgeData={forgeData}
              isForging={isForging}
              isAnalyzingDna={isAnalyzingDna}
              forgeErrors={forgeErrors}
              onMascotImageUpload={handleMascotImageUpload}
              onForgeDataChange={setForgeData}
              onForge={handleForge}
            />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {mascots.map(m => (
            <div key={m.id} className="group bg-white border border-gray-100 rounded-sm overflow-hidden flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
              <div className="aspect-square bg-gray-50 relative overflow-hidden cursor-pointer" onClick={() => setSelectedMascot(m)}>
                <img src={m.metadata.image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={m.metadata.name} />
                <div className="absolute top-2 right-2 bg-black text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm shadow-xl z-10">Mascot #{m.id}</div>
                {m.owned && (
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black text-white text-[8px] font-black uppercase px-2 py-1 flex items-center gap-1.5 shadow-2xl"><CheckCircle2 size={10} className="text-green-500" /> Active</div>
                    <button onClick={(e) => { e.stopPropagation(); handleDiscard(m.id); }} disabled={busyId !== null}
                      className="absolute bottom-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-sm shadow-xl transition-all disabled:opacity-50">
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <p className="text-white text-[8px] font-bold leading-relaxed italic line-clamp-2">&ldquo;{m.metadata.voice}&rdquo;</p>
                </div>
                {busyId === String(m.id) && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                    <Loader2 size={20} className="animate-spin text-black" />
                    <span className="text-[8px] font-black uppercase">{statusText}</span>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col flex-1 gap-4">
                <div className="min-h-[40px]">
                  <h3 className="text-sm font-black uppercase tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">{m.metadata.name}</h3>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">By {m.creator.slice(0, 4)}...{m.creator.slice(-4)}</p>
                </div>
                <div className="flex items-center justify-between py-3 border-y border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-gray-400">Minted</span>
                    <span className="text-[10px] font-black">{m.totalSold}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[7px] font-black uppercase text-gray-400">Access</span>
                    <span className="text-[10px] font-black text-black">{Math.floor(Number(m.price) / 1e18)} $HASH</span>
                  </div>
                </div>
                <button onClick={() => handlePurchase(m.id, m.price)} disabled={busyId !== null || m.owned}
                  className={`w-full py-3 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${m.owned ? "bg-gray-50 text-gray-300" : "bg-black text-white hover:bg-gray-800 shadow-md"}`}>
                  {m.owned ? <><CheckCircle2 size={12} /> Unlocked</> : <><ShoppingCart size={12} /> Acquire Key</>}
                </button>
              </div>
            </div>
          ))}
        </div>

        {!isLoading && mascots.length === 0 && (
          <div className="h-64 border border-dashed border-gray-100 rounded-sm flex flex-col items-center justify-center text-center p-12 gap-3 mt-12">
            <Info size={32} className="text-gray-200" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Network Empty</p>
          </div>
        )}
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
                {!selectedMascot.owned ? (
                  <button onClick={() => { setSelectedMascot(null); handlePurchase(selectedMascot.id, selectedMascot.price); }} disabled={busyId !== null || !selectedMascot.isActive} className="w-full mt-4 bg-black text-white py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md rounded-sm"><ShoppingCart size={12} /> Acquire Key</button>
                ) : (
                  <div className="w-full mt-4 bg-gray-50 text-gray-400 py-2.5 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-sm border border-gray-100"><CheckCircle2 size={12} className="text-green-500" /> Key Unlocked</div>
                )}
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
    </main>
  );
}

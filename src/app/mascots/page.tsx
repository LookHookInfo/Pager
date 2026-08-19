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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(t);
  }, [errorMsg]);

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
    setTimeout(() => setNotification(null), 4000);
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
    if (!account) return;
    if (!confirm("Remove your key for this mascot?")) return;
    setBusyId(String(tokenId)); setStatusText("Burning...");
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const tx = prepareContractCall({ contract, method: "function discardMascot(uint256)", params: [BigInt(tokenId)] });
      sendTransaction(tx, {
        onSuccess: () => {
          setMascots(prev => prev.map(m => m.id === tokenId ? { ...m, owned: false, totalSold: Number(m.totalSold) - 1 } : m));
          setBusyId(null); setStatusText("");
        },
        onError: (err) => { setBusyId(null); setStatusText(""); setErrorMsg(err.message); },
      });
    } catch (e: any) { setBusyId(null); setStatusText(""); setErrorMsg(e.message); }
  };

  const handlePurchase = async (tokenId: number, price: bigint) => {
    if (!account) return;
    setBusyId(String(tokenId));
    try {
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const allowance = await readContract({ contract: hashContract, method: "function allowance(address,address) view returns (uint256)", params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any] });

      if (allowance < price) {
        setStatusText("Approving...");
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
        onError: (err) => { setBusyId(null); setStatusText(""); setErrorMsg(err.message); },
      });
    } catch (e: any) { setBusyId(null); setStatusText(""); setErrorMsg(e.message); }
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
    <main className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      {notification && (
        <div className={`toast ${notification.type === "success" ? "toast--success" : "toast--error"}`}>
          {notification.type === "success" ? <CheckCircle2 size={16} /> : <Zap size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {errorMsg && (
        <div className="toast toast--error" onClick={() => setErrorMsg(null)}>
          <Zap size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="section-label text-[var(--blue)]">Live Protocols</span>
            <h1 className="text-3xl font-black tracking-tight">Mascot Market</h1>
            <p className="text-[13px] text-[var(--text-dim)] max-w-md">
              Acquire NFT Keys to unlock unique AI voices and visual styles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {account && (
              <button onClick={() => setShowForge(!showForge)} className="btn btn--primary btn--sm">
                <Plus size={12} /> {showForge ? "Close" : "Create"}
              </button>
            )}
            <button onClick={fetchAllMascots} className="btn btn--ghost btn--sm">
              <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} />
              {isLoading ? "Sync..." : `${mascots.length}`}
            </button>
          </div>
        </header>

        {showForge && account && (
          <div className="mb-10 animate-in fade-in duration-300">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {mascots.map(m => (
            <div key={m.id} className="card overflow-hidden flex flex-col group">
              <div className="aspect-square bg-[var(--surface-dim)] relative overflow-hidden cursor-pointer" onClick={() => setSelectedMascot(m)}>
                <img src={m.metadata.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={m.metadata.name} />
                <div className="absolute top-2 right-2 badge badge--accent">#{m.id}</div>
                {m.owned && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="badge badge--green"><CheckCircle2 size={10} /> Owned</div>
                    <button onClick={(e) => { e.stopPropagation(); handleDiscard(m.id); }} disabled={busyId !== null}
                      className="absolute bottom-2 right-2 w-6 h-6 bg-[var(--red)] text-white rounded-lg flex items-center justify-center disabled:opacity-50">
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <p className="text-white text-[11px] font-medium leading-relaxed line-clamp-2">&ldquo;{m.metadata.voice}&rdquo;</p>
                </div>
                {busyId === String(m.id) && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5 z-20">
                    <Loader2 size={16} className="animate-spin text-[var(--text)]" />
                    <span className="badge badge--accent">{statusText}</span>
                  </div>
                )}
              </div>

              <div className="p-3 flex flex-col flex-1 gap-2.5">
                <div>
                  <h3 className="text-[13px] font-bold tracking-tight truncate">{m.metadata.name}</h3>
                  <p className="text-[10px] font-medium text-[var(--text-dim)]">{m.creator.slice(0, 4)}...{m.creator.slice(-4)}</p>
                </div>
                <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-dim)]">
                  <span>{m.totalSold} minted</span>
                  <span className="font-bold text-[var(--text)]">{Math.floor(Number(m.price) / 1e18)} $HASH</span>
                </div>
                <button onClick={() => handlePurchase(m.id, m.price)} disabled={busyId !== null || m.owned}
                  className={`btn btn--sm btn--full ${m.owned ? "btn--ghost opacity-50" : "btn--primary"}`}>
                  {m.owned ? <><CheckCircle2 size={10} /> Owned</> : <><ShoppingCart size={10} /> Acquire</>}
                </button>
              </div>
            </div>
          ))}
        </div>

        {!isLoading && mascots.length === 0 && (
          <div className="h-48 border border-dashed border-[var(--border)] rounded-xl flex flex-col items-center justify-center gap-2">
            <Info size={24} className="text-[var(--text-faint)]" />
            <p className="section-label">Network Empty</p>
          </div>
        )}
      </div>

      {selectedMascot && (() => {
        const priceNum = Math.floor(Number(selectedMascot.price) / 1e18);
        return (
          <div className="modal-overlay" onClick={() => setSelectedMascot(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="relative h-24 bg-[var(--surface-dim)] shrink-0">
                <button onClick={() => setSelectedMascot(null)} className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[var(--border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)]"><X size={14} /></button>
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
                {!selectedMascot.owned ? (
                  <button onClick={() => { setSelectedMascot(null); handlePurchase(selectedMascot.id, selectedMascot.price); }}
                    disabled={busyId !== null || !selectedMascot.isActive}
                    className="w-full mt-4 btn btn--primary btn--full">
                    <ShoppingCart size={12} /> Acquire Key
                  </button>
                ) : (
                  <div className="w-full mt-4 btn btn--ghost btn--full opacity-50">
                    <CheckCircle2 size={12} /> Unlocked
                  </div>
                )}
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
    </main>
  );
}

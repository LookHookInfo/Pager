"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { ShoppingCart, Loader2, Zap, CheckCircle2, RefreshCw, Info, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function MascotsPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();

  const [mascots, setMascots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");

  const fetchAllMascots = useCallback(async () => {
    setIsLoading(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });

      const result = await readContract({
        contract,
        method: "function getAllMascots(uint256,uint256) view returns (uint256[], (address,uint256,uint32,uint32,bool)[], uint256)",
        params: [0n, 100n],
      });

      const [tokenIds, details] = result;

      const activeTokenIds = tokenIds.filter((_, i) => details[i][4]);
      if (activeTokenIds.length === 0) { setMascots([]); setIsLoading(false); return; }

      const numericIds = activeTokenIds.map(id => Number(id));

      const { data: dnas } = await supabase
        .from("mascots_dna").select("id, name, image_url, voice")
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
        const idx = tokenIds.indexOf(tokenId);
        const detail = details[idx];
        const numId = Number(tokenId);
        const dna = dnaMap.get(numId);
        return {
          id: numId, creator: detail[0], price: detail[1],
          currentSupply: detail[2], totalSold: detail[3], isActive: detail[4],
          metadata: dna
            ? { name: dna.name, image: dna.image_url, voice: dna.voice }
            : { name: `Protocol #${numId}`, image: "/logo-pager.png", voice: "Genome encrypted." },
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

  return (
    <main className="min-h-screen bg-white">
      <Navbar />

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
          <button onClick={fetchAllMascots} className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-sm border border-gray-100">
            <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} />
            {isLoading ? "Syncing..." : `${mascots.length} Protocols`}
          </button>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {mascots.map(m => (
            <div key={m.id} className="group bg-white border border-gray-100 rounded-sm overflow-hidden flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
              <div className="aspect-square bg-gray-50 relative overflow-hidden">
                <img src={m.metadata.image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={m.metadata.name} />
                <div className="absolute top-2 right-2 bg-black text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm shadow-xl z-10">KEY #{m.id}</div>
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

      <Footer />
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall, toWei } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { ShoppingCart, Loader2, Zap, CheckCircle2, RefreshCw, Search, Filter, Flame, Info, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * MASCOTS MARKET PAGE - COMPACT V3 (NORMALIZED)
 * Shows all active mascots from the blockchain.
 * Uses "Safe Sync" sequential loading.
 */

export default function MascotsPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  
  const [mascots, setMascots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("");
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  const fetchAllMascots = useCallback(async () => {
    setIsLoading(true);
    try {
      const contract = getContract({ 
        client, 
        chain: base, 
        address: MASCOTS_CONTRACT_ADDRESS, 
        abi: MASCOTS_ABI as any 
      });

      const result = await readContract({ 
        contract, 
        method: "function getAllMascots(uint256,uint256) view returns (uint256[], (address,uint256,uint32,uint32,bool)[], uint256)", 
        params: [0n, 100n] 
      });

      const [tokenIds, details, total] = result;
      const totalCount = Number(total);
      setSyncProgress({ current: 0, total: totalCount });

      const foundMascots = [];

      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        const detail = details[i];
        setSyncProgress(prev => ({ ...prev, current: i + 1 }));

        if (!detail[4]) continue;

        // NORMALIZATION: Filter by current contract_address
        const { data: dna } = await supabase
          .from('mascots_dna')
          .select('*')
          .eq('id', Number(tokenId))
          .eq('contract_address', MASCOTS_CONTRACT_ADDRESS.toLowerCase())
          .maybeSingle();

        let balance = 0n;
        if (account?.address) {
          balance = await readContract({ 
            contract, 
            method: "function balanceOf(address, uint256) view returns (uint256)", 
            params: [account.address, tokenId] 
          });
        }

        foundMascots.push({
          id: Number(tokenId),
          creator: detail[0],
          price: detail[1],
          currentSupply: detail[2],
          totalSold: detail[3],
          isActive: detail[4],
          metadata: dna ? {
            name: dna.name,
            image: dna.image_url,
            voice: dna.voice
          } : {
            name: `Protocol #${tokenId}`,
            image: "/logo-pager.png",
            voice: "Genome encrypted. Please forge DNA."
          },
          owned: balance > 0n
        });

        if (tokenIds.length > 5 && i < tokenIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setMascots(foundMascots);
    } catch (err) {
      console.error("❌ [Market] Error:", err);
    } finally {
      setIsLoading(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  }, [account?.address]);

  useEffect(() => {
    fetchAllMascots();
  }, [fetchAllMascots]);

  const handlePurchase = async (tokenId: number, price: bigint) => {
    if (!account) return alert("Connect wallet to purchase");
    
    setBusyId(String(tokenId));
    
    try {
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      
      setStatusText("Permission...");
      const currentAllowance = await readContract({
        contract: hashContract,
        method: "function allowance(address,address) view returns (uint256)",
        params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any]
      });

      if (currentAllowance < price) {
        setStatusText("Approval...");
        const approveTx = prepareContractCall({
          contract: hashContract,
          method: "function approve(address spender, uint256 value)",
          params: [MASCOTS_CONTRACT_ADDRESS, BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")]
        });
        
        await new Promise((resolve, reject) => {
          sendTransaction(approveTx, {
            onSuccess: () => resolve(true),
            onError: (err) => reject(err)
          });
        });
      }

      setStatusText("Minting Key...");
      const mintTx = prepareContractCall({
        contract: getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any }),
        method: "function mintKey(uint256 _tokenId)",
        params: [BigInt(tokenId)],
      });

      sendTransaction(mintTx, {
        onSuccess: () => {
          setMascots(prev => prev.map(m => m.id === tokenId ? { ...m, owned: true, totalSold: Number(m.totalSold) + 1 } : m));
          alert("Key acquired! Protocol unlocked.");
          setBusyId(null);
          setStatusText("");
        },
        onError: (err) => {
          alert(`Failed: ${err.message}`);
          setBusyId(null);
          setStatusText("");
        }
      });

    } catch (err: any) {
      setBusyId(null);
      setStatusText("");
      alert(err.message || "Purchase failed");
    }
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
                Sync with the decentralized intelligence network. Acquire NFT Keys to unlock unique AI voices and visual styles.
             </p>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-sm border border-gray-100">
                  <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} />
                  {isLoading ? `Syncing Genes ${syncProgress.current}/${syncProgress.total}` : `${mascots.length} Protocols Active`}
              </div>
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {mascots.map((m) => (
                <div key={m.id} className="group bg-white border border-gray-100 rounded-sm overflow-hidden flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
                    <div className="aspect-square bg-gray-50 relative overflow-hidden">
                        <img 
                            src={m.metadata.image} 
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                            alt={m.metadata.name} 
                        />
                        
                        {/* Key ID Badge */}
                        <div className="absolute top-2 right-2 bg-black text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm shadow-xl z-10">
                            KEY #{m.id}
                        </div>
                        
                        {/* Owned Status Overlay */}
                        {m.owned && (
                            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-black text-white text-[8px] font-black uppercase px-2 py-1 flex items-center gap-1.5 shadow-2xl">
                                    <CheckCircle2 size={10} className="text-green-500" /> Active
                                </div>
                            </div>
                        )}

                        {/* Hover Voice Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                            <p className="text-white text-[8px] font-bold leading-relaxed italic line-clamp-2">
                                "{m.metadata.voice}"
                            </p>
                        </div>

                        {/* Busy State Overlay */}
                        {busyId === String(m.id) && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                                <Loader2 size={20} className="animate-spin text-black" />
                                <span className="text-[8px] font-black uppercase tracking-tighter">{statusText}</span>
                            </div>
                        )}
                    </div>

                    <div className="p-4 flex flex-col flex-1 gap-4">
                        <div className="min-h-[40px]">
                            <h3 className="text-sm font-black uppercase tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                                {m.metadata.name}
                            </h3>
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                By {m.creator.slice(0, 4)}...{m.creator.slice(-4)}
                            </p>
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

                        <button 
                            onClick={() => handlePurchase(m.id, m.price)}
                            disabled={busyId !== null || m.owned}
                            className={`w-full py-3 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${m.owned ? 'bg-gray-50 text-gray-300' : 'bg-black text-white hover:bg-gray-800 shadow-md'}`}
                        >
                            {m.owned ? (
                                <><CheckCircle2 size={12} /> Unlocked</>
                            ) : (
                                <><ShoppingCart size={12} /> Acquire Key</>
                            )}
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

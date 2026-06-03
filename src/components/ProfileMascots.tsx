"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall, toWei } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { ShoppingCart, Loader2, Zap, CheckCircle2, RefreshCw, AlertTriangle, UserCheck, Flame, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/**
 * PROFILE MASCOTS COMPONENT - V2 (SAFE SYNC)
 * Syncs with Supabase DNA + Blockchain Keys.
 * Pattern: DB-First + Sequential RPC with delay.
 */

export default function ProfileMascots({ address }: { address: string }) {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const router = useRouter();
  
  const [mascots, setMascots] = useState<any[]>([]);
  const [activeMascotId, setActiveMascotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingActive, setIsSettingActive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("");
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  const isOwner = account?.address?.toLowerCase() === address?.toLowerCase();

  const fetchAuthorMascots = useCallback(async (isManualRefresh = false) => {
    if (!address) return;
    setIsLoading(true);
    try {
      // 1. Get Profile to find active mascot
      const { data: profile } = await supabase
        .from('profiles')
        .select('ai_nft_token_id')
        .eq('address', address.toLowerCase())
        .single();
      
      setActiveMascotId(profile?.ai_nft_token_id || null);

      // 2. DB-First: Get all mascots created by this address
      const { data: dnas, error: dnaError } = await supabase
        .from('mascots_dna')
        .select('*')
        .eq('creator_address', address.toLowerCase())
        .order('id', { ascending: false });

      if (dnaError) throw dnaError;
      if (!dnas || dnas.length === 0) {
          setMascots([]);
          setIsLoading(false);
          return;
      }

      setSyncProgress({ current: 0, total: dnas.length });
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const globalMax = await readContract({ contract, method: "function MAX_SUPPLY() view returns (uint256)", params: [] });

      const foundMascots = [];
      
      // 3. Safe Sync: Sequential RPC calls with delay
      for (let i = 0; i < dnas.length; i++) {
        const dna = dnas[i];
        setSyncProgress(prev => ({ ...prev, current: i + 1 }));
        
        try {
          const k = await readContract({ 
            contract, 
            method: "function keys(uint256) view returns (address, uint256, uint256)", 
            params: [BigInt(dna.id)] 
          });
          
          const creatorAddress = k[0];
          const isActiveInContract = creatorAddress !== "0x0000000000000000000000000000000000000000";

          let balance = 0n;
          if (account?.address && isActiveInContract) {
            balance = await readContract({ 
                contract, 
                method: "function balanceOf(address, uint256) view returns (uint256)", 
                params: [account.address, BigInt(dna.id)] 
            });
          }

          foundMascots.push({ 
              id: dna.id, 
              price: isActiveInContract ? k[1] : BigInt(toWei(dna.price || "101")), 
              currentSupply: k[2], 
              maxSupply: globalMax,
              isActive: isActiveInContract,
              metadata: {
                  name: dna.name,
                  image: dna.image_url,
                  voice: dna.voice
              },
              owned: balance > 0n
          });
          
          if (dnas.length > 3 && i < dnas.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 800));
          }
        } catch (itemErr) {
          console.error(`❌ [Mascot Sync] Error for ID ${dna.id}:`, itemErr);
        }
      }
      setMascots(foundMascots);
    } catch (err) {
        console.error("❌ [ProfileMascots] Global error:", err);
    } finally {
      setIsLoading(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  }, [address, account?.address]);

  useEffect(() => {
    fetchAuthorMascots();
  }, [fetchAuthorMascots]);

  const handleSetActive = async (tokenId: number) => {
    if (!isOwner) return;
    setIsSettingActive(true);
    try {
        const res = await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, ai_nft_token_id: String(tokenId) })
        });
        if (res.ok) {
            setActiveMascotId(String(tokenId));
            router.refresh();
        }
    } catch (e) {
        console.error("Set active fail", e);
    } finally {
        setIsSettingActive(false);
    }
  };

  const handleIgniteMascot = async (tokenId: number, price: bigint) => {
    if (!isOwner) return;
    setBusyId(String(tokenId));
    setStatusText("Activating Protocol...");

    try {
        const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
        
        // Ensure we are still matching the contract's nextTokenId
        const nextId = await readContract({ contract, method: "function nextTokenId() view returns (uint256)", params: [] });
        if (BigInt(tokenId) !== nextId) {
            throw new Error(`Chain ID Mismatch. Expected ${nextId}, got ${tokenId}. Please forge a new mascot.`);
        }

        const transaction = prepareContractCall({
            contract,
            method: "function createMascot(uint256 _price)",
            params: [price],
        });

        sendTransaction(transaction, {
            onSuccess: () => {
                alert("Protocol Activated! NFT Key Minted.");
                setBusyId(null);
                setStatusText("");
                fetchAuthorMascots(true);
            },
            onError: (err) => {
                alert("Blockchain Reject: " + err.message);
                setBusyId(null);
                setStatusText("");
            }
        });
    } catch (e: any) {
        alert(e.message);
        setBusyId(null);
        setStatusText("");
    }
  };

  const handlePurchase = async (tokenId: number, price: bigint) => {
    if (!account) return alert("Connect wallet to purchase");
    
    setBusyId(String(tokenId));
    
    try {
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      
      setStatusText("Verifying $HASH Permission...");
      const currentAllowance = await readContract({
        contract: hashContract,
        method: "function allowance(address,address) view returns (uint256)",
        params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any]
      });

      if (currentAllowance < price) {
        setStatusText("Approval Required...");
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

      setStatusText("Acquiring Key...");
      const mintTx = prepareContractCall({
        contract: getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any }),
        method: "function mintKey(uint256 _tokenId)",
        params: [BigInt(tokenId)],
      });

      sendTransaction(mintTx, {
        onSuccess: () => {
          setMascots(prev => prev.map(m => m.id === tokenId ? { ...m, owned: true, currentSupply: BigInt(Number(m.currentSupply) + 1) } : m));
          alert("Key acquired! Protocol unlocked.");
          setBusyId(null);
          setStatusText("");
          setTimeout(() => fetchAuthorMascots(), 5000);
        },
        onError: (err) => {
          alert(`Transaction failed: ${err.message}`);
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

  if (isLoading && mascots.length === 0) {
      return (
          <div className="h-48 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-black" size={32} />
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {syncProgress.total > 0 ? `Synchronizing Gene ${syncProgress.current}/${syncProgress.total}...` : "Loading Protocol..."}
              </div>
          </div>
      );
  }

  if (mascots.length === 0) return null;

  return (
    <section className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-black flex items-center gap-2">
          <Zap size={14} className="text-yellow-400 fill-yellow-400" /> Active Protocol Keys
        </h3>
        <button 
            onClick={() => fetchAuthorMascots(true)} 
            disabled={isLoading}
            className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black flex items-center gap-2 transition-colors disabled:opacity-50"
        >
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Sync
        </button>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2">
        {mascots.map((m) => (
          <div key={m.id} className={`min-w-[280px] bg-white border rounded-sm overflow-hidden flex flex-col group shadow-sm hover:shadow-xl transition-all duration-300 relative ${!m.isActive ? 'border-dashed border-gray-300' : 'border-gray-100'}`}>
            {String(m.id) === activeMascotId && (
                <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400 z-10" />
            )}
            
            <div className="aspect-square bg-gray-50 relative overflow-hidden">
              <img 
                src={m.metadata.image} 
                className={`w-full h-full object-cover transition-transform duration-1000 ${m.isActive ? 'group-hover:scale-110' : 'grayscale opacity-50'}`} 
                alt={m.metadata.name} 
              />
              <div className="absolute top-3 right-3 bg-black text-white text-[9px] font-black px-2 py-1 rounded-sm shadow-xl">
                KEY #{m.id}
              </div>
              
              {String(m.id) === activeMascotId && (
                 <div className="absolute top-3 left-3 bg-yellow-400 text-black text-[9px] font-black px-2 py-1 rounded-sm shadow-xl flex items-center gap-1">
                    <UserCheck size={10} /> PRIMARY AI
                 </div>
              )}

              {m.owned && (
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <div className="bg-black text-white text-[8px] font-black uppercase px-3 py-1.5 flex items-center gap-1.5 shadow-2xl">
                        <CheckCircle2 size={12} className="text-green-500" /> Key in Wallet
                    </div>
                </div>
              )}
              
              {!m.isActive && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-[2px] p-6 text-center">
                    <div className="bg-white text-black text-[8px] font-black uppercase px-3 py-1.5 flex items-center gap-1.5 shadow-2xl mb-2">
                        <AlertTriangle size={12} className="text-yellow-500" /> Awaiting Activation
                    </div>
                    <p className="text-white text-[8px] font-bold uppercase tracking-widest leading-relaxed">
                        {isOwner ? "Transaction failed? Complete the forge to activate this mascot." : "The author has not yet finalized this protocol on-chain."}
                    </p>
                </div>
              )}
            </div>
            
            <div className="p-5 flex flex-col flex-1">
              <h4 className="text-lg font-black uppercase tracking-tighter mb-1">{m.metadata.name}</h4>
              <p className="text-[10px] text-gray-400 italic mb-4">"{m.metadata.voice}"</p>
              
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-6">
                <span className="bg-gray-50 px-2 py-0.5 rounded-full">
                    {m.isActive ? `${Number(m.currentSupply)} / ${Number(m.maxSupply)}` : "GENOME SEALED"}
                </span>
                <span className="text-black font-black">
                    {`${Math.floor(Number(m.price) / 1e18)} $HASH`}
                </span>
              </div>

              <div className="space-y-2 mt-auto">
                {isOwner && !m.isActive ? (
                    <button 
                        onClick={() => handleIgniteMascot(m.id, m.price)}
                        disabled={busyId !== null}
                        className="w-full py-4 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-yellow-500 transition-all shadow-lg"
                    >
                        {busyId === String(m.id) ? (
                            <><Loader2 size={14} className="animate-spin" /> {statusText}</>
                        ) : (
                            <><Flame size={14} /> Complete Forge</>
                        )}
                    </button>
                ) : (
                    <button 
                      onClick={() => handlePurchase(m.id, m.price)}
                      disabled={busyId !== null || Number(m.currentSupply) >= Number(m.maxSupply) || m.owned || !m.isActive}
                      className={`w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${!m.isActive ? 'bg-gray-100 text-gray-400' : 'bg-black text-white hover:bg-gray-800'}`}
                    >
                      {busyId === String(m.id) ? (
                        <><Loader2 size={14} className="animate-spin" /> {statusText}</>
                      ) : m.owned ? (
                        "Acquired"
                      ) : !m.isActive ? (
                        "Inactive Protocol"
                      ) : (
                        <><ShoppingCart size={14} /> Acquire Key</>
                      )}
                    </button>
                )}

                {m.owned && isOwner && String(m.id) !== activeMascotId && (
                    <button 
                        onClick={() => handleSetActive(m.id)}
                        disabled={isSettingActive}
                        className="w-full py-2 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:text-black border border-gray-100 hover:border-black transition-all flex items-center justify-center gap-1.5"
                    >
                        {isSettingActive ? <Loader2 size={10} className="animate-spin" /> : <><UserCheck size={10} /> Set as Primary AI</>}
                    </button>
                )}
                
                {!m.isActive && !isOwner && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50/50 rounded-sm">
                        <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[8px] font-bold text-blue-600 uppercase tracking-tight leading-normal">
                            This protocol is being initialized. Check back soon for public access.
                        </p>
                    </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

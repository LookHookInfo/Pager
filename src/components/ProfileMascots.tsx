"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall, toWei } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { ShoppingCart, Loader2, Zap, CheckCircle2, RefreshCw, AlertTriangle, UserCheck, Flame, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/**
 * PROFILE MASCOTS COMPONENT - COMPACT V3 (NORMALIZED & SAFE)
 * Sequential RPC loading + Discard/Delete functionality.
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('ai_nft_token_id')
        .eq('address', address.toLowerCase())
        .single();
      
      setActiveMascotId(profile?.ai_nft_token_id || null);

      // SAFE FETCH: First get all DNA for this creator
      const { data: allDnas, error: dnaError } = await supabase
        .from('mascots_dna')
        .select('*')
        .eq('creator_address', address.toLowerCase())
        .order('id', { ascending: false });

      if (dnaError) throw dnaError;
      if (!allDnas || allDnas.length === 0) {
          setMascots([]);
          setIsLoading(false);
          return;
      }

      // Filter locally to handle missing contract_address column
      const dnas = allDnas.filter(dna => {
          if (!dna.contract_address) return true; // Include if column is missing or empty (for transition)
          return dna.contract_address.toLowerCase() === MASCOTS_CONTRACT_ADDRESS.toLowerCase();
      });

      setSyncProgress({ current: 0, total: dnas.length });
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const globalMax = 10000n;

      const foundMascots = [];
      for (let i = 0; i < dnas.length; i++) {
        const dna = dnas[i];
        setSyncProgress(prev => ({ ...prev, current: i + 1 }));
        
        try {
          const k = await readContract({ 
            contract, 
            method: "function keys(uint256) view returns (address, uint256, uint32, uint32, bool)", 
            params: [BigInt(dna.id)] 
          });
          
          const creatorAddress = k[0];
          const exists = k[4];
          const isActiveInContract = exists && creatorAddress !== "0x0000000000000000000000000000000000000000";

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
              totalSold: k[3],
              maxSupply: globalMax,
              isActive: isActiveInContract,
              creator: creatorAddress,
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
          console.error(`❌ [Mascot Sync] ID ${dna.id}:`, itemErr);
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

  const handleDeleteProtocol = async (tokenId: number) => {
    if (!account) return;
    if (!confirm("CRITICAL: This will permanently DELETE this protocol from the blockchain. Only possible because 0 keys are sold. Continue?")) return;

    setBusyId(String(tokenId));
    setStatusText("Deleting...");

    try {
        const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
        const transaction = prepareContractCall({
            contract,
            method: "function deleteMascot(uint256 _tokenId)",
            params: [BigInt(tokenId)],
        });

        sendTransaction(transaction, {
            onSuccess: async () => {
                // Better local filter logic for delete
                await supabase.from('mascots_dna').delete().eq('id', tokenId);
                alert("Protocol deleted.");
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

  const handleDiscard = async (tokenId: number) => {
    if (!account) return;
    if (!confirm("Are you sure? This will remove 1 Key from your wallet and release the slot.")) return;

    setBusyId(String(tokenId));
    setStatusText("Burning Key...");

    try {
        const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
        const transaction = prepareContractCall({
            contract,
            method: "function discardMascot(uint256 _tokenId)",
            params: [BigInt(tokenId)],
        });

        sendTransaction(transaction, {
            onSuccess: () => {
                alert("Key discarded.");
                setBusyId(null);
                setStatusText("");
                fetchAuthorMascots(true);
            },
            onError: (err) => {
                alert("Discard failed: " + err.message);
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

  const handleIgniteMascot = async (tokenId: number, price: bigint) => {
    if (!isOwner) return;
    setBusyId(String(tokenId));
    setStatusText("Igniting...");
    try {
        const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
        const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
        const creationFee = await readContract({ contract, method: "function CREATION_FEE() view returns (uint256)", params: [] });
        const currentAllowance = await readContract({ contract: hashContract, method: "function allowance(address,address) view returns (uint256)", params: [account?.address as any, MASCOTS_CONTRACT_ADDRESS as any] });

        if (currentAllowance < creationFee) {
            setStatusText("Approving Fee...");
            const approveTx = prepareContractCall({ contract: hashContract, method: "function approve(address spender, uint256 value)", params: [MASCOTS_CONTRACT_ADDRESS, creationFee] });
            await new Promise((res, rej) => sendTransaction(approveTx, { onSuccess: res, onError: rej }));
        }

        setStatusText("Forging Key...");
        const transaction = prepareContractCall({ contract, method: "function createMascot(uint256 _price)", params: [price] });
        sendTransaction(transaction, {
            onSuccess: () => { setBusyId(null); setStatusText(""); fetchAuthorMascots(true); },
            onError: (err) => { alert("Failed: " + err.message); setBusyId(null); setStatusText(""); }
        });
    } catch (e: any) { alert(e.message); setBusyId(null); setStatusText(""); }
  };

  const handlePurchase = async (tokenId: number, price: bigint) => {
    if (!account) return alert("Connect wallet");
    setBusyId(String(tokenId));
    try {
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const currentAllowance = await readContract({ contract: hashContract, method: "function allowance(address,address) view returns (uint256)", params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any] });
      if (currentAllowance < price) {
        setStatusText("Approval...");
        const approveTx = prepareContractCall({ contract: hashContract, method: "function approve(address spender, uint256 value)", params: [MASCOTS_CONTRACT_ADDRESS, BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")] });
        await new Promise((resolve, reject) => sendTransaction(approveTx, { onSuccess: () => resolve(true), onError: (err) => reject(err) }));
      }
      setStatusText("Minting...");
      const mintTx = prepareContractCall({ contract: getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any }), method: "function mintKey(uint256 _tokenId)", params: [BigInt(tokenId)] });
      sendTransaction(mintTx, { onSuccess: () => { setBusyId(null); setStatusText(""); fetchAuthorMascots(true); }, onError: (err) => { alert(`Failed: ${err.message}`); setBusyId(null); setStatusText(""); } });
    } catch (err: any) { setBusyId(null); setStatusText(""); alert(err.message || "Purchase failed"); }
  };

  if (isLoading && mascots.length === 0) {
      return (
          <div className="h-32 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-black" size={24} />
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Syncing Genes...</span>
          </div>
      );
  }

  if (mascots.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
            <Zap size={12} className="text-yellow-400 fill-yellow-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Protocol Keys</h3>
        </div>
        <button onClick={() => fetchAuthorMascots(true)} className="text-[8px] font-black uppercase text-gray-400 hover:text-black flex items-center gap-1 transition-colors">
            <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} /> Sync
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {mascots.map((m) => (
          <div key={m.id} className={`group relative bg-white border rounded-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg ${String(m.id) === activeMascotId ? 'border-yellow-400 border-2 shadow-md' : 'border-gray-100'}`}>
            
            <div className="aspect-square bg-gray-50 relative overflow-hidden">
              <img src={m.metadata.image} className={`w-full h-full object-cover transition-transform duration-700 ${m.isActive ? 'group-hover:scale-110' : 'grayscale opacity-50'}`} alt={m.metadata.name} />
              
              <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm z-10">#{m.id}</div>

              {String(m.id) === activeMascotId && (
                 <div className="absolute top-2 left-2 bg-yellow-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm flex items-center gap-1 shadow-sm z-10">
                    <UserCheck size={10} />
                 </div>
              )}

              {m.owned && !busyId && (
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <CheckCircle2 size={24} className="text-white drop-shadow-lg" />
                </div>
              )}
              
              {!m.isActive && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-[1px] p-2 text-center">
                    <span className="text-white text-[8px] font-black uppercase tracking-widest bg-black/50 px-2 py-1 mb-1">Forging...</span>
                    {isOwner && (
                        <button onClick={() => handleDeleteProtocol(m.id)} className="p-2 text-white/50 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    )}
                </div>
              )}

              {busyId === String(m.id) && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                    <Loader2 size={16} className="animate-spin text-black" />
                    <span className="text-[8px] font-black uppercase tracking-tighter">{statusText}</span>
                </div>
              )}
            </div>
            
            <div className="p-3 flex flex-col flex-1 gap-2">
              <div className="min-h-[32px]">
                <h4 className="text-[10px] font-black uppercase leading-tight line-clamp-1">{m.metadata.name}</h4>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-[8px] font-bold text-gray-400">
                        {m.isActive ? `${m.totalSold}/${Number(m.maxSupply)}` : "GENOME"}
                    </span>
                    <span className="text-[8px] font-black text-black">
                        {Math.floor(Number(m.price) / 1e18)} $HASH
                    </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-auto">
                {isOwner && !m.isActive ? (
                    <button onClick={() => handleIgniteMascot(m.id, m.price)} disabled={busyId !== null} className="w-full py-2 bg-yellow-400 text-black text-[8px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-all flex items-center justify-center gap-1">
                        <Flame size={10} /> Ignite Key
                    </button>
                ) : m.owned ? (
                    <div className="flex gap-1">
                        <button onClick={() => handleSetActive(m.id)} disabled={isSettingActive || String(m.id) === activeMascotId} className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${String(m.id) === activeMascotId ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-black text-white hover:bg-gray-800'}`}>
                            {String(m.id) === activeMascotId ? 'Active' : 'Select'}
                        </button>
                        <button onClick={() => handleDiscard(m.id)} disabled={busyId !== null || String(m.id) === activeMascotId} className="p-2 border border-gray-100 rounded-sm text-gray-300 hover:text-red-500 hover:border-red-100 transition-all disabled:opacity-30">
                            <Trash2 size={12} />
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-1">
                        <button onClick={() => handlePurchase(m.id, m.price)} disabled={busyId !== null || !m.isActive} className="flex-1 py-2 bg-black text-white text-[8px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                            <ShoppingCart size={10} /> Buy Access
                        </button>
                        {isOwner && m.totalSold === 0 && (
                            <button onClick={() => handleDeleteProtocol(m.id)} disabled={busyId !== null} className="p-2 border border-gray-100 rounded-sm text-gray-300 hover:text-red-500 transition-all" title="Delete unused protocol">
                                <Trash2 size={12} />
                            </button>
                        )}
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

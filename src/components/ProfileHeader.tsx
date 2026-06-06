"use client";

import { 
  Globe, Settings2, Save, X, Loader2, Camera, 
  UserPlus, Zap, Plus, 
  Sparkles, Fingerprint, Database, ShieldCheck, Edit3, Trash2,
  Languages, UserCircle, Send, Scan, Activity, Eye as EyeIcon, CheckCircle2
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, toWei, readContract } from "thirdweb";
import { supabase } from "@/lib/supabase";
import { MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, client, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { base } from "thirdweb/chains";
import { getAuthMessage } from "@/lib/auth";

/**
 * PROFILE HEADER COMPONENT - Simplified V3 (Hardcoded AI Models)
 */

const PRESET_ATMOSPHERES = ['Rick and Morty', 'Cyberpunk', 'Japanese Anime', 'Noir Detective', 'Medieval Fantasy'];
const LANGUAGES = ["English", "Russian", "Spanish", "Chinese", "French", "German", "Japanese", "Turkish"];

export default function ProfileHeader({ 
  profile, 
  totalArticles, 
  totalRewards 
}: { 
  profile: any, 
  totalArticles: number, 
  totalRewards: number
}) {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mascotImgRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomAtmosphere, setIsCustomAtmosphere] = useState(false);
  const [isAnalyzingDna, setIsAnalyzingDna] = useState(false);
  
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showNotify = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
  };

  const isOwner = account?.address?.toLowerCase() === profile.address?.toLowerCase();

  const [formData, setFormData] = useState({
    name: profile.name || "", bio: profile.bio || "", website: profile.website || "",
    avatar_url: profile.avatar_url || "",
    ai_atmosphere: profile.ai_atmosphere || PRESET_ATMOSPHERES[0], binance_accounts: profile.binance_accounts || [],
    telegram_channels: profile.telegram_channels || [], telegram_chat_id: profile.telegram_chat_id || "",
    cta_telegram: profile.cta_telegram || "", cta_forum: profile.cta_forum || "",
    ref_links: profile.ref_links || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }]
  });

  const [forgeData, setForgeData] = useState({
      name: "", personality: "", visual_desc: "", voice: "", physical_desc: "", image_url: "", price: "101"
  });
  const [forgeStep, setForgeStep] = useState<"dna" | "mint">("dna");
  const [isForging, setIsForging] = useState(false);
  const [pendingTokenId, setPendingTokenId] = useState<number | null>(null);
  const [forgeErrors, setForgeErrors] = useState<string[]>([]);

  const [displayData, setDisplayData] = useState({
    ...formData, name: profile.name || "Anonymous Author", bio: profile.bio || "Web3 enthusiast."
  });

  useEffect(() => {
    const data = {
      name: profile.name || "", bio: profile.bio || "", website: profile.website || "",
      avatar_url: profile.avatar_url || "",
      ai_atmosphere: profile.ai_atmosphere || PRESET_ATMOSPHERES[0], binance_accounts: profile.binance_accounts || [],
      telegram_channels: profile.telegram_channels || [], telegram_chat_id: profile.telegram_chat_id || "",
      cta_telegram: profile.cta_telegram || "", cta_forum: profile.cta_forum || "",
      ref_links: profile.ref_links || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }]
    };
    setFormData(data);
    setDisplayData({ ...data, name: profile.name || "Anonymous Author", bio: profile.bio || "Web3 enthusiast." });
    setIsCustomAtmosphere(!PRESET_ATMOSPHERES.includes(data.ai_atmosphere));
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.details || data.error || "IPFS Upload failed");
      
      setFormData({ ...formData, avatar_url: data.url });
      showNotify("Avatar synced with IPFS");
    } catch (e: any) { 
      console.error("❌ [Avatar Upload]:", e.message);
      showNotify(e.message, "error"); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleMascotImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!account?.address) return;

    try {
        setIsForging(true);
        const fd = new FormData();
        fd.append('file', file);
        
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok) throw new Error(data.details || data.error || "IPFS Upload failed");
        
        const imageUrl = data.url;
        setForgeData(prev => ({ ...prev, image_url: imageUrl }));

        // AI DNA SCANNING (Hardcoded Gemini 2.5 Flash)
        setIsAnalyzingDna(true);
        try {
            const scanRes = await fetch("/api/ai/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl, userAddress: account.address })
            });
            const scanData = await scanRes.json();
            if (scanData.personality || scanData.visual) {
                setForgeData(prev => ({ 
                    ...prev, 
                    personality: scanData.personality || prev.personality,
                    visual_desc: scanData.visual || prev.visual_desc 
                }));
            }
        } catch (err) {
            console.error("AI Analysis failed", err);
        } finally {
            setIsAnalyzingDna(false);
        }

    } catch (e: any) { 
      console.error("❌ [Mascot Upload]:", e.message);
      showNotify(e.message, "error"); 
    } finally { 
      setIsForging(false); 
    }
  };

  const handleSealGenes = async () => {
    if (!account) return showNotify("Connect wallet", "error");
    
    const errors = [];
    if (!forgeData.image_url) errors.push('image');
    if (!forgeData.name) errors.push('name');
    if (!forgeData.personality) errors.push('personality');

    if (errors.length > 0) {
        setForgeErrors(errors);
        if (errors.includes('name')) showNotify("Protocol Name is required", "error");
        else if (errors.includes('personality')) showNotify("DNA description is required", "error");
        else if (errors.includes('image')) showNotify("Upload mascot DNA image", "error");
        return;
    }
    
    setForgeErrors([]);
    setIsForging(true);
    try {
        const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
        const tokenId = await readContract({ contract, method: "function nextTokenId() view returns (uint256)", params: [] });
        const currentId = Number(tokenId);

        const { error: dbError } = await supabase.from('mascots_dna').upsert([{
            id: currentId,
            name: forgeData.name,
            personality: forgeData.personality,
            voice: forgeData.personality.slice(0, 100),
            physical_desc: forgeData.visual_desc || forgeData.personality, 
            image_url: forgeData.image_url,
            creator_address: account.address.toLowerCase(),
            price: forgeData.price,
            max_supply: 10000,
            contract_address: MASCOTS_CONTRACT_ADDRESS.toLowerCase()
        }], { onConflict: 'id' });

        if (dbError) throw dbError;

        setPendingTokenId(currentId);
        setForgeStep("mint");
        showNotify("Genome Sealed. Protocol ready for activation.");
    } catch (e: any) { showNotify(e.message, "error"); } finally { setIsForging(false); }
  };

  const handleIgniteKey = async () => {
    if (!account || pendingTokenId === null) return;
    setIsForging(true);
    try {
        const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
        
        // 1. ПРОВЕРКА И ОДОБРЕНИЕ КОМИССИИ (500 $HASH)
        const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
        const creationFee = await readContract({ contract, method: "function CREATION_FEE() view returns (uint256)", params: [] });
        
        const currentAllowance = await readContract({
            contract: hashContract,
            method: "function allowance(address,address) view returns (uint256)",
            params: [account.address as any, MASCOTS_CONTRACT_ADDRESS as any]
        });

        if (currentAllowance < creationFee) {
            showNotify("Approving 500 $HASH Creation Fee...", "success");
            const approveTx = prepareContractCall({
                contract: hashContract,
                method: "function approve(address spender, uint256 value)",
                params: [MASCOTS_CONTRACT_ADDRESS, creationFee]
            });
            await new Promise((resolve, reject) => {
                sendTransaction(approveTx, {
                    onSuccess: () => resolve(true),
                    onError: (err) => reject(err)
                });
            });
        }

        const transaction = prepareContractCall({
            contract,
            method: "function createMascot(uint256 _price)",
            params: [
                BigInt(toWei(forgeData.price))
            ],
        });

        sendTransaction(transaction, {
            onSuccess: () => {
                showNotify("Protocol Activated! NFT Key Minted.");
                setForgeStep("dna");
                setForgeData({ name: "", personality: "", visual_desc: "", voice: "", physical_desc: "", image_url: "", price: "101" });
                router.refresh();
                setIsForging(false);
            },
            onError: (err) => {
                showNotify("Blockchain Reject: " + err.message, "error");
                setIsForging(false);
            }
        });
    } catch (e: any) { showNotify(e.message, "error"); setIsForging(false); }
  };

  const [isDepositing, setIsDepositing] = useState(false);

  const handleDeposit = async () => {
    if (!account) return showNotify("Connect wallet", "error");
    const amountStr = prompt("Enter amount of $HASH to deposit (1 $HASH = 1 Credit):", "50");
    if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) return;
    
    setIsDepositing(true);
    try {
      showNotify(`Initiating ${amountStr} $HASH transfer...`, "success");
      
      // 1. ПЕРЕВОД ТОКЕНОВ
      const contract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 value)",
        params: ["0x39adfb3eb6ff7f56bd5c09c62b4ab1d61997193a", BigInt(toWei(amountStr))],
      });

      sendTransaction(transaction, {
        onSuccess: async (txResult) => {
          try {
            // 2. ПОДПИСЬ ДЛЯ ПОДТВЕРЖДЕНИЯ
            const message = getAuthMessage(`deposit ${amountStr} credits`, account.address.toLowerCase());
            const signature = await account.signMessage({ message });

            // 3. УВЕДОМЛЕНИЕ СЕРВЕРА
            const res = await fetch("/api/profile/deposit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                address: account.address,
                amount: amountStr,
                txHash: txResult.transactionHash,
                signature,
                message
              })
            });

            if (!res.ok) throw new Error("Server failed to sync deposit");
            
            showNotify(`Successfully deposited ${amountStr} AI Credits!`, "success");
            router.refresh();
          } catch (e: any) {
            showNotify(`Deposit Sync Error: ${e.message}`, "error");
          } finally {
            setIsDepositing(false);
          }
        },
        onError: (err) => {
          showNotify(`Transfer failed: ${err.message}`, "error");
          setIsDepositing(false);
        }
      });
    } catch (e: any) {
      showNotify(e.message, "error");
      setIsDepositing(false);
    }
  };
  const handleSave = async () => {
    if (!account) return showNotify("Connect wallet", "error");
    setIsSaving(true);
    try {
      // 1. ПОДПИСЬ ДЛЯ АУТЕНТИФИКАЦИИ
      const message = getAuthMessage("update Pager profile", account.address.toLowerCase());
      const signature = await account.signMessage({ message });

      // 2. ОТПРАВКА ДАННЫХ
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          address: profile.address.toLowerCase(), 
          ...formData,
          signature,
          message 
        }),
        cache: 'no-store'
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Save failed");
      
      showNotify("Protocol Configuration Updated");
      setIsEditing(false);
      router.refresh();
    } catch (e: any) {
      console.error("❌ [Save Profile]:", e);
      showNotify(`Error: ${e.message}`, "error");
    } finally { setIsSaving(false); }
  };

  const addBinanceAccount = () => {
    setFormData({
      ...formData,
      binance_accounts: [...(formData.binance_accounts || []), { label: "", apiKey: "", language: "English", style: "Professional" }]
    });
  };

  const addTelegramChannel = () => {
    setFormData({
      ...formData,
      telegram_channels: [...(formData.telegram_channels || []), { label: "", chatId: "", topicId: "", language: "English", style: "Engaging" }]
    });
  };

  const getDomain = (url: string) => {
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      return domain.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  return (
    <header className="mb-20 space-y-12">
      {/* Visual Notification System */}
      {notification && (
          <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-sm shadow-2xl border-l-4 animate-in slide-in-from-top-4 duration-300 flex items-center gap-4 ${notification.type === 'success' ? 'bg-black text-white border-green-500' : notification.type === 'error' ? 'bg-red-600 text-white border-red-800' : 'bg-gray-900 text-white border-blue-500'}`}>
              {notification.type === 'success' ? <CheckCircle2 size={20} className="text-green-500" /> : <X size={20} />}
              <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Protocol Message</span>
                  <span className="text-sm font-bold">{notification.message}</span>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="space-y-6 flex-1">
          <div className="flex items-center gap-6">
             <div className="w-24 h-24 bg-white border border-[var(--border-soft)] rounded-full flex items-center justify-center font-black text-3xl text-black shadow-sm overflow-hidden relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {formData.avatar_url ? <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Avatar" /> : displayData.name.charAt(0).toUpperCase()}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploading ? <Loader2 size={24} className="text-white animate-spin" /> : <Camera size={24} className="text-white" />}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
             </div>
             <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">{displayData.name}</h1>
                    {isOwner && <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-gray-400 hover:text-black transition-colors"><Settings2 size={20} /></button>}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-1.5"><span className="text-black">{totalArticles}</span> Stories</div>
                    <div className="w-1 h-1 bg-gray-200 rounded-full" />
                    <div className="flex items-center gap-1.5"><span className="text-black">{Math.floor(totalRewards)}</span> $HASH Earned</div>
                    {displayData.website && (
                        <>
                            <div className="w-1 h-1 bg-gray-200 rounded-full" />
                            <a href={displayData.website.startsWith('http') ? displayData.website : `https://${displayData.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-500 hover:text-blue-600 transition-colors font-black">
                                <Globe size={12} /> {getDomain(displayData.website)}
                            </a>
                        </>
                    )}
                </div>
             </div>
          </div>
          <p className="text-xl text-gray-500 typography-body leading-relaxed max-w-2xl">{displayData.bio}</p>
        </div>
      </div>

      {isOwner && isEditing && (
        <div className="border-t border-gray-100 pt-12 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-8 sticky top-0 bg-white/90 backdrop-blur-sm z-20 py-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-black text-white rounded-sm"><Settings2 size={20} /></div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em]">Protocol Configuration</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleSave} disabled={isSaving} className="bg-black text-white px-6 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50">
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Save Changes</>}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-black transition-colors"><X size={24} /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* --- LEFT COLUMN: IDENTITY & SOCIAL --- */}
                <div className="lg:col-span-7 space-y-10">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <UserPlus size={14} /> Identity Gene
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input 
                                type="text" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                placeholder="Display Name" 
                                className="w-full text-xs font-bold p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors" 
                            />
                            <input 
                                type="text" 
                                value={formData.website} 
                                onChange={e => setFormData({...formData, website: e.target.value})} 
                                placeholder="Website URL (e.g. x.com)" 
                                className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors" 
                            />
                        </div>
                        <textarea 
                            value={formData.bio} 
                            onChange={e => setFormData({...formData, bio: e.target.value})} 
                            placeholder="Biographical Data..." 
                            className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors min-h-[80px]" 
                        />
                    </div>

                    <div className="space-y-6 pt-6 border-t border-gray-50">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <Zap size={14} /> Distribution Protocols
                        </h4>
                        
                        {/* Telegram Auto-Publication Section */}
                        <div className="space-y-4 p-5 bg-gray-50/50 border border-gray-100 rounded-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Send size={14} className="text-blue-500" />
                                    <label className="text-[10px] font-black uppercase text-black">Telegram Channels</label>
                                </div>
                                <button onClick={addTelegramChannel} className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm shadow-sm"><Plus size={10} /> Add Channel</button>
                            </div>
                            <div className="space-y-3">
                                {(formData.telegram_channels || []).map((ch: any, idx: number) => (
                                    <div key={idx} className="space-y-2 p-3 bg-white border border-gray-200 rounded-sm animate-in slide-in-from-left-2 duration-200 shadow-sm relative">
                                        <button onClick={() => {
                                            const newChs = formData.telegram_channels.filter((_: any, i: number) => i !== idx);
                                            setFormData({...formData, telegram_channels: newChs});
                                        }} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"><Trash2 size={10} /></button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="text" value={ch.label} onChange={e => {
                                                const newChs = [...formData.telegram_channels];
                                                newChs[idx].label = e.target.value;
                                                setFormData({...formData, telegram_channels: newChs});
                                            }} placeholder="Channel Name" className="text-xs font-bold p-2 border border-gray-100 outline-none bg-gray-50/30" />
                                            <input type="text" value={ch.chatId} onChange={e => {
                                                const newChs = [...formData.telegram_channels];
                                                newChs[idx].chatId = e.target.value;
                                                setFormData({...formData, telegram_channels: newChs});
                                            }} placeholder="Chat ID / @channel" className="text-xs font-mono p-2 border border-gray-100 outline-none bg-gray-50/30" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="text" value={ch.topicId || ""} onChange={e => {
                                                const newChs = [...formData.telegram_channels];
                                                newChs[idx].topicId = e.target.value;
                                                setFormData({...formData, telegram_channels: newChs});
                                            }} placeholder="Topic ID" className="text-xs font-mono p-2 border border-gray-100 outline-none bg-gray-50/30" />
                                            <div className="flex items-center gap-2 bg-gray-50/50 p-2 border border-gray-50">
                                                <Languages size={12} className="text-gray-400" />
                                                <select value={ch.language} onChange={e => {
                                                    const newChs = [...formData.telegram_channels];
                                                    newChs[idx].language = e.target.value;
                                                    setFormData({...formData, telegram_channels: newChs});
                                                }} className="bg-transparent text-[10px] font-bold outline-none flex-1">
                                                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-50/50 p-2 border border-gray-50">
                                                <UserCircle size={12} className="text-gray-400" />
                                                <input type="text" value={ch.style} onChange={e => {
                                                    const newChs = [...formData.telegram_channels];
                                                    newChs[idx].style = e.target.value;
                                                    setFormData({...formData, telegram_channels: newChs});
                                                }} placeholder="Style (e.g. Witty)" className="bg-transparent text-[10px] font-bold outline-none flex-1" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Binance Auto-Publication Section */}
                        <div className="space-y-4 p-5 bg-gray-50/50 border border-gray-100 rounded-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-yellow-500" />
                                    <label className="text-[10px] font-black uppercase text-black">Binance Square Accounts</label>
                                </div>
                                <button onClick={addBinanceAccount} className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm shadow-sm"><Plus size={10} /> Add Account</button>
                            </div>
                            <div className="space-y-3">
                                {(formData.binance_accounts || []).map((acc: any, idx: number) => (
                                    <div key={idx} className="space-y-2 p-3 bg-white border border-gray-200 rounded-sm animate-in slide-in-from-left-2 duration-200 shadow-sm relative">
                                        <button onClick={() => {
                                            const newAccs = formData.binance_accounts.filter((_: any, i: number) => i !== idx);
                                            setFormData({...formData, binance_accounts: newAccs});
                                        }} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors"><Trash2 size={10} /></button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="text" value={acc.label} onChange={e => {
                                                const newAccs = [...formData.binance_accounts];
                                                newAccs[idx].label = e.target.value;
                                                setFormData({...formData, binance_accounts: newAccs});
                                            }} placeholder="Label (e.g. Main)" className="text-xs font-bold p-2 border border-gray-100 outline-none bg-gray-50/30" />
                                            <input type="password" value={acc.apiKey} onChange={e => {
                                                const newAccs = [...formData.binance_accounts];
                                                newAccs[idx].apiKey = e.target.value;
                                                setFormData({...formData, binance_accounts: newAccs});
                                            }} placeholder="Binance API Key" className="text-xs font-mono p-2 border border-gray-100 outline-none bg-gray-50/30" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center gap-2 bg-gray-50/50 p-2 border border-gray-50">
                                                <Languages size={12} className="text-gray-400" />
                                                <select value={acc.language} onChange={e => {
                                                    const newAccs = [...formData.binance_accounts];
                                                    newAccs[idx].language = e.target.value;
                                                    setFormData({...formData, binance_accounts: newAccs});
                                                }} className="bg-transparent text-[10px] font-bold outline-none flex-1">
                                                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-50/50 p-2 border border-gray-50">
                                                <UserCircle size={12} className="text-gray-400" />
                                                <input type="text" value={acc.style} onChange={e => {
                                                    const newAccs = [...formData.binance_accounts];
                                                    newAccs[idx].style = e.target.value;
                                                    setFormData({...formData, binance_accounts: newAccs});
                                                }} placeholder="Style (e.g. Bullish)" className="bg-transparent text-[10px] font-bold outline-none flex-1" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input 
                                type="text" 
                                value={formData.cta_telegram} 
                                onChange={e => setFormData({...formData, cta_telegram: e.target.value})} 
                                placeholder="CTA Telegram Link" 
                                className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors" 
                            />
                            <input 
                                type="text" 
                                value={formData.cta_forum} 
                                onChange={e => setFormData({...formData, cta_forum: e.target.value})} 
                                placeholder="CTA Forum/Other Link" 
                                className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors" 
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-gray-50">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <Globe size={14} /> Protocol References (3 Max)
                        </h4>
                        {formData.ref_links.map((link: any, idx: number) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input 
                                    type="text" 
                                    value={link.label} 
                                    onChange={e => {
                                        const newLinks = [...formData.ref_links];
                                        newLinks[idx].label = e.target.value;
                                        setFormData({...formData, ref_links: newLinks});
                                    }} 
                                    placeholder="Label (e.g. Twitter)" 
                                    className="md:col-span-1 text-xs font-bold p-3 border border-gray-200 outline-none bg-white" 
                                />
                                <input 
                                    type="text" 
                                    value={link.url} 
                                    onChange={e => {
                                        const newLinks = [...formData.ref_links];
                                        newLinks[idx].url = e.target.value;
                                        setFormData({...formData, ref_links: newLinks});
                                    }} 
                                    placeholder="https://..." 
                                    className="md:col-span-2 text-xs p-3 border border-gray-200 outline-none bg-white" 
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- RIGHT COLUMN: AI & FORGE --- */}
                <div className="lg:col-span-5 space-y-10">
                    <div className="p-6 border border-gray-100 rounded-sm space-y-6 bg-gray-50/30 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} /> Intelligence Core
                            </h4>
                            <div className="flex items-center gap-2">
                                <div className="px-3 py-1 bg-white border border-gray-200 rounded-full flex items-center gap-2 shadow-sm">
                                    <Database size={12} className="text-blue-500" />
                                    <span className="text-[10px] font-black">{profile.ai_credits || 0} Credits</span>
                                </div>
                                <button 
                                    onClick={handleDeposit} 
                                    disabled={isDepositing}
                                    className="p-1.5 bg-black text-white rounded-full hover:bg-gray-800 transition-all shadow-md disabled:opacity-50"
                                    title="Top Up Credits"
                                >
                                    {isDepositing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <p className="text-[9px] font-black uppercase text-gray-400 ml-1">Narrative Atmosphere</p>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_ATMOSPHERES.map(style => (
                                        <div 
                                            key={style} 
                                            onClick={() => {
                                                setFormData({...formData, ai_atmosphere: style});
                                                setIsCustomAtmosphere(false);
                                            }} 
                                            className={`text-[8px] font-black uppercase px-3 py-2 border cursor-pointer transition-all ${!isCustomAtmosphere && formData.ai_atmosphere === style ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-black'}`}
                                        >
                                            {style}
                                        </div>
                                    ))}
                                    <div 
                                        onClick={() => setIsCustomAtmosphere(true)} 
                                        className={`text-[8px] font-black uppercase px-3 py-2 border cursor-pointer transition-all ${isCustomAtmosphere ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-black'} flex items-center gap-1.5`}
                                    >
                                        <Edit3 size={10} /> Custom
                                    </div>
                                </div>
                                {isCustomAtmosphere && (
                                    <input 
                                        type="text" 
                                        value={formData.ai_atmosphere} 
                                        onChange={e => setFormData({...formData, ai_atmosphere: e.target.value})} 
                                        placeholder="Enter atmosphere (e.g. Star Wars, Noir...)" 
                                        className="w-full text-xs p-3 border border-black outline-none bg-white animate-in slide-in-from-top-1 duration-200" 
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-8 border-2 border-black rounded-sm bg-white shadow-2xl space-y-6 relative overflow-hidden">
                        {isAnalyzingDna && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white gap-4 animate-in fade-in duration-300">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                                    <Scan className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" size={24} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">AI Scan Active</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Extracting Character DNA...</span>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-black text-white rounded-sm"><Fingerprint size={16} /></div>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em]">Key Forge</h3>
                        </div>

                        <div className="aspect-square bg-gray-50 border border-dashed border-gray-200 rounded-sm relative overflow-hidden group">
                            {forgeData.image_url ? <img src={forgeData.image_url} className="w-full h-full object-cover" alt="Mascot preview" /> : <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-2"><Camera size={32} /></div>}
                            <div onClick={() => mascotImgRef.current?.click()} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer">Upload DNA</div>
                            <input ref={mascotImgRef} type="file" className="hidden" accept="image/*" onChange={handleMascotImageUpload} />
                        </div>

                        <div className="space-y-4">
                            <input 
                                type="text" 
                                value={forgeData.name} 
                                onChange={e => {
                                    setForgeData({...forgeData, name: e.target.value});
                                    if (forgeErrors.includes('name')) setForgeErrors(prev => prev.filter(err => err !== 'name'));
                                }} 
                                placeholder="Protocol Name" 
                                className={`w-full text-xs font-bold p-3 border outline-none transition-all ${forgeErrors.includes('name') ? 'border-red-500 bg-red-50/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-gray-100 bg-gray-50/50'}`} 
                                disabled={forgeStep==='mint'} 
                            />
                            
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 ml-1">
                                    <Activity size={10} className="text-blue-500" /> Behavioral DNA
                                </div>
                                <textarea 
                                    value={forgeData.personality} 
                                    onChange={e => {
                                        setForgeData({...forgeData, personality: e.target.value});
                                        if (forgeErrors.includes('personality')) setForgeErrors(prev => prev.filter(err => err !== 'personality'));
                                    }} 
                                    placeholder="Character mindset & voice..." 
                                    className={`w-full text-xs p-3 border outline-none transition-all min-h-[80px] ${forgeErrors.includes('personality') ? 'border-red-500 bg-red-50/10' : 'border-gray-100 bg-gray-50/50'}`} 
                                    disabled={forgeStep==='mint'} 
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 ml-1">
                                    <EyeIcon size={10} className="text-green-500" /> Physical DNA (Visuals)
                                </div>
                                <textarea value={forgeData.visual_desc} onChange={e => setForgeData({...forgeData, visual_desc: e.target.value})} placeholder="Clothing, build, colors..." className="w-full text-xs p-3 border border-gray-100 outline-none bg-gray-50/50 min-h-[80px]" disabled={forgeStep==='mint'} />
                            </div>

                            <input type="number" value={forgeData.price} onChange={e => setForgeData({...forgeData, price: e.target.value})} placeholder="Price ($HASH)" className="w-full text-xs font-bold p-3 border border-gray-100 outline-none bg-gray-50/50" disabled={forgeStep==='mint'} />
                        </div>

                        {forgeStep === 'dna' ? (
                            <button onClick={handleSealGenes} disabled={isForging || isAnalyzingDna || !forgeData.image_url} className="w-full bg-black text-white py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-gray-800 transition-all shadow-xl disabled:opacity-50">
                                {isForging ? <Loader2 size={14} className="animate-spin" /> : <><Database size={14} /> Seal Genes (Step 1)</>}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <button onClick={handleIgniteKey} disabled={isForging} className="w-full bg-yellow-400 text-black py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-yellow-500 transition-all shadow-xl">
                                    {isForging ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} /> Ignite Key (Step 2)</>}
                                </button>
                                <button onClick={() => setForgeStep('dna')} className="w-full text-[9px] font-bold uppercase text-gray-400 hover:text-black">Edit DNA Again</button>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="w-full bg-black text-white py-5 text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl flex items-center justify-center gap-3 hover:bg-gray-900 transition-all sticky bottom-8 z-10"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Seal All Changes</>}
                    </button>
                </div>
            </div>
        </div>
      )}
    </header>
  );
}

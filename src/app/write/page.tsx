"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getContract, prepareContractCall, toWei, createThirdwebClient, readContract } from "thirdweb";
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Image as ImageIcon, Send, X, AlertCircle, 
  Bold, Italic, Link as LinkIcon, Loader2, Upload,
  Sparkles, PenLine, Lock, CheckCircle2, Megaphone, Zap, Settings2, ShoppingCart, ChevronDown
} from "lucide-react";
import Link from "next/link";
import { client, HASH_TOKEN_ADDRESS, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI } from "@/lib/web3";
import { getAuthMessage } from "@/lib/auth";
import imageCompression from "browser-image-compression";

const PROJECT_WALLET = "0x39adfb3eb6ff7f56bd5c09c62b4ab1d61997193a";
const GEN_PRICE = "10";
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.7,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/webp",
  initialQuality: 0.9,
};

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function WritePage() {
  const account = useActiveAccount();
  const router = useRouter();
  const { mutate: sendTransaction } = useSendTransaction();
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerDescription, setBannerDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [mood, setMood] = useState("sarcastic");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "publishing" | "success" | "error">("idle");
  const [profile, setProfile] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<"manual" | "ai">("manual");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [ownedMascots, setOwnedMascots] = useState<any[]>([]);
  const [selectedNftId, setSelectedNftId] = useState<string | null>(null);
  const [isFetchingMascots, setIsFetchingMascots] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [processingStep, setProcessingStep] = useState<"idle" | "scraping" | "rewriting" | "persisting" | "done">("idle");
  
  const sessionAuth = useRef<{ signature: string, message: string } | null>(null);

  const getSessionSignature = async (action: string) => {
    if (!account) throw new Error("Connect wallet");
    if (sessionAuth.current) return sessionAuth.current;

    addNotification("Authorizing Session...", "info");
    const message = getAuthMessage("authorize session", account.address.toLowerCase());
    const signature = await account.signMessage({ message });
    
    sessionAuth.current = { signature, message };
    return sessionAuth.current;
  };

  const addNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const uploadToStorage = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "IPFS Upload failed");
      return data.url;
    } catch (error: any) {
      console.error("❌ [Upload API] Pinata failed:", error.message);
      throw error;
    }
  };

  const fetchOwnedMascots = useCallback(async () => {
    if (!account?.address) return;
    setIsFetchingMascots(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const nextId = await readContract({ contract, method: "function nextTokenId() view returns (uint256)", params: [] });
      
      const ownedIds = [];
      for (let i = 0; i < Number(nextId); i++) {
        const balance = await readContract({ contract, method: "function balanceOf(address, uint256) view returns (uint256)", params: [account.address, BigInt(i)] });
        if (balance > 0n) ownedIds.push(i);
      }

      if (ownedIds.length > 0) {
        const { data: dnas } = await supabase
            .from('mascots_dna')
            .select('id, name, image_url')
            .in('id', ownedIds)
            .eq('contract_address', MASCOTS_CONTRACT_ADDRESS.toLowerCase());

        const finalMascots = ownedIds.map(id => {
            const dna = dnas?.find(d => d.id === id);
            return {
                id: String(id),
                name: dna?.name || `Protocol #${id}`,
                image: dna?.image_url || "/logo-pager.png"
            };
        });

        setOwnedMascots(finalMascots);
        
        if (!selectedNftId) {
            if (profile?.ai_nft_token_id && finalMascots.some(m => m.id === profile.ai_nft_token_id)) {
                setSelectedNftId(profile.ai_nft_token_id);
            } else {
                setSelectedNftId(finalMascots[0].id);
            }
        }
      }
    } catch (e) { console.error("❌ [WritePage] Error fetching owned mascots:", e); }
    setIsFetchingMascots(false);
  }, [account?.address, profile?.ai_nft_token_id, selectedNftId]);

  useEffect(() => { fetchOwnedMascots(); }, [fetchOwnedMascots]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const moods = [
    { id: "sarcastic", label: "Sarcastic", icon: "🎭" },
    { id: "bullish", label: "Bullish", icon: "🚀" },
    { id: "bearish", label: "Bearish", icon: "📉" },
    { id: "humorous", label: "Humorous", icon: "😆" },
    { id: "negative", label: "Negative", icon: "💀" },
    { id: "fomo", label: "FOMO", icon: "🔥" },
  ];

  const handleAiRewrite = async () => {
    if (!externalUrl) return alert("Paste a link first!");
    if (!selectedNftId) return alert("Select an NFT Mascot first!");
    if (!account) return alert("Connect wallet");
    
    setIsAiProcessing(true);
    setProcessingStep("scraping");
    
    try {
      const { signature, message } = await getSessionSignature("authorize session");
      const scrapeRes = await fetch("/api/ai/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: externalUrl }) });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scrapeData.error || "Scraping failed");

      setProcessingStep("rewriting");
      const processRes = await fetch("/api/ai/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: scrapeData.textContent, title: scrapeData.title, mood, nftTokenId: selectedNftId, atmosphere: profile?.ai_atmosphere || "Rick and Morty", userAddress: account.address.toLowerCase(), signature, message, skipBanner: false }), signal: AbortSignal.timeout(95000) });
      const data = await processRes.json();
      if (!processRes.ok) { if (processRes.status === 402) throw new Error("Insufficient AI Credits. Top up in your profile."); throw new Error(data.error || "Forge failed"); }
      setTitle(data.title);
      if (editorRef.current) editorRef.current.innerHTML = data.content;
      if (data.banner_description) setBannerDescription(data.banner_description);
      if (data.image_url) setImageUrl(data.image_url);
      addNotification("Magic Forge synchronized!", "success");
      setProcessingStep("done");
      setTimeout(() => { setProcessingStep("idle"); setActiveMode("manual"); }, 2000);
      fetchProfile(); 
    } catch (err: any) { console.error("❌ [Magic Forge Error]:", err); addNotification(err.message, "error"); setProcessingStep("idle"); } finally { setIsAiProcessing(false); }
  };

  const handleRegenerateBanner = async () => {
    if (!selectedNftId || !title) return;
    if (!account) return alert("Connect wallet");
    setIsRegenerating(true);
    try {
      addNotification("Regenerating banner...", "success");
      const { signature, message } = await getSessionSignature("authorize session");
      const res = await fetch("/api/ai/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ onlyBanner: true, bannerDescription, title, mood, nftTokenId: selectedNftId, atmosphere: profile?.ai_atmosphere || "Rick and Morty", userAddress: account.address.toLowerCase(), signature, message }), signal: AbortSignal.timeout(95000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      if (data.image_url) { setImageUrl(data.image_url); addNotification("Banner updated!", "success"); fetchProfile(); }
    } catch (err: any) { addNotification(err.message, "error"); } finally { setIsRegenerating(false); }
  };

  const fetchProfile = useCallback(async () => {
    if (!account?.address) return;
    try {
      const res = await fetch(`/api/profile?address=${account.address.toLowerCase()}`);
      const data = await res.json();
      if (res.ok && data.profile) {
          setProfile(data.profile);
          if (data.profile.ai_nft_token_id && !selectedNftId) setSelectedNftId(data.profile.ai_nft_token_id);
      }
    } catch (err) { console.error("❌ [WritePage] Profile fetch failed:", err); }
  }, [account?.address, selectedNftId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);
      const url = await uploadToStorage(new File([compressedBlob], `${Date.now()}.webp`, { type: "image/webp" }));
      setImageUrl(url);
    } catch (error: any) { alert(error.message || "Upload failed"); } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handlePublish = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!account) return alert("Connect wallet");
    if (!title || !content || content === "<br>") return alert("Title and Content required");
    setStatus("publishing");
    try {
      const authMessage = getAuthMessage("publish article", account.address.toLowerCase());
      const signature = await account.signMessage({ message: authMessage });
      const res = await fetch("/api/article/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, image_url: imageUrl || null, author_address: account.address.toLowerCase(), signature, message: authMessage }) });
      if (!res.ok) { const errData = await res.json().catch(() => ({ error: "Server returned error" })); throw new Error(errData.error || "Failed to create article"); }
      const resData = await res.json();
      const articleId = resData.article.id;
      const targets = resData.article.distributionTargets || resData.distributionTargets;
      if (targets) {
        const channelsCount = (targets.binance?.length || 0) + (targets.telegram?.length || 0) + (targets.global ? 1 : 0);
        const batchMsg = getAuthMessage(`distribute to ${channelsCount} channels`, account.address.toLowerCase());
        const batchSig = await account.signMessage({ message: batchMsg });
        if (targets.global) { await fetch("/api/distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId, channelType: 'global', account: {}, profileAddress: account.address, signature: batchSig, message: batchMsg }) }).catch(e => console.error("Global Feed Error:", e)); }
        for (const accObj of (targets.binance || [])) { await fetch("/api/distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId, channelType: 'binance', account: accObj, profileAddress: account.address, signature: batchSig, message: batchMsg }) }).catch(e => console.error("Binance Error:", e)); }
        for (const chObj of (targets.telegram || [])) { await fetch("/api/distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId, channelType: 'telegram', account: chObj, profileAddress: account.address, signature: batchSig, message: batchMsg }) }).catch(e => console.error("Telegram Error:", e)); }
      }
      setStatus("success");
      addNotification("Protocol distribution initiated!", "success");
      setTimeout(() => router.push("/"), 3000);
    } catch (err: any) { console.error("❌ [Publish Error]:", err); setStatus("error"); addNotification(`Failed: ${err.message}`, "error"); }
  };

  const selectedMascot = ownedMascots.find(m => m.id === selectedNftId);

  if (!account) return <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]"><Link href="/" className="btn-primary">Back to Feed</Link></div>;

  return (
    <main className="min-h-screen bg-white relative pb-32">
      <nav className="border-b border-[var(--border-soft)] h-16 flex items-center justify-between px-6 md:px-12 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-black uppercase tracking-tighter">Pager</Link>
          <div className="h-4 w-[1px] bg-gray-200" />
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Story Forge</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={handlePublish} disabled={status !== "idle" || !title} className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50 font-black uppercase tracking-widest text-[10px]">
            {status === "idle" ? <>Publish <Send size={14} /></> : <Loader2 size={14} className="animate-spin" />}
          </button>
        </div>
      </nav>

      <div className="flex justify-center mt-8">
        <div className="flex items-center bg-gray-50 p-1.5 rounded-full border border-gray-100">
           <button onClick={() => setActiveMode("manual")} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${activeMode === "manual" ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}><PenLine size={14} /> Standard</button>
           <button onClick={() => setActiveMode("ai")} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${activeMode === "ai" ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}><Sparkles size={14} /> Magic</button>
        </div>
      </div>

      <div className={`transition-all duration-500 bg-gray-50 border-y border-gray-100 mt-8 relative z-40 ${activeMode === "ai" ? 'min-h-[160px] opacity-100 py-10 overflow-visible' : 'max-h-0 opacity-0 invisible overflow-hidden'}`}>
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          {ownedMascots.length === 0 && !isFetchingMascots ? (
            <div className="text-center py-8 bg-white border border-gray-100 p-8 rounded-sm">
                <AlertCircle className="mx-auto text-red-500 mb-4" size={32} />
                <h3 className="text-sm font-black uppercase tracking-widest mb-2">NFT Mascot Required</h3>
                <p className="text-xs text-gray-400 mb-6 uppercase font-bold">Magic Forge requires an active Mascot Protocol in your wallet.</p>
                <Link href="/mascots" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-[10px] font-black uppercase tracking-widest"><ShoppingCart size={14} /> Visit Registry</Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <input 
                    type="text" 
                    placeholder="Paste source link..." 
                    value={externalUrl} 
                    onChange={e => setExternalUrl(e.target.value)} 
                    className="md:col-span-4 px-4 py-3 text-sm border border-gray-200 focus:border-black outline-none bg-white transition-colors font-medium rounded-sm" 
                  />
                  
                  {/* Custom Mascot Dropdown */}
                  <div className="md:col-span-3 relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-3 bg-white border border-gray-200 rounded-sm hover:border-black transition-all group"
                    >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            {selectedMascot ? (
                                <>
                                    <img src={selectedMascot.image} className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0 group-hover:scale-110 transition-transform" alt="" />
                                    <span className="text-[10px] font-black uppercase truncate tracking-tight">{selectedMascot.name}</span>
                                </>
                            ) : (
                                <span className="text-[10px] font-black uppercase text-gray-400">Protocol</span>
                            )}
                        </div>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] max-h-72 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-300">
                            {ownedMascots.map(m => (
                                <div 
                                    key={m.id} 
                                    onClick={() => { setSelectedNftId(m.id); setIsDropdownOpen(false); }}
                                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${selectedNftId === m.id ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="relative shrink-0">
                                        <img src={m.image} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" alt="" />
                                        {selectedNftId === m.id && <div className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full p-0.5 border-2 border-white"><CheckCircle2 size={8} className="text-black" /></div>}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-black uppercase truncate tracking-tighter">{m.name}</span>
                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Protocol Key #{m.id}</span>
                                    </div>
                                    {selectedNftId === m.id && <Zap size={10} className="ml-auto text-yellow-400 fill-yellow-400" />}
                                </div>
                            ))}
                        </div>
                    )}
                  </div>

                  <div className="md:col-span-2 relative">
                    <select 
                        value={mood} 
                        onChange={e => setMood(e.target.value)} 
                        className="w-full px-3 py-3 text-[10px] font-black uppercase tracking-widest border border-gray-200 outline-none bg-white cursor-pointer appearance-none pr-8 rounded-sm hover:border-black transition-all"
                    >
                        {moods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  <button 
                    onClick={handleAiRewrite} 
                    disabled={isAiProcessing || !externalUrl || !selectedNftId} 
                    className="md:col-span-3 bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl rounded-sm"
                  >
                    {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Sparkles size={14} /> Initiate Forge</>}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                {processingStep !== "idle" ? (
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-black">
                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.5)]" /> Forge Status: {processingStep}...
                    </div>
                ) : <div />}
                
                <Link href={`/mascots`} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-all">
                    <Settings2 size={12} /> Registry
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12 space-y-8 relative z-10">
        <input type="text" placeholder="Story Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full text-4xl md:text-6xl font-black border-none focus:outline-none placeholder:text-gray-100 uppercase tracking-tighter" />
        <div className="border-y border-gray-50 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-3 text-gray-300 focus-within:text-black">
              <ImageIcon size={20} />
              <input type="text" placeholder="Banner URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full text-[10px] font-black uppercase tracking-widest border-none focus:outline-none bg-transparent" />
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors">{isUploading ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16} /> Upload</>}</button>
            <button onClick={handleRegenerateBanner} disabled={isRegenerating || !title || !selectedNftId} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 transition-colors">{isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <><Sparkles size={14} /> Regenerate</>}</button>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
          </div>
          {imageUrl && <div className="aspect-video bg-gray-50 overflow-hidden border border-gray-100 rounded-sm relative group"><img src={imageUrl} alt="Banner" className="w-full h-full object-cover" /><button onClick={() => setImageUrl("")} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black"><X size={14} /></button></div>}
        </div>
        <div ref={editorRef} contentEditable data-placeholder="Start your story here..." className="w-full min-h-[500px] text-xl outline-none prose prose-stone max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-200 empty:before:pointer-events-none leading-[1.8] typography-body" />
      </div>

      <div className="fixed bottom-8 right-8 z-[100] space-y-3 pointer-events-none">
        {notifications.map(notif => (
          <div key={notif.id} className={`flex items-center gap-3 px-6 py-4 rounded-sm shadow-2xl border-l-4 animate-in slide-in-from-right-full duration-300 pointer-events-auto ${notif.type === 'success' ? 'bg-black text-white border-green-500' : notif.type === 'error' ? 'bg-red-600 text-white border-red-800' : 'bg-gray-900 text-white border-blue-500'}`}>
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-widest opacity-50">Protocol</span><span className="text-sm font-bold">{notif.message}</span></div>
          </div>
        ))}
      </div>
    </main>
  );
}

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
  Sparkles, PenLine, Lock, CheckCircle2, Megaphone, Zap, Settings2, ShoppingCart
} from "lucide-react";
import Link from "next/link";
import { client, HASH_TOKEN_ADDRESS, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI } from "@/lib/web3";
import imageCompression from "browser-image-compression";
import { upload, resolveScheme } from "thirdweb/storage";

const PROJECT_WALLET = "0x39adfb3eb6ff7f56bd5c09c62b4ab1d61997193a";
const POST_PRICE = "10";
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.7,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/webp",
  initialQuality: 0.9,
};

// Fallback gateways for IPFS
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.ipn.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/"
];

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

  const [processingStep, setProcessingStep] = useState<"idle" | "scraping" | "rewriting" | "persisting" | "done">("idle");

  const addNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // --- Persistence Logic ---
  const persistAiImage = async (url: string) => {
    if (!url || url.startsWith('https://gateway.ipn.io') || url.includes('supabase.co')) return url;
    
    try {
      setProcessingStep("persisting");
      const response = await fetch(url);
      const blob = await response.blob();
      
      if (blob.size < (COMPRESSION_OPTIONS.maxSizeMB * 1024 * 1024) * 0.8) {
        const fileToUpload = new File([blob], `ai-${Date.now()}.png`, { type: blob.type });
        return await uploadToStorage(fileToUpload);
      }

      const file = new File([blob], "ai-banner.png", { type: blob.type });
      const compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);
      const fileToUpload = new File([compressedBlob], `ai-${Date.now()}.webp`, { type: "image/webp" });
      return await uploadToStorage(fileToUpload);
    } catch (e) {
      console.error("❌ [Persist] Failed to save AI image:", e);
      return url;
    }
  };

  const uploadToStorage = async (file: File) => {
    const clientId = profile?.thirdweb_client_id;
    if (clientId) {
      const customClient = createThirdwebClient({ clientId });
      const uri = await upload({ client: customClient, files: [file] });
      return resolveScheme({ client: customClient, uri });
    } else {
      const { data, error } = await supabase.storage.from('banners').upload(`banners/${file.name}`, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(data.path);
      return publicUrl;
    }
  };

  const fetchMascotMetadata = async (uri: string) => {
    const cid = uri.replace("ipfs://", "");
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const res = await fetch(`${gateway}${cid}`, { 
          signal: AbortSignal.timeout(5000),
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn(`Gateway ${gateway} failed, trying next...`);
        continue;
      }
    }
    return null;
  };

  const fetchOwnedMascots = useCallback(async () => {
    if (!account?.address) return;
    setIsFetchingMascots(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const nextId = await readContract({ contract, method: "function nextTokenId() view returns (uint256)", params: [] });
      
      const owned = [];
      for (let i = 0; i < Number(nextId); i++) {
        const balance = await readContract({ contract, method: "function balanceOf(address, uint256) view returns (uint256)", params: [account.address, BigInt(i)] });
        if (balance > 0n) {
          const uri = await readContract({ contract, method: "function uri(uint256) view returns (string)", params: [BigInt(i)] });
          const metadata = await fetchMascotMetadata(uri);
          owned.push({ id: i, uri, name: metadata?.name || `Mascot #${i}` });
        }
      }
      setOwnedMascots(owned);
      if (owned.length > 0 && !selectedNftId) {
          if (profile?.ai_nft_token_id && owned.some(m => String(m.id) === profile.ai_nft_token_id)) {
              setSelectedNftId(profile.ai_nft_token_id);
          } else {
              setSelectedNftId(String(owned[0].id));
          }
      }
    } catch (e) { console.error("❌ [WritePage] Error fetching owned mascots:", e); }
    setIsFetchingMascots(false);
  }, [account?.address, profile?.ai_nft_token_id, selectedNftId]);

  useEffect(() => { fetchOwnedMascots(); }, [fetchOwnedMascots]);

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

    setIsAiProcessing(true);
    setProcessingStep("scraping");
    
    try {
      const scrapeRes = await fetch("/api/ai/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: externalUrl })
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scrapeData.error || "Scraping failed");

      setProcessingStep("rewriting");
      const processRes = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: scrapeData.textContent,
          title: scrapeData.title,
          mood,
          nftTokenId: selectedNftId,
          imageModel: profile?.ai_image_model,
          atmosphere: profile?.ai_atmosphere || "Rick and Morty",
          userAddress: account?.address
        })
      });
      const data = await processRes.json();
      if (!processRes.ok) throw new Error(data.error || "Rewriting failed");

      setTitle(data.title);
      if (editorRef.current) editorRef.current.innerHTML = data.content;
      if (data.banner_description) setBannerDescription(data.banner_description);

      if (data.image_url) {
        const permanentUrl = await persistAiImage(data.image_url);
        setImageUrl(permanentUrl);
        addNotification("Content protocol synchronized", "success");
      }
      
      setProcessingStep("done");
      setTimeout(() => { setProcessingStep("idle"); setActiveMode("manual"); }, 2000);
    } catch (err: any) {
      addNotification(err.message, "error");
      setProcessingStep("idle");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleRegenerateBanner = async () => {
    if (!profile?.ai_api_key || !selectedNftId) return;
    setIsRegenerating(true);
    
    try {
        const res = await fetch("/api/ai/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              onlyBanner: true,
              bannerDescription,
              title,
              mood,
              nftTokenId: selectedNftId,
              userApiKey: profile?.ai_api_key,
              imageModel: profile?.ai_image_model,
              atmosphere: profile?.ai_atmosphere || "Rick and Morty",
              userAddress: account?.address
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Regeneration failed");
        if (data.image_url) {
            const permanentUrl = await persistAiImage(data.image_url);
            setImageUrl(permanentUrl);
            addNotification("Banner updated!", "success");
        }
    } catch (err: any) {
        addNotification(err.message, "error");
    } finally {
        setIsRegenerating(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    if (!account?.address) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('address', account.address.toLowerCase()).maybeSingle();
      if (data) {
          setProfile(data);
          if (data.ai_nft_token_id) setSelectedNftId(data.ai_nft_token_id);
      }
    } catch (err) { console.error(err); }
  }, [account?.address]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const { data: balance } = useWalletBalance({ client, chain: base, address: account?.address, tokenAddress: HASH_TOKEN_ADDRESS });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);
      const url = await uploadToStorage(new File([compressedBlob], `${Date.now()}.webp`, { type: "image/webp" }));
      setImageUrl(url);
    } catch (error: any) {
      alert(error.message || "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePublish = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!account) return alert("Connect wallet");
    if (!title || !content || content === "<br>") return alert("Title and Content required");
    if (parseFloat(balance?.displayValue || "0") < parseFloat(POST_PRICE)) return alert("Insufficient $HASH.");

    setStatus("paying");
    try {
        const contract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
        const transaction = prepareContractCall({
          contract,
          method: "function transfer(address to, uint256 value)",
          params: [PROJECT_WALLET, BigInt(toWei(POST_PRICE))],
        });

        sendTransaction(transaction, {
          onSuccess: async () => {
            setStatus("publishing");
            try {
              const res = await fetch("/api/article/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content, image_url: imageUrl || null, author_address: account.address.toLowerCase() })
              });
              
              if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: "Server returned error" }));
                throw new Error(errData.error || "Failed to create article");
              }
              
              const resData = await res.json();
              const articleId = resData.article.id;
              const targets = resData.article.distributionTargets || resData.distributionTargets;

              if (targets) {
                if (targets.global) {
                  addNotification("Publishing to Global Feed...", "info");
                  await fetch("/api/distribution", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ articleId, channelType: 'global', account: {}, profileAddress: account.address }) 
                  }).catch(e => console.error("Global Feed Error:", e));
                }
                
                for (const accObj of (targets.binance || [])) {
                  addNotification(`Posting to Binance Square: ${accObj.label}...`, "info");
                  await fetch("/api/distribution", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ articleId, channelType: 'binance', account: accObj, profileAddress: account.address }) 
                  }).catch(e => console.error("Binance Error:", e));
                }

                for (const chObj of (targets.telegram || [])) {
                  addNotification(`Posting to Telegram: ${chObj.label}...`, "info");
                  await fetch("/api/distribution", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ articleId, channelType: 'telegram', account: chObj, profileAddress: account.address }) 
                  }).catch(e => console.error("Telegram Error:", e));
                }
              }

              setStatus("success");
              addNotification("Protocol distribution initiated!", "success");
              setTimeout(() => router.push("/"), 3000);
            } catch (err: any) { 
              console.error("❌ [Publish Error]:", err);
              setStatus("error");
              addNotification(`Failed: ${err.message}`, "error");
            }
          },
          onError: (err) => { 
            setStatus("error"); 
            addNotification(`Payment failed: ${err.message}`, "error");
          }
        });
    } catch (err: any) { 
        setStatus("error"); 
        addNotification(`Critical Error: ${err.message}`, "error");
    }
  };

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

      <div className={`overflow-hidden transition-all duration-500 bg-gray-50 border-y border-gray-100 mt-8 ${activeMode === "ai" ? 'min-h-[200px] opacity-100 py-12' : 'max-h-0 opacity-0'}`}>
        <div className="max-w-4xl mx-auto px-6 space-y-6">
          {(!profile?.ai_api_key) ? (
            <div className="text-center py-4 text-gray-400 text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-3">
              <Lock size={18} /> API Key Locked. Check Profile Settings.
            </div>
          ) : ownedMascots.length === 0 && !isFetchingMascots ? (
            <div className="text-center py-8 bg-white border border-gray-100 p-8">
                <AlertCircle className="mx-auto text-red-500 mb-4" size={32} />
                <h3 className="text-sm font-black uppercase tracking-widest mb-2">NFT Mascot Required</h3>
                <p className="text-xs text-gray-400 mb-6 uppercase font-bold">Magic Forge requires an active Mascot Protocol in your wallet.</p>
                <Link href="/character" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-[10px] font-black uppercase tracking-widest"><ShoppingCart size={14} /> Visit Registry</Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <input type="text" placeholder="Paste source link..." value={externalUrl} onChange={e => setExternalUrl(e.target.value)} className="flex-[3] px-4 py-3 text-sm border border-gray-200 focus:border-black outline-none bg-white transition-colors font-medium" />
                  <select value={mood} onChange={e => setMood(e.target.value)} className="flex-1 px-3 py-3 text-xs font-black uppercase tracking-widest border border-gray-200 outline-none bg-white cursor-pointer appearance-none">{moods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}</select>
                  <button onClick={handleAiRewrite} disabled={isAiProcessing || !externalUrl || !selectedNftId} className="flex-1 bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl">{isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : "Initiate Forge"}</button>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 border border-gray-100">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 shrink-0"><Zap size={14} /> Protocol Switcher:</div>
                  <div className="flex flex-1 gap-2 overflow-x-auto no-scrollbar py-1">
                     {ownedMascots.map(m => (
                       <button 
                          key={m.id}
                          onClick={() => setSelectedNftId(String(m.id))}
                          className={`flex items-center gap-2 px-4 py-2 rounded-sm border transition-all shrink-0 ${selectedNftId === String(m.id) ? 'bg-black text-white border-black shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-300'}`}
                       >
                          <span className="text-[10px] font-black uppercase tracking-tight">{m.name}</span>
                       </button>
                     ))}
                  </div>
                  <Link href={`/character`} className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-[9px] font-black uppercase tracking-widest hover:border-black transition-all"><Settings2 size={12} /> Registry</Link>
                </div>
              </div>
              {processingStep !== "idle" && <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter text-black"><div className="w-1.5 h-1.5 bg-black rounded-full animate-ping" /> Forge Status: {processingStep}...</div>}
            </>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12 space-y-8">
        <input type="text" placeholder="Story Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full text-4xl md:text-6xl font-black border-none focus:outline-none placeholder:text-gray-100 uppercase tracking-tighter" />
        <div className="border-y border-gray-50 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-3 text-gray-300 focus-within:text-black">
              <ImageIcon size={20} />
              <input type="text" placeholder="Banner URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full text-[10px] font-black uppercase tracking-widest border-none focus:outline-none bg-transparent" />
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors">{isUploading ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16} /> Upload</>}</button>
            {profile?.ai_api_key && <button onClick={handleRegenerateBanner} disabled={isRegenerating || !title || !selectedNftId} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 transition-colors">{isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <><Sparkles size={14} /> Regenerate</>}</button>}
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

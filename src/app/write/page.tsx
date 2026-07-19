"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon, Send, X, AlertCircle,
  Loader2, Upload, Sparkles, PenLine, Settings2,
  ShoppingCart, ChevronDown, Zap
} from "lucide-react";
import Link from "next/link";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI } from "@/lib/web3";
import { getAuthMessage } from "@/lib/auth";
import { MOODS } from "@/lib/moods";
import { BFL_MODELS, DEFAULT_BFL_MODEL, type BflModelId } from "@/lib/bfl-models";
import imageCompression from "browser-image-compression";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.7, maxWidthOrHeight: 1920, useWebWorker: true,
  fileType: "image/webp", initialQuality: 0.9,
};

interface Notification {
  id: string; message: string; type: "success" | "error" | "info";
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500 && i < retries) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return res;
    } catch (err) {
      if (i >= retries) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error("fetchWithRetry exhausted");
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
  const [status, setStatus] = useState<"idle" | "publishing" | "success" | "error">("idle");
  const [profile, setProfile] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<"manual" | "ai">("manual");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [ownedMascots, setOwnedMascots] = useState<any[]>([]);
  const [selectedNftId, setSelectedNftId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<BflModelId>(DEFAULT_BFL_MODEL);
  const [isFetchingMascots, setIsFetchingMascots] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [processingStep, setProcessingStep] = useState<"idle" | "scraping" | "rewriting" | "banner" | "done">("idle");
  const [contentKey, setContentKey] = useState(0);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  const addNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const uploadToStorage = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error || "Upload failed");
    return data.url;
  };

  const fetchOwnedMascots = useCallback(async () => {
    if (!account?.address) return;
    setIsFetchingMascots(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });

      const result = await readContract({
        contract,
        method: "function getUserMascots(address) view returns (uint256[], uint256[], (address,uint256,uint32,uint32,bool)[])",
        params: [account.address],
      });

      const [ownedIds, , details] = result;
      const activeIds = ownedIds.filter((_, i) => details[i][4]).map(id => Number(id));

      if (activeIds.length > 0) {
        const { data: dnas } = await supabase.from("mascots_dna").select("id, name, image_url").in("id", activeIds).eq("contract_address", MASCOTS_CONTRACT_ADDRESS.toLowerCase());
        const dnaMap = new Map(dnas?.map(d => [d.id, d]) || []);

        const finalMascots = activeIds.map(id => {
          const dna = dnaMap.get(id);
          return { id: String(id), name: dna?.name || `Protocol #${id}`, image: dna?.image_url || "/logo-pager.png" };
        });

        setOwnedMascots(finalMascots);

        const profileTokenId = profile?.ai_nft_token_id;
        if (profileTokenId && finalMascots.some(m => m.id === profileTokenId)) {
          setSelectedNftId(profileTokenId);
        } else if (finalMascots.length > 0) {
          setSelectedNftId(finalMascots[0].id);
        }
      } else {
        setOwnedMascots([]);
      }
    } catch (e) { console.error("Fetch mascots error:", e); }
    setIsFetchingMascots(false);
  }, [account?.address, profile?.ai_nft_token_id]);

  useEffect(() => { fetchOwnedMascots(); }, [fetchOwnedMascots]);

  useEffect(() => {
    if (pendingContent && editorRef.current) {
      editorRef.current.innerHTML = pendingContent;
      setPendingContent(null);
    }
  }, [contentKey, pendingContent]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAiRewrite = async () => {
    if (!externalUrl) { addNotification("Paste a link first!", "error"); return; }
    if (!selectedNftId) { addNotification("Select an NFT Mascot first!", "error"); return; }
    if (!account) { addNotification("Connect wallet", "error"); return; }

    setIsAiProcessing(true);
    setProcessingStep("scraping");

    try {
      const authMsg = getAuthMessage("authorize session", account.address.toLowerCase());
      const authSig = await account.signMessage({ message: authMsg });

      const scrapeRes = await fetch("/api/ai/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: externalUrl }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scrapeData.error || "Scraping failed");

      setProcessingStep("rewriting");

      const textRes = await fetch("/api/ai/text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: scrapeData.textContent, title: scrapeData.title, mood,
          nftTokenId: selectedNftId, atmosphere: profile?.ai_atmosphere || "Surrealism",
          userAddress: account.address.toLowerCase(), signature: authSig, message: authMsg,
        }),
      });
      const textData = await textRes.json();
      if (!textRes.ok) throw new Error(textData.error || "AI text failed");

      setTitle(textData.title);
      if (textData.content) {
        setPendingContent(textData.content);
        setContentKey(k => k + 1);
      }
      if (textData.banner_description) setBannerDescription(textData.banner_description);

      setProcessingStep("banner");

      const articleContent = editorRef.current?.innerHTML || textData.content || "";
      const bannerRes = await fetchWithRetry("/api/ai/banner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: textData.title, bannerDescription: textData.banner_description, mood,
          nftTokenId: selectedNftId, atmosphere: profile?.ai_atmosphere || "Surrealism",
          userAddress: account.address.toLowerCase(), signature: authSig, message: authMsg,
          content: articleContent, imageModel: selectedModel,
        }),
        signal: AbortSignal.timeout(95000),
      }, 2);
      // Banner generation requires 10 $HASH credits. Top up in Profile settings.
      if (!bannerRes.ok) throw new Error((await bannerRes.json()).error || "Banner generation failed");
      const bannerData = await bannerRes.json();
      if (bannerData.image_url) setImageUrl(bannerData.image_url);

      addNotification("Article ready!", "success");
      setProcessingStep("done");
      setTimeout(() => { setProcessingStep("idle"); setActiveMode("manual"); }, 1500);
      fetchProfile();
    } catch (err: any) {
      addNotification(err.message, "error");
      setProcessingStep("idle");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleRegenerateBanner = async () => {
    if (!selectedNftId || !title || !account) return;
    try {
      addNotification("Regenerating banner...", "info");
      const authMsg = getAuthMessage("authorize session", account.address.toLowerCase());
      const authSig = await account.signMessage({ message: authMsg });

      const articleContent = editorRef.current?.innerHTML || "";
      const res = await fetchWithRetry("/api/ai/banner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, bannerDescription, mood, nftTokenId: selectedNftId,
          atmosphere: profile?.ai_atmosphere || "Surrealism",
          userAddress: account.address.toLowerCase(), signature: authSig, message: authMsg,
          content: articleContent, imageModel: selectedModel,
        }),
        signal: AbortSignal.timeout(95000),
      }, 2);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      if (data.image_url) { setImageUrl(data.image_url); addNotification("Banner updated!"); fetchProfile(); }
    } catch (err: any) { addNotification(err.message, "error"); }
  };

  const fetchProfile = useCallback(async () => {
    if (!account?.address) return;
    try {
      const res = await fetch(`/api/profile?address=${account.address.toLowerCase()}`);
      const data = await res.json();
      if (res.ok && data.profile) setProfile(data.profile);
    } catch (err) { console.error(err); }
  }, [account?.address]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      const url = await uploadToStorage(new File([compressed], `${Date.now()}.webp`, { type: "image/webp" }));
      setImageUrl(url);
    } catch (err: any) { addNotification(err.message || "Upload failed", "error"); } finally { setIsUploading(false); }
  };

  const handlePublish = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!account) { addNotification("Connect wallet", "error"); return; }
    if (!title || !content || content === "<br>") { addNotification("Title and Content required", "error"); return; }

    setStatus("publishing");
    try {
      const authMsg = getAuthMessage("publish article", account.address.toLowerCase());
      const authSig = await account.signMessage({ message: authMsg });

      const res = await fetch("/api/article/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, image_url: imageUrl || null, author_address: account.address.toLowerCase(), signature: authSig, message: authMsg }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Server error" }))).error || "Failed");

      const resData = await res.json();
      const articleId = resData.article.id;
      const targets = resData.distributionTargets || resData.article.distributionTargets;

      setStatus("success");
      addNotification("Published!", "success");

      // Distribution is optional — separate try-catch so user reject doesn't hide "Published!"
      try {
        if (targets) {
          const channels: { type: string; account: any }[] = [];

          if (targets.global) channels.push({ type: "global", account: {} });
          targets.binance?.forEach((a: any) => channels.push({ type: "binance", account: a }));
          targets.telegram?.forEach((c: any) => channels.push({ type: "telegram", account: c }));

          if (channels.length > 0) {
            const batchMsg = getAuthMessage("authorize session", account.address.toLowerCase());
            const batchSig = await account.signMessage({ message: batchMsg });

            const distRes = await fetch("/api/distribution/batch", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, targets: channels, profileAddress: account.address, signature: batchSig, message: batchMsg }),
            });
            const distData = await distRes.json();
            if (distData.results) {
              const ok = distData.results.filter((r: any) => r.success).length;
              const fail = distData.results.filter((r: any) => !r.success).length;
              if (fail > 0) addNotification(`${ok}/${ok + fail} channels published`, fail > 0 ? "error" : "success");
            }
          }
        }
      } catch (distErr: any) {
        addNotification(`Distribution: ${distErr.message}`, "error");
      }
      setTimeout(() => router.push("/"), 2000);
    } catch (err: any) {
      setStatus("error");
      addNotification(`Failed: ${err.message}`, "error");
    }
  };

  const selectedMascot = ownedMascots.find(m => m.id === selectedNftId);

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <Link href="/" className="btn-primary">Back to Feed</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white relative pb-32">
      <nav className="border-b border-[var(--border-soft)] h-16 flex items-center justify-between px-6 md:px-12 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-black uppercase tracking-tighter">Pager</Link>
          <div className="h-4 w-[1px] bg-gray-200" />
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Story Forge</span>
        </div>
        <button onClick={handlePublish} disabled={status !== "idle" || !title}
          className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50 font-black uppercase tracking-widest text-[10px]">
          {status === "idle" ? <>Publish <Send size={14} /></> : <Loader2 size={14} className="animate-spin" />}
        </button>
      </nav>

      <div className="flex justify-center mt-8">
        <div className="flex items-center bg-gray-50 p-1.5 rounded-full border border-gray-100">
          <button onClick={() => setActiveMode("manual")}
            className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${activeMode === "manual" ? "bg-white text-black shadow-sm" : "text-gray-400"}`}>
            <PenLine size={14} /> Standard
          </button>
          <button onClick={() => setActiveMode("ai")}
            className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${activeMode === "ai" ? "bg-white text-black shadow-sm" : "text-gray-400"}`}>
            <Sparkles size={14} /> Magic
          </button>
        </div>
      </div>

      <div className={`transition-all duration-500 bg-gray-50 border-y border-gray-100 mt-8 relative z-40 ${activeMode === "ai" ? "min-h-[160px] opacity-100 py-10 overflow-visible" : "max-h-0 opacity-0 invisible overflow-hidden"}`}>
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          {ownedMascots.length === 0 && !isFetchingMascots ? (
            <div className="text-center py-8 bg-white border border-gray-100 p-8 rounded-sm">
              <AlertCircle className="mx-auto text-red-500 mb-4" size={32} />
              <h3 className="text-sm font-black uppercase tracking-widest mb-2">NFT Mascot Required</h3>
              <p className="text-xs text-gray-400 mb-6 uppercase font-bold">Magic Forge requires a Mascot Protocol in your wallet.</p>
              <Link href="/mascots" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-[10px] font-black uppercase tracking-widest"><ShoppingCart size={14} /> Visit Registry</Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <input type="text" placeholder="Paste source link..." value={externalUrl} onChange={e => setExternalUrl(e.target.value)}
                    className="md:col-span-4 px-4 py-3 text-sm border border-gray-200 focus:border-black outline-none bg-white transition-colors font-medium rounded-sm" />

                  <div className="md:col-span-3 relative" ref={dropdownRef}>
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-3 bg-white border border-gray-200 rounded-sm hover:border-black transition-all group">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {selectedMascot ? (
                          <><img src={selectedMascot.image} className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0" alt="" /><span className="text-[10px] font-black uppercase truncate">{selectedMascot.name}</span></>
                        ) : (
                          <span className="text-[10px] font-black uppercase text-gray-400">Protocol</span>
                        )}
                      </div>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ${isDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] max-h-72 overflow-y-auto">
                        {ownedMascots.map(m => (
                          <div key={m.id} onClick={() => { setSelectedNftId(m.id); setIsDropdownOpen(false); }}
                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${selectedNftId === m.id ? "bg-blue-50/50" : ""}`}>
                            <img src={m.image} className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0" alt="" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] font-black uppercase truncate">{m.name}</span>
                              <span className="text-[8px] font-bold text-gray-400 uppercase">Protocol Key #{m.id}</span>
                            </div>
                            {selectedNftId === m.id && <Zap size={10} className="ml-auto text-yellow-400 fill-yellow-400" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 relative">
                    <select value={mood} onChange={e => setMood(e.target.value)}
                      className="w-full px-3 py-3 text-[10px] font-black uppercase tracking-widest border border-gray-200 outline-none bg-white cursor-pointer appearance-none pr-8 rounded-sm hover:border-black transition-all">
                      {MOODS.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  <div className="md:col-span-2 relative">
                    <select value={selectedModel} onChange={e => setSelectedModel(e.target.value as BflModelId)}
                      className="w-full px-3 py-3 text-[10px] font-black uppercase tracking-widest border border-gray-200 outline-none bg-white cursor-pointer appearance-none pr-8 rounded-sm hover:border-black transition-all">
                      {BFL_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  <button onClick={handleAiRewrite} disabled={isAiProcessing || !externalUrl || !selectedNftId}
                    className="md:col-span-1 bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl rounded-sm">
                    {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Sparkles size={14} /> Initiate Forge</>}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                {processingStep !== "idle" ? (
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-black">
                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" /> Forge: {processingStep}...
                  </div>
                ) : <div />}
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-gray-300">Banner costs 10 $HASH credits</span>
                  <Link href="/mascots" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black">
                    <Settings2 size={12} /> Registry
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12 space-y-8 relative z-10">
        <input type="text" placeholder="Story Title" value={title} onChange={e => setTitle(e.target.value)}
          className="w-full text-4xl md:text-6xl font-black border-none focus:outline-none placeholder:text-gray-100 uppercase tracking-tighter" />

        <div className="border-y border-gray-50 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-3 text-gray-300 focus-within:text-black">
              <ImageIcon size={20} />
              <input type="text" placeholder="Banner URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                className="w-full text-[10px] font-black uppercase tracking-widest border-none focus:outline-none bg-transparent" />
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16} /> Upload</>}
            </button>
            <button onClick={handleRegenerateBanner} disabled={isAiProcessing || !title || !selectedNftId}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700">
              <Sparkles size={14} /> Regenerate
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
          </div>
          {imageUrl && (
            <div className="aspect-video bg-gray-50 overflow-hidden border border-gray-100 rounded-sm relative group">
              <img src={imageUrl} alt="Banner" className="w-full h-full object-cover" />
              <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black"><X size={14} /></button>
            </div>
          )}
        </div>

        <div key={contentKey} ref={editorRef} contentEditable data-placeholder="Start your story here..."
          className="w-full min-h-[500px] text-xl outline-none prose prose-stone max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-200 empty:before:pointer-events-none leading-[1.8] typography-body" />
      </div>

      <div className="fixed bottom-8 right-8 z-[100] space-y-3 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`flex items-center gap-3 px-6 py-4 rounded-sm shadow-2xl border-l-4 animate-in slide-in-from-right-full duration-300 pointer-events-auto ${n.type === "success" ? "bg-black text-white border-green-500" : n.type === "error" ? "bg-red-600 text-white border-red-800" : "bg-gray-900 text-white border-blue-500"}`}>
            <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-widest opacity-50">Protocol</span><span className="text-sm font-bold">{n.message}</span></div>
          </div>
        ))}
      </div>
    </main>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Image as ImageIcon, Send, X, AlertCircle,
  Loader2, Upload, Sparkles, BarChart3
} from "lucide-react";
import Link from "next/link";
import { client, MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI } from "@/lib/web3";
import { getAuthMessage } from "@/lib/auth";
import { ATMOSPHERE_PRESETS } from "@/lib/moods";
import imageCompression from "browser-image-compression";
import ForgeOverlay from "@/components/ForgeOverlay";
import BannerImage from "@/components/BannerImage";
import {
  MascotRequiredPanel, MascotSelector, MoodSelect, AtmosphereSelect,
  ForgeStatusFooter, EditorToolbar, type OwnedMascot,
} from "@/components/ForgeControls";
import { requestBannerJob } from "@/lib/banner-client";
import type { Profile } from "@/types";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.7, maxWidthOrHeight: 1920, useWebWorker: true,
  fileType: "image/webp", initialQuality: 0.9,
};

interface Notification {
  id: string; message: string; type: "success" | "error" | "info";
}

interface TokenResult {
  address: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange24h: number;
}

function WritePageInner() {
  const account = useActiveAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authRef = useRef<{ sig: string; msg: string } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerModel, setBannerModel] = useState("");
  const [bannerDescription, setBannerDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [mood, setMood] = useState("sarcastic");
  const [atmosphere, setAtmosphere] = useState(ATMOSPHERE_PRESETS[0]);
  const [isCustomAtmosphere, setIsCustomAtmosphere] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "publishing" | "success" | "error">("idle");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeMode, setActiveMode] = useState<"ai" | "token">("ai");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [ownedMascots, setOwnedMascots] = useState<OwnedMascot[]>([]);
  const [selectedNftId, setSelectedNftId] = useState<string | null>(null);
  const [isFetchingMascots, setIsFetchingMascots] = useState(false);
  const [isAiDropdownOpen, setIsAiDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [processingStep, setProcessingStep] = useState<"idle" | "scraping" | "rewriting" | "banner" | "done">("idle");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenResults, setTokenResults] = useState<TokenResult[]>([]);

  const isContractAddress = (value: string): boolean => {
    const trimmed = value.trim();
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  };

  const handleMagicInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isContractAddress(value)) {
      setTokenAddress(value.trim());
      setActiveMode("token");
      addNotification("Contract detected — switched to Token Intel", "info");
      return;
    }
    setExternalUrl(value);
  };

  const handleTokenAddressInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isContractAddress(value)) {
      setTokenAddress(value.trim());
      addNotification("Contract detected", "info");
      return;
    }
    setTokenAddress(value);
  };

  const addNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  // Sign ONCE per session with "publish article" and reuse it across forge + publish.
  const ensureAuth = useCallback(async () => {
    if (!account) throw new Error("Connect wallet");
    const msg = getAuthMessage("publish article", account.address.toLowerCase());
    if (authRef.current?.msg === msg) return authRef.current;
    const sig = await account.signMessage({ message: msg });
    const auth = { sig, msg };
    authRef.current = auth;
    return auth;
  }, [account]);

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
        const { data: dnas } = await supabase.from("mascots_dna").select("id, name, image_url, personality").in("id", activeIds).eq("contract_address", MASCOTS_CONTRACT_ADDRESS.toLowerCase());
        const dnaMap = new Map(dnas?.map(d => [d.id, d]) || []);

        const finalMascots: OwnedMascot[] = activeIds.map(id => {
          const dna = dnaMap.get(id);
          return {
            id: String(id),
            name: dna?.name || `Protocol #${id}`,
            image: dna?.image_url || "/logo-pager.png",
            hasDna: !!(dna?.personality),
          };
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
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setExternalUrl(urlParam);
      setActiveMode("ai");
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) setIsAiDropdownOpen(false);
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(e.target as Node)) setIsTokenDropdownOpen(false);
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
      const { sig: authSig, msg: authMsg } = await ensureAuth();

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
          nftTokenId: selectedNftId, atmosphere,
          userAddress: account.address.toLowerCase(), signature: authSig, message: authMsg,
        }),
      });
      const textData = await textRes.json();
      if (!textRes.ok) throw new Error(textData.error || "AI text failed");

      setTitle(textData.title);
      if (textData.content && editorRef.current) {
        editorRef.current.innerHTML = textData.content;
      }
      if (textData.banner_description) setBannerDescription(textData.banner_description);

      setProcessingStep("banner");

      if ((profile?.ai_credits || 0) < 10) {
        throw new Error("Not enough $HASH credits for banner. Top up in Profile settings.");
      }

      const articleContent = editorRef.current?.innerHTML || textData.content || "";
      // Paid, non-idempotent endpoint — must NOT auto-retry (would double-charge credits).
      const bannerData = await requestBannerJob({
        title: textData.title, bannerDescription: textData.banner_description, mood,
        nftTokenId: selectedNftId, atmosphere,
        userAddress: account.address.toLowerCase(), signature: authSig, message: authMsg,
        content: articleContent,
      });
      if (bannerData.image_url) { setImageUrl(bannerData.image_url); setBannerModel(bannerData.image_model || ""); }

      addNotification("Article ready!", "success");
      setProcessingStep("done");
      setTimeout(() => { setProcessingStep("idle"); setActiveMode("ai"); }, 1500);
      fetchProfile();
    } catch (err: any) {
      addNotification(err.message, "error");
      setProcessingStep("idle");
      fetchProfile();
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleRegenerateBanner = async () => {
    if (!selectedNftId || !title || !account) return;
    if ((profile?.ai_credits || 0) < 10) { addNotification("Not enough $HASH credits for banner. Top up in Profile settings.", "error"); return; }
    try {
      addNotification("Regenerating banner...", "info");
      const { sig: authSig, msg: authMsg } = await ensureAuth();

      const articleContent = editorRef.current?.innerHTML || "";
      // Paid, non-idempotent endpoint — must NOT auto-retry (would double-charge credits).
      const data = await requestBannerJob({
        title, bannerDescription, mood, nftTokenId: selectedNftId,
        atmosphere,
        userAddress: account.address.toLowerCase(), signature: authSig, message: authMsg,
        content: articleContent,
      });
      if (data.image_url) { setImageUrl(data.image_url); setBannerModel(data.image_model || ""); addNotification("Banner updated!"); fetchProfile(); }
    } catch (err: any) { addNotification(err.message, "error"); }
  };

  const handleTokenAnalysis = async (selectedTokenAddress: string) => {
    if (!selectedTokenAddress) { addNotification("Enter a token address first!", "error"); return; }
    if (!selectedNftId) { addNotification("Select an NFT Mascot first!", "error"); return; }
    if (!account) { addNotification("Connect wallet", "error"); return; }

    setIsAiProcessing(true);
    setProcessingStep("rewriting");
    setTokenResults([]);

    try {
      const { sig: authSig, msg: authMsg } = await ensureAuth();

      const res = await fetch("/api/ai/token-commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: selectedTokenAddress,
          mood,
          nftTokenId: selectedNftId,
          atmosphere,
          userAddress: account.address.toLowerCase(),
          signature: authSig,
          message: authMsg,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Token analysis failed");

      setTitle(data.title);
      if (data.content && editorRef.current) {
        editorRef.current.innerHTML = data.content;
      }
      if (data.banner_description) setBannerDescription(data.banner_description);

      setProcessingStep("banner");

      if ((profile?.ai_credits || 0) < 10) {
        addNotification("Analysis ready, but not enough $HASH for banner. Top up in Profile.", "info");
      } else {
        const articleContent = editorRef.current?.innerHTML || "";
        // Paid, non-idempotent endpoint — must NOT auto-retry (would double-charge credits).
        try {
          const bannerData = await requestBannerJob({
            title: data.title, bannerDescription: data.banner_description, mood,
            nftTokenId: selectedNftId, atmosphere,
            userAddress: account.address.toLowerCase(), signature: authSig, message: authMsg,
            content: articleContent,
          });
          if (bannerData.image_url) { setImageUrl(bannerData.image_url); setBannerModel(bannerData.image_model || ""); }
        } catch (bannerErr: any) {
          addNotification(bannerErr.message, "error");
        }
      }

      addNotification("Token analysis ready!", "success");
      setProcessingStep("done");
      setTimeout(() => { setProcessingStep("idle"); setActiveMode("ai"); }, 1500);
      fetchProfile();
    } catch (err: any) {
      addNotification(err.message, "error");
      setProcessingStep("idle");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSearchToken = async () => {
    if (!tokenAddress.trim()) return;
    try {
      const res = await fetch(`/api/token?q=${encodeURIComponent(tokenAddress.trim())}`);
      const data = await res.json();
      setTokenResults(data.tokens || []);
    } catch {
      addNotification("Token search failed", "error");
    }
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
      setBannerModel("");
    } catch (err: any) { addNotification(err.message || "Upload failed", "error"); } finally { setIsUploading(false); }
  };

  const handlePublish = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!account) { addNotification("Connect wallet", "error"); return; }
    if (!title || !content || content === "<br>") { addNotification("Title and Content required", "error"); return; }

    setStatus("publishing");
    try {
      const { sig: authSig, msg: authMsg } = await ensureAuth();

      const res = await fetch("/api/article/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, image_url: imageUrl || null, source_url: externalUrl || null, author_address: account.address.toLowerCase(), signature: authSig, message: authMsg }),
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
            const distRes = await fetch("/api/distribution/batch", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId, targets: channels, profileAddress: account.address, signature: authSig, message: authMsg }),
            });
            const distData = await distRes.json();
            if (distData.results) {
              const ok = distData.results.filter((r: any) => r.success).length;
              const fail = distData.results.filter((r: any) => !r.success).length;
              const failDetails = distData.results.filter((r: any) => !r.success).map((r: any) => `${r.channel}: ${r.error || 'failed'}`).join(" | ");
              if (fail > 0) addNotification(failDetails || `${ok}/${ok + fail} channels published`, "error");
              else addNotification(`${ok}/${ok + fail} channels published`, "success");
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
      <ForgeOverlay step={processingStep} mascotImage={selectedMascot?.image} mascotName={selectedMascot?.name} />
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
          <button onClick={() => setActiveMode("ai")}
            className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${activeMode === "ai" ? "bg-white text-black shadow-sm" : "text-gray-400"}`}>
            <Sparkles size={14} /> Magic
          </button>
          <button onClick={() => setActiveMode("token")}
            className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${activeMode === "token" ? "bg-white text-black shadow-sm" : "text-gray-400"}`}>
            <BarChart3 size={14} /> Token Intel
          </button>
        </div>
      </div>

      <div className={`transition-all duration-500 bg-gray-50 border-y border-gray-100 mt-8 relative z-40 ${activeMode === "ai" ? "min-h-[160px] opacity-100 py-10 overflow-visible" : "max-h-0 opacity-0 invisible overflow-hidden"}`}>
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          {ownedMascots.length === 0 && !isFetchingMascots ? (
            <MascotRequiredPanel message="Magic Forge requires a Mascot Protocol in your wallet." />
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <input type="text" placeholder="Paste source link or token contract (0x...)" value={externalUrl} onChange={handleMagicInputChange}
                    className="md:col-span-3 px-4 py-3 text-sm border border-gray-200 focus:border-black outline-none bg-white transition-colors font-medium rounded-sm" />

                  <div className="md:col-span-2">
                    <MascotSelector
                      mascots={ownedMascots} value={selectedNftId} onChange={setSelectedNftId}
                      dropdownRef={aiDropdownRef} isOpen={isAiDropdownOpen} onToggle={setIsAiDropdownOpen}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <MoodSelect value={mood} onChange={setMood} />
                  </div>

                  <div className="md:col-span-2">
                    <AtmosphereSelect
                      value={atmosphere} onChange={setAtmosphere}
                      isCustom={isCustomAtmosphere} onCustomChange={setIsCustomAtmosphere}
                    />
                  </div>

                  <button onClick={handleAiRewrite} disabled={isAiProcessing || !externalUrl || !selectedNftId}
                    className="md:col-span-3 bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl rounded-sm">
                    {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <><Sparkles size={14} /> Initiate Forge</>}
                  </button>
                </div>
              </div>
              <ForgeStatusFooter
                step={processingStep}
                hasDna={!!selectedMascot?.hasDna}
                noDnaMessage="No DNA in database — article generation may fail. Use a mascot with DNA."
              />
            </>
          )}
        </div>
      </div>

      {/* Token Intel Panel */}
      <div className={`transition-all duration-500 bg-gray-50 border-y border-gray-100 relative z-40 ${activeMode === "token" ? "min-h-[160px] opacity-100 py-10 overflow-visible" : "max-h-0 opacity-0 invisible overflow-hidden"}`}>
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          {ownedMascots.length === 0 && !isFetchingMascots ? (
            <MascotRequiredPanel message="Token Intel requires a Mascot Protocol in your wallet." />
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4 flex items-center gap-2">
                    <BarChart3 size={16} className="text-gray-400 shrink-0" />
                    <input type="text" placeholder="Token name or contract address (0x...)" value={tokenAddress} onChange={handleTokenAddressInput}
                      onKeyDown={e => e.key === "Enter" && handleSearchToken()}
                      className="w-full px-4 py-3 text-sm border border-gray-200 focus:border-black outline-none bg-white transition-colors font-medium rounded-sm" />
                  </div>

                  <div className="md:col-span-2">
                    <MascotSelector
                      mascots={ownedMascots} value={selectedNftId} onChange={setSelectedNftId}
                      dropdownRef={tokenDropdownRef} isOpen={isTokenDropdownOpen} onToggle={setIsTokenDropdownOpen}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <MoodSelect value={mood} onChange={setMood} />
                  </div>

                  <div className="md:col-span-2">
                    <AtmosphereSelect
                      value={atmosphere} onChange={setAtmosphere}
                      isCustom={isCustomAtmosphere} onCustomChange={setIsCustomAtmosphere}
                    />
                  </div>

                  <button onClick={() => handleTokenAnalysis(tokenAddress)} disabled={isAiProcessing || !tokenAddress || !selectedNftId}
                    className="md:col-span-2 bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl rounded-sm">
                    {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <><BarChart3 size={14} /> Analyze</>}
                  </button>
                </div>
              </div>

              {/* Token search results */}
              {tokenResults.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-sm p-4 space-y-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Search Results</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tokenResults.map((t: TokenResult) => (
                      <button key={t.address} onClick={() => { setTokenAddress(t.address); setTokenResults([]); handleTokenAnalysis(t.address); }}
                        className="flex items-center gap-3 p-3 border border-gray-100 rounded-sm hover:border-black transition-all text-left">
                        {t.imageUrl && <img src={t.imageUrl} className="w-8 h-8 rounded-full object-cover" alt="" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-black uppercase truncate">{t.symbol} <span className="text-gray-400 font-normal">{t.name}</span></div>
                          <div className="flex items-center gap-3 text-[8px] font-bold text-gray-400">
                            <span>${t.priceUsd < 0.01 ? t.priceUsd.toExponential(2) : t.priceUsd.toFixed(6)}</span>
                            <span className={t.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}>{t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ForgeStatusFooter
                step={processingStep}
                hasDna={!!selectedMascot?.hasDna}
                noDnaMessage="No DNA — analysis may fail. Use a mascot with DNA."
              />
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
              <input type="text" placeholder="Banner URL" value={imageUrl} onChange={e => { setImageUrl(e.target.value); setBannerModel(""); }}
                className="w-full text-[10px] font-black uppercase tracking-widest border-none focus:outline-none bg-transparent" />
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16} /> Upload</>}
            </button>
            <button onClick={handleRegenerateBanner} disabled={isAiProcessing || !title || !selectedNftId || !selectedMascot?.hasDna}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed">
              <Sparkles size={14} /> Regenerate
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
          </div>
          {imageUrl && (
            <div className="aspect-video bg-gray-50 overflow-hidden border border-gray-100 rounded-sm relative group">
              <BannerImage src={imageUrl} alt="Banner" className="w-full h-full object-cover" />
              {bannerModel && (
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                  {bannerModel}
                </span>
              )}
              <button onClick={() => { setImageUrl(""); setBannerModel(""); }} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black"><X size={14} /></button>
            </div>
          )}
        </div>

        <EditorToolbar editorRef={editorRef} />

        <div ref={editorRef} contentEditable data-placeholder="Start your story here..."
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

export default function WritePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    }>
      <WritePageInner />
    </Suspense>
  );
}

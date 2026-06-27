"use client";

import {
  Globe, Settings2, Save, X, Loader2, Camera, Plus,
  Sparkles, Database, Edit3, CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, toWei, readContract } from "thirdweb";
import { supabase } from "@/lib/supabase";
import { MASCOTS_CONTRACT_ADDRESS, MASCOTS_ABI, client, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { base } from "thirdweb/chains";
import { getAuthMessage } from "@/lib/auth";
import ProfileIdentity from "@/components/ProfileIdentity";
import ProfileDistribution from "@/components/ProfileDistribution";
import ProfileForge from "@/components/ProfileForge";

const PRESET_ATMOSPHERES = ["Surrealism", "Pixel Art", "Brick Style", "Anime Style", "Graffiti"];

export default function ProfileHeader({
  profile, totalArticles, totalRewards,
}: {
  profile: any; totalArticles: number; totalRewards: number;
}) {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomAtmosphere, setIsCustomAtmosphere] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const isOwner = account?.address?.toLowerCase() === profile.address?.toLowerCase();

  const [formData, setFormData] = useState({
    name: "", bio: "", website: "", avatar_url: "",
    ai_atmosphere: PRESET_ATMOSPHERES[0],
    binance_accounts: [], telegram_channels: [], telegram_chat_id: "",
    cta_telegram: "", cta_forum: "",
    ref_links: [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
  });

  const [displayData, setDisplayData] = useState<{ name: string; bio: string; website?: string }>({ name: "Anonymous Author", bio: "" });

  const [forgeData, setForgeData] = useState({
    name: "", personality: "", visual_desc: "", image_url: "", price: "101",
  });
  const [forgeStep, setForgeStep] = useState<"dna" | "mint">("dna");
  const [isForging, setIsForging] = useState(false);
  const [isAnalyzingDna, setIsAnalyzingDna] = useState(false);
  const [forgeErrors, setForgeErrors] = useState<string[]>([]);
  const [pendingTokenId, setPendingTokenId] = useState<number | null>(null);

  useEffect(() => {
    const data = {
      name: profile.name || "", bio: profile.bio || "", website: profile.website || "",
      avatar_url: profile.avatar_url || "",
      ai_atmosphere: profile.ai_atmosphere || PRESET_ATMOSPHERES[0],
      binance_accounts: profile.binance_accounts || [],
      telegram_channels: profile.telegram_channels || [],
      telegram_chat_id: profile.telegram_chat_id || "",
      cta_telegram: profile.cta_telegram || "",
      cta_forum: profile.cta_forum || "",
      ref_links: profile.ref_links || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
    };
    setFormData(data);
    setDisplayData({ name: profile.name || "Anonymous Author", bio: profile.bio || "Web3 enthusiast." });
    setIsCustomAtmosphere(!PRESET_ATMOSPHERES.includes(data.ai_atmosphere));
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setFormData({ ...formData, avatar_url: data.url });
      notify("Avatar uploaded");
    } catch (e: any) {
      notify(e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeposit = async () => {
    if (!account) return;
    const amount = prompt("Enter $HASH amount (1 $HASH = 1 Credit):", "50");
    if (!amount || isNaN(+amount) || +amount <= 0) return;

    setIsDepositing(true);
    try {
      notify(`Transferring ${amount} $HASH...`);
      const contract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const tx = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 value)",
        params: ["0x39adfb3eb6ff7f56bd5c09c62b4ab1d61997193a", BigInt(toWei(amount))],
      });

      sendTransaction(tx, {
        onSuccess: async (result) => {
          const msg = getAuthMessage(`deposit ${amount} credits`, account.address.toLowerCase());
          const sig = await account.signMessage({ message: msg });
          await fetch("/api/profile/deposit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: account.address, amount, txHash: result.transactionHash, signature: sig, message: msg }),
          });
          notify(`Deposited ${amount} credits`);
          router.refresh();
          setIsDepositing(false);
        },
        onError: (err) => { notify(err.message, "error"); setIsDepositing(false); },
      });
    } catch (e: any) { notify(e.message, "error"); setIsDepositing(false); }
  };

  const handleSave = async () => {
    if (!account) return;
    setIsSaving(true);
    try {
      const msg = getAuthMessage("update Pager profile", account.address.toLowerCase());
      const sig = await account.signMessage({ message: msg });
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: profile.address.toLowerCase(), ...formData, signature: sig, message: msg }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      notify("Profile updated");
      setIsEditing(false);
      router.refresh();
    } catch (e: any) { notify(e.message, "error"); } finally { setIsSaving(false); }
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

      setForgeData({ ...forgeData, image_url: data.url });

      setIsAnalyzingDna(true);
      try {
        const scan = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: data.url, userAddress: account.address }),
        });
        const scanData = await scan.json();
        if (!scan.ok) {
          console.warn("⚠️ [DNA Scan] API error:", scanData.error);
          notify("AI DNA scan unavailable — fill fields manually", "error");
        } else if (scanData.personality || scanData.visual) {
          setForgeData(prev => ({
            ...prev, image_url: data.url,
            personality: scanData.personality || prev.personality,
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

  const handleSealGenes = async () => {
    if (!account) { notify("Connect wallet", "error"); return; }
    const errors: string[] = [];
    if (!forgeData.image_url) errors.push("image");
    if (!forgeData.name) errors.push("name");
    if (!forgeData.personality) errors.push("personality");
    if (errors.length) { setForgeErrors(errors); notify("Fill required fields", "error"); return; }
    setForgeErrors([]);
    setIsForging(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const tokenId = Number(await readContract({ contract, method: "function nextTokenId() view returns (uint256)", params: [] }));

      const { error: dbError } = await supabase.from("mascots_dna").upsert([{
        id: tokenId, name: forgeData.name, personality: forgeData.personality,
        voice: forgeData.personality, physical_desc: forgeData.visual_desc,
        image_url: forgeData.image_url, creator_address: account.address.toLowerCase(),
        price: forgeData.price, max_supply: 10000, contract_address: MASCOTS_CONTRACT_ADDRESS.toLowerCase(),
      }], { onConflict: "id" });

      if (dbError) throw dbError;
      setPendingTokenId(tokenId);
      setForgeStep("mint");
      notify("Genome sealed. Now ignite the key.");
    } catch (e: any) { notify(e.message, "error"); } finally { setIsForging(false); }
  };

  const handleIgniteKey = async () => {
    if (!account || pendingTokenId === null) return;
    setIsForging(true);
    try {
      const contract = getContract({ client, chain: base, address: MASCOTS_CONTRACT_ADDRESS, abi: MASCOTS_ABI as any });
      const hashContract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
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
          setForgeStep("dna");
          setForgeData({ name: "", personality: "", visual_desc: "", image_url: "", price: "101" });
          router.refresh();
          setIsForging(false);
        },
        onError: (err) => { notify(err.message, "error"); setIsForging(false); },
      });
    } catch (e: any) { notify(e.message, "error"); setIsForging(false); }
  };

  const getDomain = (u: string) => {
    try { return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace("www.", ""); } catch { return u; }
  };

  return (
    <header className="mb-20 space-y-12">
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-sm shadow-2xl border-l-4 animate-in slide-in-from-top-4 duration-300 flex items-center gap-4 ${notification.type === "success" ? "bg-black text-white border-green-500" : "bg-red-600 text-white border-red-800"}`}>
          {notification.type === "success" ? <CheckCircle2 size={20} /> : <X size={20} />}
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Protocol</span>
            <span className="text-sm font-bold">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="space-y-6 flex-1">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white border border-[var(--border-soft)] rounded-full flex items-center justify-center font-black text-3xl text-black shadow-sm overflow-hidden relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {formData.avatar_url ? <img src={formData.avatar_url} className="w-full h-full object-cover" alt="" /> : displayData.name.charAt(0).toUpperCase()}
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
                <span><span className="text-black">{totalArticles}</span> Stories</span>
                <div className="w-1 h-1 bg-gray-200 rounded-full" />
                <span><span className="text-black">{Math.floor(totalRewards)}</span> $HASH Earned</span>
                {displayData.website && (
                  <>
                    <div className="w-1 h-1 bg-gray-200 rounded-full" />
                    <a href={displayData.website.startsWith("http") ? displayData.website : `https://${displayData.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-500 hover:text-blue-600 font-black">
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
              <button onClick={handleSave} disabled={isSaving} className="bg-black text-white px-6 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50 shadow-lg">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Save Changes</>}
              </button>
              <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-black"><X size={24} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7 space-y-10">
              <ProfileIdentity
                formData={formData}
                displayData={displayData}
                isUploading={isUploading}
                onFormChange={setFormData}
                onAvatarUpload={handleAvatarUpload}
                fileInputRef={fileInputRef}
              />
              <ProfileDistribution formData={formData} onFormChange={setFormData} />
            </div>

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
                    <button onClick={handleDeposit} disabled={isDepositing} className="p-1.5 bg-black text-white rounded-full hover:bg-gray-800 transition-all disabled:opacity-50" title="Top Up">
                      {isDepositing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase text-gray-400 ml-1">Narrative Atmosphere</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_ATMOSPHERES.map(style => (
                      <div
                        key={style}
                        onClick={() => { setFormData({ ...formData, ai_atmosphere: style }); setIsCustomAtmosphere(false); }}
                        className={`text-[8px] font-black uppercase px-3 py-2 border cursor-pointer transition-all ${!isCustomAtmosphere && formData.ai_atmosphere === style ? "bg-black text-white border-black shadow-md" : "bg-white text-gray-400 border-gray-200 hover:border-black"}`}
                      >
                        {style}
                      </div>
                    ))}
                    <div
                      onClick={() => setIsCustomAtmosphere(true)}
                      className={`text-[8px] font-black uppercase px-3 py-2 border cursor-pointer transition-all ${isCustomAtmosphere ? "bg-black text-white border-black shadow-md" : "bg-white text-gray-400 border-gray-200 hover:border-black"} flex items-center gap-1.5`}
                    >
                      <Edit3 size={10} /> Custom
                    </div>
                  </div>
                  {isCustomAtmosphere && (
                    <input
                      type="text"
                      value={formData.ai_atmosphere}
                      onChange={e => setFormData({ ...formData, ai_atmosphere: e.target.value })}
                      placeholder="e.g. Star Wars, Noir..."
                      className="w-full text-xs p-3 border border-black outline-none bg-white"
                    />
                  )}
                </div>
              </div>

              <ProfileForge
                forgeData={forgeData}
                forgeStep={forgeStep}
                isForging={isForging}
                isAnalyzingDna={isAnalyzingDna}
                forgeErrors={forgeErrors}
                onMascotImageUpload={handleMascotImageUpload}
                onForgeDataChange={setForgeData}
                onSealGenes={handleSealGenes}
                onIgniteKey={handleIgniteKey}
                onBackToDna={() => setForgeStep("dna")}
              />

              <button onClick={handleSave} disabled={isSaving} className="w-full bg-black text-white py-5 text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl flex items-center justify-center gap-3 hover:bg-gray-900 transition-all sticky bottom-8 z-10">
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Seal All Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

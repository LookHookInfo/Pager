"use client";

import {
  Globe, Settings2, Save, X, Loader2, Camera, Plus,
  Sparkles, Database, CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { client, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import { base } from "thirdweb/chains";
import { getAuthMessage } from "@/lib/auth";
import ProfileIdentity from "@/components/ProfileIdentity";
import ProfileDistribution from "@/components/ProfileDistribution";

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
  const [isDepositing, setIsDepositing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const isOwner = account?.address?.toLowerCase() === profile.address?.toLowerCase();

  const [formData, setFormData] = useState({
    name: "", bio: "", website: "", avatar_url: "", cmc_username: "",
    ai_api_key: "",
    binance_accounts: [], telegram_channels: [], telegram_chat_id: "",
    cta_links: [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
    ref_links: [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
  });

  const [displayData, setDisplayData] = useState<{ name: string; bio: string; website?: string }>({ name: "Anonymous Author", bio: "" });

  useEffect(() => {
    const data = {
      name: profile.name || "", bio: profile.bio || "", website: profile.website || "",
      avatar_url: profile.avatar_url || "",
      cmc_username: profile.cmc_username || "",
      ai_api_key: profile.ai_api_key || "",
      binance_accounts: profile.binance_accounts || [],
      telegram_channels: profile.telegram_channels || [],
      telegram_chat_id: profile.telegram_chat_id || "",
      cta_links: profile.cta_links || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
      ref_links: profile.ref_links || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
    };
    setFormData(data);
    setDisplayData({ name: profile.name || "Anonymous Author", bio: profile.bio || "Web3 enthusiast.", website: profile.website });
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
      if (!res.ok) {
        let errMsg = "Save failed";
        try { const errBody = await res.json(); errMsg = errBody.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      notify("Profile updated");
      setIsEditing(false);
      router.refresh();
    } catch (e: any) { notify(e.message, "error"); } finally { setIsSaving(false); }
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
            <div
              className={`w-24 h-24 bg-white border border-[var(--border-soft)] rounded-full flex items-center justify-center font-black text-3xl text-black shadow-sm overflow-hidden relative group${isOwner ? " cursor-pointer" : ""}`}
              onClick={isOwner ? () => fileInputRef.current?.click() : undefined}
            >
              {formData.avatar_url ? <img src={formData.avatar_url} className="w-full h-full object-cover" alt="" /> : displayData.name.charAt(0).toUpperCase()}
              {isOwner && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? <Loader2 size={24} className="text-white animate-spin" /> : <Camera size={24} className="text-white" />}
                </div>
              )}
              {isOwner && <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />}
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">{displayData.name}</h1>
                {isOwner && <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-gray-400 hover:text-black transition-colors"><Settings2 size={20} /></button>}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span><span className="text-black">{totalArticles}</span> Stories</span>
                <div className="w-1 h-1 bg-gray-200 rounded-full" />
                <span>
                  <span className={`${(profile.ai_credits || 0) < 50 ? "text-red-500" : "text-black"}`}>{profile.ai_credits || 0}</span>
                  <span className={`${(profile.ai_credits || 0) < 50 ? "text-red-400" : ""}`}> Credits</span>
                  {(profile.ai_credits || 0) < 50 && <span className="text-[8px] text-red-400 ml-1">LOW</span>}
                </span>
                {displayData.website && (
                  <>
                    <div className="w-1 h-1 bg-gray-200 rounded-full" />
                    <a href={displayData.website.startsWith("http") ? displayData.website : `https://${displayData.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-500 hover:text-blue-600 font-black">
                      <Globe size={12} /> {getDomain(displayData.website)}
                    </a>
                  </>
                )}
                {profile.twitter && (
                  <>
                    <div className="w-1 h-1 bg-gray-200 rounded-full" />
                    <a href={profile.twitter.startsWith("http") ? profile.twitter : `https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-500 hover:text-blue-600 font-black">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> {profile.twitter.replace(/^https?:\/\/(x\.com|twitter\.com)\//, '@')}
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
                    <div className={`px-3 py-1 bg-white border rounded-full flex items-center gap-2 shadow-sm ${(profile.ai_credits || 0) < 50 ? "border-red-200" : "border-gray-200"}`}>
                      <Database size={12} className={`${(profile.ai_credits || 0) < 50 ? "text-red-500" : "text-blue-500"}`} />
                      <span className={`text-[10px] font-black ${(profile.ai_credits || 0) < 50 ? "text-red-500" : ""}`}>{profile.ai_credits || 0} Credits</span>
                    </div>
                    <button onClick={handleDeposit} disabled={isDepositing} className="p-1.5 bg-black text-white rounded-full hover:bg-gray-800 transition-all disabled:opacity-50" title="Top Up">
                      {isDepositing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Mascot creation is on the <a href="/mascots" className="underline hover:text-black">Mascots page</a>.</p>
              </div>

              <div className="p-6 border border-gray-100 rounded-sm space-y-4 bg-gray-50/30 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-500" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">AI Access Key (optional)</h4>
                </div>
                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                  If provided, AI requests are routed through your own OpenRouter key, bypassing platform limits. Leave empty to use the platform key.
                </p>
                <input
                  type="password"
                  value={formData.ai_api_key || ""}
                  onChange={e => setFormData({ ...formData, ai_api_key: e.target.value })}
                  placeholder="sk-or-..."
                  autoComplete="off"
                  className="w-full text-xs font-mono p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

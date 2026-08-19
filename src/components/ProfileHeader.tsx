"use client";

import {
  Globe, Settings2, Save, X, Loader2, Camera,
  Sparkles, Database, CheckCircle2, Plus,
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
import type { Profile } from "@/types";

export default function ProfileHeader({
  profile, totalArticles,
}: {
  profile: Profile; totalArticles: number; totalRewards: number;
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
    setTimeout(() => setNotification(null), 4000);
  };

  const isOwner = account?.address?.toLowerCase() === profile.address?.toLowerCase();

  const [formData, setFormData] = useState<Profile>({
    address: "",
    name: "", bio: "", website: "", avatar_url: "", cmc_username: "",
    gemfun_token: "",
    binance_accounts: [], telegram_channels: [], telegram_chat_id: "",
    cta_links: [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
    ref_links: [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
  });

  const [displayData, setDisplayData] = useState<{ name: string; bio: string; website?: string }>({ name: "Anonymous Author", bio: "" });

  useEffect(() => {
    const data: Profile = {
      address: profile.address || "",
      name: profile.name || "", bio: profile.bio || "", website: profile.website || "",
      avatar_url: profile.avatar_url || "",
      cmc_username: profile.cmc_username || "",
      gemfun_token: profile.gemfun_token || "",
      binance_accounts: profile.binance_accounts || [],
      telegram_channels: profile.telegram_channels || [],
      telegram_chat_id: profile.telegram_chat_id || "",
      cta_links: profile.cta_links || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
      ref_links: profile.ref_links || [{ label: "", url: "" }, { label: "", url: "" }, { label: "", url: "" }],
    };
    setFormData(data);
    setDisplayData({ name: profile.name || "Anonymous Author", bio: profile.bio || "Web3 enthusiast.", website: profile.website || undefined });
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
        body: JSON.stringify({ ...formData, address: profile.address.toLowerCase(), signature: sig, message: msg }),
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
    <header className="mb-16 space-y-10">
      {notification && (
        <div className={`toast ${notification.type === "success" ? "toast--success" : "toast--error"}`}>
          {notification.type === "success" ? <CheckCircle2 size={16} /> : <X size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start gap-5 flex-1">
          <div className="relative">
            <div className="avatar avatar--lg bg-[var(--surface-dim)] border border-[var(--border)] shadow-sm">
              {formData.avatar_url ? (
                <img src={formData.avatar_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-[var(--text-faint)]">{displayData.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {isOwner && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center shadow-md hover:bg-[var(--accent-hover)] transition-colors"
              >
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              </button>
            )}
            {isOwner && <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight leading-none truncate">{displayData.name}</h1>
              {isOwner && (
                <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors rounded-lg hover:bg-[var(--surface-dim)]">
                  <Settings2 size={16} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-[var(--text-dim)]">
              <span>{totalArticles} Stories</span>
              <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
              <span className={(profile.ai_credits || 0) < 50 ? "text-[var(--red)]" : ""}>
                {profile.ai_credits || 0} Credits
              </span>
              {displayData.website && (
                <>
                  <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
                  <a
                    href={displayData.website.startsWith("http") ? displayData.website : `https://${displayData.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[var(--blue)] hover:underline"
                  >
                    <Globe size={12} /> {getDomain(displayData.website)}
                  </a>
                </>
              )}
              {profile.twitter && (
                <>
                  <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
                  <a
                    href={profile.twitter.startsWith("http") ? profile.twitter : `https://x.com/${profile.twitter}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[var(--blue)] hover:underline"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    {profile.twitter.replace(/^https?:\/\/(x\.com|twitter\.com)\//, "@")}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {displayData.bio && (
        <p className="text-[var(--text-dim)] typography-body max-w-2xl">{displayData.bio}</p>
      )}

      {isOwner && isEditing && (
        <div className="pt-8 border-t border-[var(--border)] animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="avatar avatar--sm bg-[var(--accent)] text-white">
                <Settings2 size={14} />
              </div>
              <h3 className="section-label">Settings</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={isSaving} className="btn btn--primary">
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <><Save size={12} /> Save</>}
              </button>
              <button onClick={() => setIsEditing(false)} className="btn btn--ghost btn--sm">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-8">
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

            <div className="lg:col-span-5 space-y-8">
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="section-label flex items-center gap-1.5">
                    <Sparkles size={12} /> Credits
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${(profile.ai_credits || 0) < 50 ? "badge--red" : "badge--blue"}`}>
                      <Database size={10} />
                      {profile.ai_credits || 0}
                    </span>
                    <button onClick={handleDeposit} disabled={isDepositing} className="btn btn--primary btn--sm !p-1.5 !rounded-lg" title="Top Up">
                      {isDepositing ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-dim)]">
                  Mascot creation is on the <a href="/mascots" className="underline hover:text-[var(--text)]">Mascots page</a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

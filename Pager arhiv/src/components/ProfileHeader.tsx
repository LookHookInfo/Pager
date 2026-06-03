"use client";

import { Globe, Settings2, Save, X, Loader2, Database, ShieldCheck, Camera, Eye, EyeOff, HelpCircle, ExternalLink, CheckCircle2, UserPlus, Palette } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { upload, resolveScheme } from "thirdweb/storage";
import { supabase } from "@/lib/supabase";

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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dnaRefInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDna, setIsUploadingDna] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  
  const isOwner = account?.address?.toLowerCase() === profile.address?.toLowerCase();

  const [formData, setFormData] = useState({
    name: profile.name || "",
    bio: profile.bio || "",
    website: profile.website || "",
    thirdweb_client_id: profile.thirdweb_client_id || "",
    avatar_url: profile.avatar_url || "",
    ai_api_key: profile.ai_api_key || "",
    ai_image_model: profile.ai_image_model || "google/gemini-3.1-flash-image-preview",
    ai_atmosphere: profile.ai_atmosphere || "Rick and Morty",
    ai_custom_dna_name: profile.ai_custom_dna_name || "",
    ai_custom_dna_description: profile.ai_custom_dna_description || "",
    ai_custom_dna_reference: profile.ai_custom_dna_reference || "",
    binance_accounts: profile.binance_accounts || [],
    telegram_channels: profile.telegram_channels || [],
    telegram_chat_id: profile.telegram_chat_id || "",
    cta_telegram: profile.cta_telegram || "",
    cta_forum: profile.cta_forum || "",
    ref_links: profile.ref_links || [
      { label: "", url: "" },
      { label: "", url: "" },
      { label: "", url: "" }
    ]
  });

  const [displayData, setDisplayData] = useState({
    name: profile.name || "Anonymous Author",
    bio: profile.bio || "Web3 enthusiast and curator.",
    website: profile.website || "",
    thirdweb_client_id: profile.thirdweb_client_id || "",
    avatar_url: profile.avatar_url || "",
    ai_api_key: profile.ai_api_key || "",
    ai_image_model: profile.ai_image_model || "google/gemini-3.1-flash-image-preview",
    ai_atmosphere: profile.ai_atmosphere || "Rick and Morty",
    ai_custom_dna_name: profile.ai_custom_dna_name || "",
    ai_custom_dna_description: profile.ai_custom_dna_description || "",
    ai_custom_dna_reference: profile.ai_custom_dna_reference || "",
    binance_accounts: profile.binance_accounts || [],
    telegram_channels: profile.telegram_channels || []
  });

  useEffect(() => {
    const data = {
      name: profile.name || "",
      bio: profile.bio || "",
      website: profile.website || "",
      thirdweb_client_id: profile.thirdweb_client_id || "",
      avatar_url: profile.avatar_url || "",
      ai_api_key: profile.ai_api_key || "",
      ai_image_model: profile.ai_image_model || "google/gemini-3.1-flash-image-preview",
      ai_atmosphere: profile.ai_atmosphere || "Rick and Morty",
      ai_custom_dna_name: profile.ai_custom_dna_name || "",
      ai_custom_dna_description: profile.ai_custom_dna_description || "",
      ai_custom_dna_reference: profile.ai_custom_dna_reference || "",
      binance_accounts: profile.binance_accounts || [],
      telegram_channels: profile.telegram_channels || [],
      telegram_chat_id: profile.telegram_chat_id || "",
      cta_telegram: profile.cta_telegram || "",
      cta_forum: profile.cta_forum || "",
      ref_links: profile.ref_links || [
        { label: "", url: "" },
        { label: "", url: "" },
        { label: "", url: "" }
      ]
    };
    setFormData(data);
    setDisplayData({
      ...data,
      name: profile.name || "Anonymous Author",
      bio: profile.bio || "Web3 enthusiast and curator."
    });
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formData.thirdweb_client_id) return;

    try {
      setIsUploading(true);
      const customClient = createThirdwebClient({ clientId: formData.thirdweb_client_id });
      const uri = await upload({ client: customClient, files: [file] });
      const url = resolveScheme({ client: customClient, uri });
      setFormData({ ...formData, avatar_url: url });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      alert("Failed to upload avatar to IPFS.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDnaRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formData.thirdweb_client_id) return;

    try {
      setIsUploadingDna(true);
      const customClient = createThirdwebClient({ clientId: formData.thirdweb_client_id });
      const uri = await upload({ client: customClient, files: [file] });
      const url = resolveScheme({ client: customClient, uri });
      setFormData({ ...formData, ai_custom_dna_reference: url });
    } catch (error: any) {
      console.error("DNA ref upload error:", error);
      alert("Failed to upload reference image to IPFS.");
    } finally {
      setIsUploadingDna(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: profile.address.toLowerCase(),
          ...formData
        }),
        cache: 'no-store'
      });
      
      const data = await res.json().catch(() => ({ error: "Network error" }));
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to save profile");
      }
      
      setIsEditing(false);
      await new Promise(r => setTimeout(r, 800));
      router.refresh();
      setIsSaving(false);
    } catch (e: any) {
      console.error("Save Error:", e.message);
      alert(`Error saving profile: ${e.message}`);
      setIsSaving(false);
    }
  };

  return (
    <header className="mb-20 space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="space-y-6 flex-1">
          <div className="flex items-center gap-6">
             <div className="relative group">
                <div className="w-24 h-24 bg-white border border-[var(--border-soft)] rounded-full flex items-center justify-center font-black text-3xl text-black shadow-sm overflow-hidden select-none relative">
                    {formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        displayData.name.charAt(0).toUpperCase()
                    )}
                    {isEditing && formData.thirdweb_client_id && (
                        <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            <span className="text-[8px] font-bold uppercase mt-1">IPFS</span>
                        </button>
                    )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
             </div>
             
             <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Your Name"
                      className="text-3xl font-bold tracking-tight border-b-2 border-black focus:outline-none w-full max-w-md bg-transparent"
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">{displayData.name}</h1>
                        {displayData.thirdweb_client_id && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-100" title="Decentralized Storage Verified">
                                <ShieldCheck size={14} />
                                <span className="text-[8px] font-black uppercase tracking-wider">Decentralized</span>
                            </div>
                        )}
                    </div>
                  )}
                  {isOwner && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all">
                      <Settings2 size={20} />
                    </button>
                  )}
                  {isSaving && <Loader2 size={18} className="animate-spin text-gray-400" />}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {displayData.website && !isEditing && (
                    <a href={displayData.website.startsWith('http') ? displayData.website : `https://${displayData.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors">
                      <Globe size={12} />
                      <span>{displayData.website.replace(/^https?:\/\//, '').split('/')[0]}</span>
                    </a>
                  )}
                  {isEditing && (
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <Globe size={12} />
                      <input type="text" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="Link" className="text-[10px] font-bold uppercase tracking-widest border-b border-blue-200 focus:outline-none bg-transparent w-24" />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5"><span className="text-black">{totalArticles}</span> Stories</div>
                  <div className="w-1 h-1 bg-gray-200 rounded-full" />
                  <div className="flex items-center gap-1.5"><span className="text-black">{Math.floor(totalRewards)}</span> $HASH Earned</div>
                </div>
             </div>

             {isEditing && (
                <div className="flex items-center gap-2">
                  <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-md disabled:opacity-50">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><X size={20} /></button>
                </div>
              )}
          </div>

          <div className="max-w-2xl space-y-6">
            {isEditing ? (
              <div className="space-y-6">
                <textarea 
                    value={formData.bio}
                    onChange={e => setFormData({...formData, bio: e.target.value.slice(0, 120)})}
                    placeholder="Short bio..."
                    className="w-full text-lg typography-body border border-[var(--border-soft)] p-4 focus:border-black outline-none min-h-[100px] resize-none bg-white rounded-sm"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-gray-50 border border-gray-100 rounded-sm space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black"><Database size={14} /> Thirdweb ID</div>
                        <div className="relative">
                            <input type={showClientId ? "text" : "password"} value={formData.thirdweb_client_id} onChange={e => setFormData({...formData, thirdweb_client_id: e.target.value})} placeholder="Client ID" className="w-full text-xs font-mono p-3 pr-10 border border-gray-200 focus:border-black outline-none bg-white" />
                            <button type="button" onClick={() => setShowClientId(!showClientId)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">{showClientId ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                        </div>
                    </div>

                    <div className="p-5 bg-gray-50 border border-gray-100 rounded-sm space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black"><Database size={14} /> OpenRouter Key</div>
                        <div className="relative">
                            <input type={showAiKey ? "text" : "password"} value={formData.ai_api_key} onChange={e => setFormData({...formData, ai_api_key: e.target.value})} placeholder="sk-or-v1-..." className="w-full text-xs font-mono p-3 pr-10 border border-gray-200 focus:border-black outline-none bg-white" />
                            <button type="button" onClick={() => setShowAiKey(!showAiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">{showAiKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-2 border-black rounded-sm space-y-8 bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black">
                            <ExternalLink size={14} /> Monetization & Social
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Personal CTA Block</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Your Telegram Channel</label>
                            <input 
                                type="text" 
                                value={formData.cta_telegram} 
                                onChange={e => setFormData({...formData, cta_telegram: e.target.value})} 
                                placeholder="https://t.me/yourchannel" 
                                className="w-full text-xs font-mono p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-gray-400">Your Forum Link</label>
                            <input 
                                type="text" 
                                value={formData.cta_forum} 
                                onChange={e => setFormData({...formData, cta_forum: e.target.value})} 
                                placeholder="https://t.me/yourforum" 
                                className="w-full text-xs font-mono p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-600">
                             Referral Network (Up to 3)
                        </div>
                        <div className="space-y-3">
                            {[0, 1, 2].map((idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        placeholder={`Ref Name (e.g. ByBit #${idx+1})`}
                                        value={formData.ref_links[idx]?.label || ""}
                                        onChange={e => {
                                            const newRefs = [...formData.ref_links];
                                            newRefs[idx] = { ...newRefs[idx], label: e.target.value };
                                            setFormData({...formData, ref_links: newRefs});
                                        }}
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Referral URL"
                                        value={formData.ref_links[idx]?.url || ""}
                                        onChange={e => {
                                            const newRefs = [...formData.ref_links];
                                            newRefs[idx] = { ...newRefs[idx], url: e.target.value };
                                            setFormData({...formData, ref_links: newRefs});
                                        }}
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white font-mono" 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- DISTRIBUTION PROTOCOL --- */}
                <div className="p-6 border-2 border-black rounded-sm space-y-8 bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black">
                            <Globe size={14} /> Distribution Protocol
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Auto-Posting Engine</span>
                    </div>

                    {/* Binance Square Accounts */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-orange-500">
                             Binance Square Accounts
                        </div>
                        <div className="space-y-3">
                            {formData.binance_accounts.map((acc: any, idx: number) => (
                                <div key={idx} className="flex flex-col p-3 bg-gray-50 border border-gray-100 rounded-sm group relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-[10px] font-black uppercase">{acc.label}</div>
                                        <button 
                                            onClick={() => {
                                                const newAccs = [...formData.binance_accounts];
                                                newAccs.splice(idx, 1);
                                                setFormData({...formData, binance_accounts: newAccs});
                                            }}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div className="text-[9px] font-mono text-gray-400 truncate mb-2">KEY: {acc.apiKey.slice(0, 8)}...</div>
                                    {(acc.language || acc.style) && (
                                        <div className="flex gap-2">
                                            {acc.language && <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold uppercase">{acc.language}</span>}
                                            {acc.style && <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold uppercase">{acc.style}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div className="space-y-2 border-t pt-4 border-gray-100">
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        id="bn-label"
                                        placeholder="Label (e.g. English Acc)" 
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                                    />
                                    <input 
                                        type="password" 
                                        id="bn-key"
                                        placeholder="Binance Square API Key" 
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white font-mono" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        id="bn-lang"
                                        placeholder="Language (e.g. English)" 
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                                    />
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            id="bn-style"
                                            placeholder="Style (e.g. Professional)" 
                                            className="flex-1 text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                                        />
                                        <button 
                                            onClick={() => {
                                                const labelInput = document.getElementById('bn-label') as HTMLInputElement;
                                                const keyInput = document.getElementById('bn-key') as HTMLInputElement;
                                                const langInput = document.getElementById('bn-lang') as HTMLInputElement;
                                                const styleInput = document.getElementById('bn-style') as HTMLInputElement;
                                                if (!labelInput.value || !keyInput.value) return;
                                                setFormData({
                                                    ...formData, 
                                                    binance_accounts: [...formData.binance_accounts, { 
                                                        label: labelInput.value, 
                                                        apiKey: keyInput.value,
                                                        language: langInput.value,
                                                        style: styleInput.value
                                                    }]
                                                });
                                                labelInput.value = '';
                                                keyInput.value = '';
                                                langInput.value = '';
                                                styleInput.value = '';
                                            }}
                                            className="bg-black text-white px-4 text-[10px] font-bold uppercase hover:bg-gray-800 transition-all"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-[1px] bg-gray-100" />

                    {/* Telegram Channels */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-500">
                             Telegram Channels
                        </div>
                        <div className="space-y-3">
                            {formData.telegram_channels?.map((ch: any, idx: number) => (
                                <div key={idx} className="flex flex-col p-3 bg-gray-50 border border-gray-100 rounded-sm group relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-[10px] font-black uppercase">{ch.label}</div>
                                        <button 
                                            onClick={() => {
                                                const newChs = [...(formData.telegram_channels || [])];
                                                newChs.splice(idx, 1);
                                                setFormData({...formData, telegram_channels: newChs});
                                            }}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div className="text-[9px] font-mono text-gray-400 mb-2">ID: {ch.chatId} {ch.topicId ? `| TOPIC: ${ch.topicId}` : ''}</div>
                                    {(ch.language || ch.style) && (
                                        <div className="flex gap-2">
                                            {ch.language && <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold uppercase">{ch.language}</span>}
                                            {ch.style && <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold uppercase">{ch.style}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-sm mb-2">
                                <p className="text-[9px] text-blue-700 leading-relaxed uppercase tracking-tighter font-bold">
                                    1. Add @lookhookbot as Admin to channel.<br/>
                                    2. Paste Chat ID (starts with -100).<br/>
                                    3. Topic ID is optional for Forum groups.
                                </p>
                            </div>

                            <div className="space-y-2 border-t pt-4 border-gray-100">
                                <div className="grid grid-cols-3 gap-2">
                                    <input 
                                        type="text" 
                                        id="tg-label"
                                        placeholder="Channel Name" 
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                                    />
                                    <input 
                                        type="text" 
                                        id="tg-id"
                                        placeholder="Chat ID (-100...)" 
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white font-mono" 
                                    />
                                    <input 
                                        type="text" 
                                        id="tg-topic"
                                        placeholder="Topic ID (Opt)" 
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white font-mono" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        id="tg-lang"
                                        placeholder="Language (e.g. Russian)" 
                                        className="text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                                    />
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            id="tg-style"
                                            placeholder="Style (e.g. Humorous)" 
                                            className="flex-1 text-xs p-3 border border-gray-100 focus:border-black outline-none bg-white" 
                                        />
                                        <button 
                                            onClick={() => {
                                                const labelInput = document.getElementById('tg-label') as HTMLInputElement;
                                                const idInput = document.getElementById('tg-id') as HTMLInputElement;
                                                const topicInput = document.getElementById('tg-topic') as HTMLInputElement;
                                                const langInput = document.getElementById('tg-lang') as HTMLInputElement;
                                                const styleInput = document.getElementById('tg-style') as HTMLInputElement;
                                                if (!labelInput.value || !idInput.value) return;
                                                setFormData({
                                                    ...formData, 
                                                    telegram_channels: [...(formData.telegram_channels || []), { 
                                                        label: labelInput.value, 
                                                        chatId: idInput.value, 
                                                        topicId: topicInput.value,
                                                        language: langInput.value,
                                                        style: styleInput.value
                                                    }]
                                                });
                                                labelInput.value = '';
                                                idInput.value = '';
                                                topicInput.value = '';
                                                langInput.value = '';
                                                styleInput.value = '';
                                            }}
                                            className="bg-black text-white px-4 text-[10px] font-bold uppercase hover:bg-gray-800 transition-all"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gray-50 border border-gray-100 rounded-sm space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black"><Palette size={14} /> Custom Atmosphere</div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                            { id: 'Rick and Morty', label: 'Rick & Morty' },
                            { id: 'Pirates of the Caribbean', label: 'Pirates' },
                            { id: 'Minions', label: 'Minions' }
                        ].map((style) => (
                            <button
                                key={style.id}
                                onClick={() => setFormData({...formData, ai_atmosphere: style.id})}
                                className={`py-2 px-3 text-[10px] font-bold uppercase tracking-tighter border transition-all ${
                                    formData.ai_atmosphere === style.id 
                                    ? 'bg-black text-white border-black' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'
                                }`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <input 
                            type="text" 
                            value={formData.ai_atmosphere} 
                            onChange={e => setFormData({...formData, ai_atmosphere: e.target.value})} 
                            placeholder="Or type custom style (e.g. Cyberpunk)" 
                            className="w-full text-xs font-mono p-3 border border-gray-200 focus:border-black outline-none bg-white" 
                        />
                        {formData.ai_atmosphere && !['Rick and Morty', 'Pirates of the Caribbean', 'Minions'].includes(formData.ai_atmosphere) && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">Custom</div>
                        )}
                    </div>
                    
                    <p className="text-[9px] text-gray-400 font-bold uppercase italic">Defines the background world style for your AI banners.</p>
                </div>

                {/* --- CUSTOM DNA SECTION --- */}
                <div className="p-6 border-2 border-dashed border-gray-200 rounded-sm space-y-6">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600">
                        <UserPlus size={14} /> Private DNA Protocol (Custom Mascot)
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-gray-400">Mascot Name</label>
                                <input 
                                    type="text" 
                                    value={formData.ai_custom_dna_name} 
                                    onChange={e => setFormData({...formData, ai_custom_dna_name: e.target.value})} 
                                    placeholder="e.g. Robo-Cat" 
                                    className="w-full text-xs font-mono p-3 border border-gray-200 focus:border-black outline-none bg-white" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-gray-400">Mascot Description (DNA)</label>
                                <textarea 
                                    value={formData.ai_custom_dna_description} 
                                    onChange={e => setFormData({...formData, ai_custom_dna_description: e.target.value})} 
                                    placeholder="Describe physical traits, colors, unique features..." 
                                    className="w-full text-xs font-mono p-3 border border-gray-200 focus:border-black outline-none bg-white min-h-[100px] resize-none" 
                                />
                            </div>
                        </div>

                        <div className="space-y-4 text-center">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block text-left">Visual Reference</label>
                            <div className="aspect-square w-32 mx-auto bg-gray-100 rounded-lg flex items-center justify-center border-2 border-white shadow-sm overflow-hidden relative group">
                                {formData.ai_custom_dna_reference ? (
                                    <img src={formData.ai_custom_dna_reference} alt="Custom DNA Ref" className="w-full h-full object-cover" />
                                ) : (
                                    <UserPlus size={32} className="text-gray-300" />
                                )}
                                {formData.thirdweb_client_id && (
                                    <button onClick={() => dnaRefInputRef.current?.click()} className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploadingDna ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                                        <span className="text-[8px] font-bold uppercase mt-1">Ref Image</span>
                                    </button>
                                )}
                            </div>
                            <input ref={dnaRefInputRef} type="file" className="hidden" accept="image/*" onChange={handleDnaRefUpload} />
                            <p className="text-[9px] text-gray-400 font-bold uppercase">Upload a reference image to help AI stay consistent.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-2">
                        <Camera size={14} /> Image Production Engine
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button 
                            onClick={() => setFormData({...formData, ai_image_model: "google/gemini-3.1-flash-image-preview"})}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${formData.ai_image_model === "google/gemini-3.1-flash-image-preview" ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:border-black"}`}
                        >
                            Gemini 3 (0.06$)
                        </button>
                        <button 
                            onClick={() => setFormData({...formData, ai_image_model: "black-forest-labs/flux.2-klein-4b"})}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${formData.ai_image_model === "black-forest-labs/flux.2-klein-4b" ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:border-black"}`}
                        >
                            FLUX.2 (0.02$)
                        </button>
                        <button 
                            onClick={() => setFormData({...formData, ai_image_model: "google/gemini-2.5-flash-image"})}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${formData.ai_image_model === "google/gemini-2.5-flash-image" ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:border-black"}`}
                        >
                            Gemini 2 (0.04$)
                        </button>
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase italic">
                        {formData.ai_image_model === "google/gemini-2.5-flash-image" ? "Ultra-fast generation optimized for characters." : formData.ai_image_model.includes("flux") ? "Next-gen FLUX.2 Klein: High quality, cheap and native 16:9." : "High-fidelity cinematic generation."}
                    </p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <p className="text-xl text-gray-500 typography-body leading-relaxed">{displayData.bio}</p>
                
                {displayData.ai_custom_dna_name && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-blue-200 overflow-hidden shrink-0">
                            {displayData.ai_custom_dna_reference ? (
                                <img src={displayData.ai_custom_dna_reference} alt="DNA" className="w-full h-full object-cover" />
                            ) : (
                                <UserPlus size={20} className="text-blue-400" />
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Active Custom DNA</p>
                            <h4 className="font-bold text-lg leading-tight">{displayData.ai_custom_dna_name}</h4>
                        </div>
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import { Globe, Settings2, Save, X, Loader2, Database, ShieldCheck, Camera, Eye, EyeOff, HelpCircle, ExternalLink, CheckCircle2 } from "lucide-react";
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
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    ai_image_model: profile.ai_image_model || "google/gemini-3.1-flash-image-preview"
  });

  const [displayData, setDisplayData] = useState({
    name: profile.name || "Anonymous Author",
    bio: profile.bio || "Web3 enthusiast and curator.",
    website: profile.website || "",
    thirdweb_client_id: profile.thirdweb_client_id || "",
    avatar_url: profile.avatar_url || "",
    ai_api_key: profile.ai_api_key || "",
    ai_image_model: profile.ai_image_model || "google/gemini-3.1-flash-image-preview"
  });

  useEffect(() => {
    const data = {
      name: profile.name || "",
      bio: profile.bio || "",
      website: profile.website || "",
      thirdweb_client_id: profile.thirdweb_client_id || "",
      avatar_url: profile.avatar_url || "",
      ai_api_key: profile.ai_api_key || "",
      ai_image_model: profile.ai_image_model || "google/gemini-3.1-flash-image-preview"
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

  const handleSave = async () => {
    setIsEditing(false);
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
      if (!res.ok) throw new Error("Failed to save profile");
      await new Promise(r => setTimeout(r, 800));
      router.refresh();
      setIsSaving(false);
    } catch (e: any) {
      console.error("Save Error:", e.message);
      alert("Error saving profile.");
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
                  <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-md">
                    <Save size={16} /> Save
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

                <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-2">
                        <Camera size={14} /> Image Production Engine
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button 
                            onClick={() => setFormData({...formData, ai_image_model: "google/gemini-3.1-flash-image-preview"})}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${formData.ai_image_model === "google/gemini-3.1-flash-image-preview" ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:border-black"}`}
                        >
                            Gemini 3.1 (Pro)
                        </button>
                        <button 
                            onClick={() => setFormData({...formData, ai_image_model: "google/gemini-2.5-flash-image"})}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${formData.ai_image_model === "google/gemini-2.5-flash-image" ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:border-black"}`}
                        >
                            Nano Banana (2.5 Flash)
                        </button>
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase italic">
                        {formData.ai_image_model === "google/gemini-2.5-flash-image" ? "Ultra-fast generation optimized for characters." : "High-fidelity cinematic generation."}
                    </p>
                </div>
              </div>
            ) : (
              <p className="text-xl text-gray-500 typography-body leading-relaxed">{displayData.bio}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

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
  const [showTooltip, setShowTooltip] = useState(false);
  
  const isOwner = account?.address?.toLowerCase() === profile.address?.toLowerCase();

  const [formData, setFormData] = useState({
    name: profile.name || "",
    bio: profile.bio || "",
    website: profile.website || "",
    thirdweb_client_id: profile.thirdweb_client_id || "",
    avatar_url: profile.avatar_url || ""
  });

  const [displayData, setDisplayData] = useState({
    name: profile.name || "Anonymous Author",
    bio: profile.bio || "Web3 enthusiast and curator.",
    website: profile.website || "",
    thirdweb_client_id: profile.thirdweb_client_id || "",
    avatar_url: profile.avatar_url || ""
  });

  useEffect(() => {
    const data = {
      name: profile.name || "",
      bio: profile.bio || "",
      website: profile.website || "",
      thirdweb_client_id: profile.thirdweb_client_id || "",
      avatar_url: profile.avatar_url || ""
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
      alert("Failed to upload avatar to IPFS. Check your Client ID.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    const previousDisplay = { ...displayData };
    
    setDisplayData({
      ...formData,
      name: formData.name.trim() || "Anonymous Author",
      bio: formData.bio.trim() || "Web3 enthusiast and curator.",
    });
    
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
      setDisplayData(previousDisplay);
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
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
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
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">
                            {displayData.name}
                        </h1>
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
                    <a 
                      href={displayData.website.startsWith('http') ? displayData.website : `https://${displayData.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Globe size={12} />
                      <span>{displayData.website.replace(/^https?:\/\//, '').split('/')[0]}</span>
                    </a>
                  )}
                  {isEditing && (
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <Globe size={12} />
                      <input 
                        type="text"
                        value={formData.website}
                        onChange={e => setFormData({...formData, website: e.target.value})}
                        placeholder="Link"
                        className="text-[10px] font-bold uppercase tracking-widest border-b border-blue-200 focus:outline-none bg-transparent w-24"
                      />
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
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({ ...profile });
                    }} 
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
          </div>

          <div className="max-w-2xl space-y-6">
            {isEditing ? (
              <div className="space-y-6">
                <div className="space-y-1">
                    <textarea 
                        value={formData.bio}
                        onChange={e => setFormData({...formData, bio: e.target.value.slice(0, 120)})}
                        placeholder="Write a short bio..."
                        className="w-full text-lg typography-body border border-[var(--border-soft)] p-4 focus:border-black focus:outline-none min-h-[100px] resize-none bg-white rounded-sm"
                    />
                    <div className="flex justify-end text-[10px] font-bold uppercase tracking-widest text-gray-300">
                        {formData.bio.length} / 120
                    </div>
                </div>
                
                {/* Storage Settings Section */}
                <div className="p-6 bg-gray-50 border border-gray-100 rounded-sm space-y-4 relative">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black">
                            <Database size={14} /> Storage Settings (Web3)
                            <div className="relative inline-block">
                                <button
                                    type="button"
                                    onMouseEnter={() => setShowTooltip(true)}
                                    onMouseLeave={() => setShowTooltip(false)}
                                    onClick={() => setShowTooltip(!showTooltip)}
                                    className="text-gray-300 hover:text-black transition-colors"
                                >
                                    <HelpCircle size={14} />
                                </button>
                                
                                {showTooltip && (
                                    <div className="absolute left-0 bottom-full mb-4 w-[320px] bg-white border border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden">
                                        <div className="p-5 space-y-4">
                                            <div className="space-y-1">
                                                <h4 className="text-[11px] font-black uppercase tracking-tighter">Why authorize?</h4>
                                                <div className="h-[2px] w-8 bg-black" />
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5"><CheckCircle2 size={12} className="text-green-600" /></div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase leading-none mb-1 text-black">IPFS Avatars</p>
                                                        <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed">Upload and store your profile picture on the decentralized web.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5"><CheckCircle2 size={12} className="text-green-600" /></div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase leading-none mb-1 text-black">No Compression</p>
                                                        <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed">Your story banners will be saved in original quality without size limits.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-50 space-y-3">
                                                <div className="space-y-2">
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase italic">Quick Setup Guide:</p>
                                                    <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm grayscale hover:grayscale-0 transition-all duration-500">
                                                        <img src="/screen.png" alt="Thirdweb Guide" className="w-full h-auto" />
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed">
                                                    Go to thirdweb.com, create an <span className="text-black underline">API Key</span>, and copy your <span className="text-black underline">Client ID</span>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {formData.thirdweb_client_id && (
                            <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Verified</span>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        <div className="relative">
                            <input 
                                type={showClientId ? "text" : "password"}
                                value={formData.thirdweb_client_id}
                                onChange={e => setFormData({...formData, thirdweb_client_id: e.target.value})}
                                placeholder="Thirdweb Client ID"
                                className="w-full text-xs font-mono p-3 pr-10 border border-gray-200 focus:border-black outline-none bg-white tracking-widest"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowClientId(!showClientId)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                            >
                                {showClientId ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <a 
                                href="https://thirdweb.com/dashboard/settings/api-keys" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors group"
                            >
                                Get FREE Client ID <ExternalLink size={10} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </a>
                        </div>
                    </div>
                </div>
              </div>
            ) : (
              <p className="text-xl text-gray-500 typography-body leading-relaxed">
                {displayData.bio}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import { Globe, Settings2, Save, X, Loader2, Wallet } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";

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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const isOwner = account?.address?.toLowerCase() === profile.address?.toLowerCase();

  const [formData, setFormData] = useState({
    name: profile.name || "",
    bio: profile.bio || "",
    website: profile.website || ""
  });

  const [displayData, setDisplayData] = useState({
    name: profile.name || "Anonymous Author",
    bio: profile.bio || "Web3 enthusiast and curator.",
    website: profile.website || ""
  });

  useEffect(() => {
    setFormData({
      name: profile.name || "",
      bio: profile.bio || "",
      website: profile.website || ""
    });
    setDisplayData({
      name: profile.name || "Anonymous Author",
      bio: profile.bio || "Web3 enthusiast and curator.",
      website: profile.website || ""
    });
  }, [profile]);

  const handleSave = async () => {
    const previousDisplay = { ...displayData };
    
    // Optimistic Update
    setDisplayData({
      name: formData.name.trim() || "Anonymous Author",
      bio: formData.bio.trim() || "Web3 enthusiast and curator.",
      website: formData.website.trim()
    });
    
    setIsEditing(false);
    setIsSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: profile.address.toLowerCase(),
          name: formData.name.trim(),
          bio: formData.bio.trim(),
          website: formData.website.trim()
        }),
        cache: 'no-store'
      });

      if (!res.ok) throw new Error("Failed to save profile");

      // Даем базе немного времени (800мс)
      await new Promise(r => setTimeout(r, 800));
      
      // router.refresh() обновляет данные серверного компонента без полной перезагрузки страницы
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
             <div className="w-24 h-24 bg-white border border-[var(--border-soft)] rounded-full flex items-center justify-center font-black text-3xl text-black shadow-sm overflow-hidden select-none">
                {displayData.name.charAt(0).toUpperCase()}
             </div>
             
             <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Your Name"
                      className="text-3xl font-black uppercase tracking-tighter border-b-2 border-black focus:outline-none w-full max-w-md bg-transparent"
                      autoFocus
                    />
                  ) : (
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                      {displayData.name}
                    </h1>
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-black">{totalArticles}</span> Stories
                  </div>
                  <div className="w-1 h-1 bg-gray-200 rounded-full" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-black">{Math.floor(totalRewards)}</span> $HASH Earned
                  </div>
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
                      setFormData({ name: profile.name || "", bio: profile.bio || "", website: profile.website || "" });
                    }} 
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
          </div>

          <div className="max-w-2xl space-y-4">
            {isEditing ? (
              <textarea 
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                placeholder="Write a short bio..."
                className="w-full text-lg typography-body border border-[var(--border-soft)] p-4 focus:border-black focus:outline-none min-h-[100px] resize-none bg-white rounded-sm"
              />
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

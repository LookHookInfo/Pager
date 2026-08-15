"use client";

import { Camera, Loader2, Zap, Activity, EyeIcon, Fingerprint, Info } from "lucide-react";
import { useState } from "react";

function DnaTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1.5 text-gray-300 hover:text-black transition-colors"
      >
        <Info size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-black text-white text-[9px] leading-relaxed rounded-sm shadow-2xl z-50 pointer-events-none">
          <div className="font-black uppercase tracking-widest mb-1.5 text-[8px] text-gray-400">{label}</div>
          <div className="text-white/90">{children}</div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black" />
        </div>
      )}
    </span>
  );
}

interface Props {
  forgeData: any;
  isForging: boolean;
  isAnalyzingDna: boolean;
  forgeErrors: string[];
  onMascotImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onForgeDataChange: (data: any) => void;
  onForge: () => void;
}

export default function ProfileForge({
  forgeData, isForging, isAnalyzingDna, forgeErrors,
  onMascotImageUpload, onForgeDataChange, onForge,
}: Props) {
  const set = (patch: any) => onForgeDataChange({ ...forgeData, ...patch });

  return (
    <div className="p-6 border-2 border-black rounded-sm bg-white shadow-2xl relative">
      {isAnalyzingDna && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white gap-4 animate-in fade-in duration-300 rounded-sm">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" size={24} />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">AI Scan Active</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase">Extracting Character DNA...</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-black text-white rounded-sm"><Fingerprint size={16} /></div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em]">Key Forge</h3>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="w-28 h-28 shrink-0 bg-gray-50 border border-dashed border-gray-200 rounded-sm relative overflow-hidden group">
          {forgeData.image_url ? (
            <img src={forgeData.image_url} className="w-full h-full object-cover" alt="Preview" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-1">
              <Camera size={20} />
              <span className="text-[7px] font-bold uppercase text-gray-300">Photo</span>
            </div>
          )}
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            accept="image/*"
            onChange={onMascotImageUpload}
          />
        </div>

        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={forgeData.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="Protocol Name"
            className={`w-full text-xs font-bold p-2.5 border outline-none transition-colors ${forgeErrors.includes("name") ? "border-red-500 bg-red-50/10" : "border-gray-100 bg-gray-50/50"}`}
          />
          <input
            type="number"
            value={forgeData.price}
            onChange={e => set({ price: e.target.value })}
            placeholder="Price ($HASH)"
            className={`w-full text-xs font-bold p-2.5 border outline-none bg-gray-50/50 ${forgeErrors.includes("price") ? "border-red-500 bg-red-50/10" : "border-gray-100"}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className="flex items-center text-[8px] font-black uppercase text-gray-400">
            <Activity size={9} className="text-blue-500 shrink-0" /> Personality
            <DnaTooltip label="Personality">
              Temperament, values, worldview, analytical style. Drives how they think and interpret news.
            </DnaTooltip>
          </div>
          <textarea
            value={forgeData.personality}
            onChange={e => set({ personality: e.target.value })}
            placeholder="Cynical Bitcoin maxi. Trusts on-chain data."
            rows={3}
            className={`w-full text-[11px] p-2 border outline-none transition-colors resize-none ${forgeErrors.includes("personality") ? "border-red-500 bg-red-50/10" : "border-gray-100 bg-gray-50/50"}`}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center text-[8px] font-black uppercase text-gray-400">
            <Activity size={9} className="text-purple-500 shrink-0" /> Voice
            <DnaTooltip label="Voice">
              Vocabulary, sentence rhythm, catchphrases, slang. How they SPEAK — not who they ARE.
            </DnaTooltip>
          </div>
          <textarea
            value={forgeData.voice}
            onChange={e => set({ voice: e.target.value })}
            placeholder="Noir detective. Calls everyone kid."
            rows={3}
            className={`w-full text-[11px] p-2 border outline-none transition-colors resize-none ${forgeErrors.includes("voice") ? "border-red-500 bg-red-50/10" : "border-gray-100 bg-gray-50/50"}`}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center text-[8px] font-black uppercase text-gray-400">
            <EyeIcon size={9} className="text-green-500 shrink-0" /> Physical DNA
            <DnaTooltip label="Physical DNA">
              Silhouette, colors, clothing, build, environment. Describes how the mascot LOOKS in AI banners.
            </DnaTooltip>
          </div>
          <textarea
            value={forgeData.visual_desc}
            onChange={e => set({ visual_desc: e.target.value })}
            placeholder="Tall lanky humanoid. Silver skin. Trench coat."
            rows={3}
            className="w-full text-[11px] p-2 border border-gray-100 outline-none bg-gray-50/50 resize-none"
          />
        </div>
      </div>

      <button
        onClick={onForge}
        disabled={isForging || isAnalyzingDna || !forgeData.image_url}
        className="w-full mt-4 bg-black text-white py-3 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-gray-800 transition-all shadow-xl disabled:opacity-50"
      >
        {isForging ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} /> Forge Mascot</>}
      </button>
    </div>
  );
}

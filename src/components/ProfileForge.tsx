"use client";

import { Camera, Loader2, Scan, Database, Zap, Activity, EyeIcon, Fingerprint } from "lucide-react";

interface Props {
  forgeData: any;
  forgeStep: "dna" | "mint";
  isForging: boolean;
  isAnalyzingDna: boolean;
  forgeErrors: string[];
  onMascotImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onForgeDataChange: (data: any) => void;
  onSealGenes: () => void;
  onIgniteKey: () => void;
  onBackToDna: () => void;
}

export default function ProfileForge({
  forgeData, forgeStep, isForging, isAnalyzingDna, forgeErrors,
  onMascotImageUpload, onForgeDataChange, onSealGenes, onIgniteKey, onBackToDna,
}: Props) {
  const set = (patch: any) => onForgeDataChange({ ...forgeData, ...patch });

  return (
    <div className="p-8 border-2 border-black rounded-sm bg-white shadow-2xl space-y-6 relative overflow-hidden">
      {isAnalyzingDna && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white gap-4 animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <Scan className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" size={24} />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">AI Scan Active</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase">Extracting Character DNA...</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="p-2 bg-black text-white rounded-sm"><Fingerprint size={16} /></div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em]">Key Forge</h3>
      </div>

      <div className="aspect-square bg-gray-50 border border-dashed border-gray-200 rounded-sm relative overflow-hidden group">
        {forgeData.image_url ? (
          <img src={forgeData.image_url} className="w-full h-full object-cover" alt="Preview" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-2"><Camera size={32} /></div>
        )}
        <input
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer"
          accept="image/*"
          onChange={onMascotImageUpload}
          disabled={forgeStep === "mint"}
        />
      </div>

      <div className="space-y-4">
        <input
          type="text"
          value={forgeData.name}
          onChange={e => { set({ name: e.target.value }); }}
          placeholder="Protocol Name"
          className={`w-full text-xs font-bold p-3 border outline-none transition-colors ${forgeErrors.includes("name") ? "border-red-500 bg-red-50/10" : "border-gray-100 bg-gray-50/50"}`}
          disabled={forgeStep === "mint"}
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 ml-1">
            <Activity size={10} className="text-blue-500" /> Behavioral DNA
          </div>
          <textarea
            value={forgeData.personality}
            onChange={e => set({ personality: e.target.value })}
            placeholder="Character mindset & voice..."
            className={`w-full text-xs p-3 border outline-none transition-colors min-h-[80px] ${forgeErrors.includes("personality") ? "border-red-500 bg-red-50/10" : "border-gray-100 bg-gray-50/50"}`}
            disabled={forgeStep === "mint"}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 ml-1">
            <EyeIcon size={10} className="text-green-500" /> Physical DNA
          </div>
          <textarea
            value={forgeData.visual_desc}
            onChange={e => set({ visual_desc: e.target.value })}
            placeholder="Clothing, build, colors..."
            className="w-full text-xs p-3 border border-gray-100 outline-none bg-gray-50/50 min-h-[80px]"
            disabled={forgeStep === "mint"}
          />
        </div>

        <input
          type="number"
          value={forgeData.price}
          onChange={e => set({ price: e.target.value })}
          placeholder="Price ($HASH)"
          className="w-full text-xs font-bold p-3 border border-gray-100 outline-none bg-gray-50/50"
          disabled={forgeStep === "mint"}
        />
      </div>

      {forgeStep === "dna" ? (
        <button
          onClick={onSealGenes}
          disabled={isForging || isAnalyzingDna || !forgeData.image_url}
          className="w-full bg-black text-white py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-gray-800 transition-all shadow-xl disabled:opacity-50"
        >
          {isForging ? <Loader2 size={14} className="animate-spin" /> : <><Database size={14} /> Seal Genes (Step 1)</>}
        </button>
      ) : (
        <div className="space-y-3">
          <button
            onClick={onIgniteKey}
            disabled={isForging}
            className="w-full bg-yellow-400 text-black py-4 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-yellow-500 transition-all shadow-xl"
          >
            {isForging ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} /> Ignite Key (Step 2)</>}
          </button>
          <button onClick={onBackToDna} className="w-full text-[9px] font-bold uppercase text-gray-400 hover:text-black">Edit DNA Again</button>
        </div>
      )}
    </div>
  );
}

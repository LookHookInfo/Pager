"use client";

import { Camera, Loader2, Globe } from "lucide-react";
import { useRef } from "react";

interface Props {
  formData: any;
  displayData: any;
  isUploading: boolean;
  onFormChange: (data: any) => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function ProfileIdentity({ formData, displayData, isUploading, onFormChange, onAvatarUpload, fileInputRef }: Props) {
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
        Identity Gene
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          value={formData.name}
          onChange={e => onFormChange({ ...formData, name: e.target.value })}
          placeholder="Display Name"
          className="w-full text-xs font-bold p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors"
        />
        <input
          type="text"
          value={formData.website}
          onChange={e => onFormChange({ ...formData, website: e.target.value })}
          placeholder="Website URL"
          className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors"
        />
      </div>
      <textarea
        value={formData.bio}
        onChange={e => onFormChange({ ...formData, bio: e.target.value })}
        placeholder="Biographical Data..."
        className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors min-h-[80px]"
      />
    </div>
  );
}

"use client";

import type { Profile } from "@/types";

interface Props {
  formData: Profile;
  displayData: { name: string; bio: string; website?: string };
  isUploading: boolean;
  onFormChange: (data: Profile) => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function ProfileIdentity({ formData, onFormChange }: Props) {
  return (
    <div className="space-y-4">
      <h4 className="section-label">Identity</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          value={formData.name || ""}
          onChange={e => onFormChange({ ...formData, name: e.target.value })}
          placeholder="Display Name"
          className="input font-bold"
        />
        <input
          type="text"
          value={formData.website || ""}
          onChange={e => onFormChange({ ...formData, website: e.target.value })}
          placeholder="Website URL"
          className="input"
        />
      </div>
      <textarea
        value={formData.bio || ""}
        onChange={e => onFormChange({ ...formData, bio: e.target.value })}
        placeholder="Biographical Data..."
        className="input min-h-[80px] resize-y"
      />
      <div className="space-y-1.5">
        <label className="section-label">CoinMarketCap Username</label>
        <input
          type="text"
          value={formData.cmc_username || ""}
          onChange={e => onFormChange({ ...formData, cmc_username: e.target.value })}
          placeholder="Your CMC community username"
          className="input"
        />
      </div>
      <div className="space-y-1.5">
        <label className="section-label flex items-center gap-1.5">
          GemFun Token Contract
          <a
            href="https://hashcoin.farm/gem"
            target="_blank"
            rel="noopener noreferrer"
            className="normal-case tracking-normal text-[var(--blue)] hover:underline flex items-center gap-0.5 text-[10px]"
          >
            (Open GemFun ↗)
          </a>
        </label>
        <input
          type="text"
          value={formData.gemfun_token || ""}
          onChange={e => onFormChange({ ...formData, gemfun_token: e.target.value })}
          placeholder="0x... — meme token address"
          className="input font-mono text-[11px]"
        />
        <p className="text-[10px] text-[var(--text-faint)]">Pinned under your bio so readers can buy it.</p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus, Trash2, Send, ShieldCheck, Languages, Eye, EyeOff } from "lucide-react";
import { maskChatId } from "@/lib/security";
import type { Profile, TelegramChannel, BinanceAccount, CtaLink, RefLink } from "@/types";

const LANGUAGES = ["English", "Russian", "Spanish", "Chinese", "French", "German", "Japanese", "Turkish"];

const MAX_TELEGRAM_CHANNELS = 10;
const MAX_BINANCE_ACCOUNTS = 5;

interface Props {
  formData: Profile;
  onFormChange: (data: Profile) => void;
}

export default function ProfileDistribution({ formData, onFormChange }: Props) {
  const set = (patch: Partial<Profile>) => onFormChange({ ...formData, ...patch });
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());

  const toggleReveal = (idx: number) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-6 pt-6 border-t border-[var(--border)]">
      <h4 className="section-label">Distribution</h4>

      {/* Telegram Channels */}
      <div className="space-y-3 p-4 bg-[var(--surface-dim)] border border-[var(--border)] rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={12} className="text-[var(--blue)]" />
            <span className="section-label text-[var(--text)]">Telegram</span>
            <span className="text-[9px] font-medium text-[var(--text-faint)]">({MAX_TELEGRAM_CHANNELS} max)</span>
          </div>
          <button
            onClick={() => set({ telegram_channels: [...(formData.telegram_channels || []), { label: "", chatId: "", topicId: "", language: "English", style: "Engaging" }] })}
            disabled={(formData.telegram_channels || []).length >= MAX_TELEGRAM_CHANNELS}
            className="btn btn--ghost btn--sm !text-[var(--blue)] !border-[var(--blue)]/30 disabled:opacity-30"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <div className="space-y-2">
          {(formData.telegram_channels || []).map((ch: TelegramChannel, idx: number) => {
            const isRevealed = revealedIds.has(idx);
            const isMasked = ch.chatId && ch.chatId.startsWith("-") && !isRevealed;
            return (
              <div key={idx} className="space-y-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl relative">
                <button
                  onClick={() => set({ telegram_channels: (formData.telegram_channels || []).filter((_, i: number) => i !== idx) })}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--red)] text-white rounded-lg flex items-center justify-center hover:bg-[var(--red)]/80"
                >
                  <Trash2 size={9} />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={ch.label} onChange={e => {
                    const c = [...(formData.telegram_channels || [])]; c[idx] = { ...c[idx], label: e.target.value }; set({ telegram_channels: c });
                  }} placeholder="Channel Name" className="input text-[11px] font-bold !py-1.5 !px-2.5" />
                  <div className="relative">
                    <input
                      type={isMasked ? "password" : "text"}
                      value={isMasked ? maskChatId(ch.chatId) : ch.chatId}
                      onChange={e => {
                        const c = [...(formData.telegram_channels || [])]; c[idx] = { ...c[idx], chatId: e.target.value }; set({ telegram_channels: c });
                      }}
                      onFocus={() => { if (ch.chatId?.startsWith("-") && !isRevealed) toggleReveal(idx); }}
                      placeholder="Chat ID / @channel"
                      className="input font-mono text-[11px] !py-1.5 !px-2.5 pr-7"
                    />
                    {ch.chatId && ch.chatId.startsWith("-") && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(idx)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
                      >
                        {isRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={ch.topicId || ""} onChange={e => {
                    const c = [...(formData.telegram_channels || [])]; c[idx] = { ...c[idx], topicId: e.target.value }; set({ telegram_channels: c });
                  }} placeholder="Topic ID" className="input font-mono text-[11px] !py-1.5 !px-2.5" />
                  <div className="input !py-1.5 !px-2.5 flex items-center gap-1.5 !cursor-default">
                    <Languages size={11} className="text-[var(--text-faint)]" />
                    <select value={ch.language} onChange={e => {
                      const c = [...(formData.telegram_channels || [])]; c[idx] = { ...c[idx], language: e.target.value }; set({ telegram_channels: c });
                    }} className="bg-transparent text-[10px] font-semibold outline-none flex-1">
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <input type="text" value={ch.style} onChange={e => {
                    const c = [...(formData.telegram_channels || [])]; c[idx] = { ...c[idx], style: e.target.value }; set({ telegram_channels: c });
                  }} placeholder="Style" className="input text-[11px] font-semibold !py-1.5 !px-2.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Binance Square */}
      <div className="space-y-3 p-4 bg-[var(--surface-dim)] border border-[var(--border)] rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} className="text-[var(--yellow)]" />
            <span className="section-label text-[var(--text)]">Binance Square</span>
            <span className="text-[9px] font-medium text-[var(--text-faint)]">({MAX_BINANCE_ACCOUNTS} max)</span>
          </div>
          <button
            onClick={() => set({ binance_accounts: [...(formData.binance_accounts || []), { label: "", apiKey: "", language: "English", style: "Professional" }] })}
            disabled={(formData.binance_accounts || []).length >= MAX_BINANCE_ACCOUNTS}
            className="btn btn--ghost btn--sm !text-[var(--blue)] !border-[var(--blue)]/30 disabled:opacity-30"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <div className="space-y-2">
          {(formData.binance_accounts || []).map((acc: BinanceAccount, idx: number) => (
            <div key={idx} className="space-y-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl relative">
              <button
                onClick={() => set({ binance_accounts: (formData.binance_accounts || []).filter((_, i: number) => i !== idx) })}
                className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--red)] text-white rounded-lg flex items-center justify-center hover:bg-[var(--red)]/80"
              >
                <Trash2 size={9} />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={acc.label} onChange={e => {
                  const a = [...(formData.binance_accounts || [])]; a[idx] = { ...a[idx], label: e.target.value }; set({ binance_accounts: a });
                }} placeholder="Label" className="input text-[11px] font-bold !py-1.5 !px-2.5" />
                <input type="password" value={acc.apiKey} onChange={e => {
                  const a = [...(formData.binance_accounts || [])]; a[idx] = { ...a[idx], apiKey: e.target.value }; set({ binance_accounts: a });
                }} placeholder="API Key" className="input font-mono text-[11px] !py-1.5 !px-2.5" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="input !py-1.5 !px-2.5 flex items-center gap-1.5 !cursor-default">
                  <Languages size={11} className="text-[var(--text-faint)]" />
                  <select value={acc.language} onChange={e => {
                    const a = [...(formData.binance_accounts || [])]; a[idx] = { ...a[idx], language: e.target.value }; set({ binance_accounts: a });
                  }} className="bg-transparent text-[10px] font-semibold outline-none flex-1">
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <input type="text" value={acc.style} onChange={e => {
                  const a = [...(formData.binance_accounts || [])]; a[idx] = { ...a[idx], style: e.target.value }; set({ binance_accounts: a });
                }} placeholder="Style" className="input text-[11px] font-semibold !py-1.5 !px-2.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Author CTAs */}
      <div className="space-y-3 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="section-label">Author CTAs</span>
            <span className="text-[9px] font-medium text-[var(--text-faint)]">(3 max)</span>
          </div>
          <button
            onClick={() => set({ cta_links: [...(formData.cta_links || []), { label: "", url: "" }] })}
            disabled={(formData.cta_links || []).length >= 3}
            className="btn btn--ghost btn--sm !text-[var(--blue)] !border-[var(--blue)]/30 disabled:opacity-30"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-faint)] -mt-1">
          Links in the <strong className="text-[var(--text)]">BTC Impact Analysis</strong> block as &quot;FOLLOW FOR MORE INTEL&quot;.
        </p>
        {(formData.cta_links || []).map((link: CtaLink, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl relative">
            <button
              onClick={() => set({ cta_links: (formData.cta_links || []).filter((_, i: number) => i !== idx) })}
              className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--red)] text-white rounded-lg flex items-center justify-center hover:bg-[var(--red)]/80"
            >
              <Trash2 size={9} />
            </button>
            <input type="text" value={link.label} onChange={e => {
              const c = [...(formData.cta_links || [])]; c[idx] = { ...c[idx], label: e.target.value }; set({ cta_links: c });
            }} placeholder="e.g. Telegram" className="input text-[11px] font-bold !py-2" />
            <input type="text" value={link.url} onChange={e => {
              const c = [...(formData.cta_links || [])]; c[idx] = { ...c[idx], url: e.target.value }; set({ cta_links: c });
            }} placeholder="https://t.me/your-channel" className="md:col-span-2 input text-[11px] !py-2" />
          </div>
        ))}
      </div>

      {/* Referral Links */}
      <div className="space-y-3 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="section-label">Referral Links</span>
            <span className="text-[9px] font-medium text-[var(--text-faint)]">(3 max)</span>
          </div>
          <button
            onClick={() => set({ ref_links: [...(formData.ref_links || []), { label: "", url: "" }] })}
            disabled={(formData.ref_links || []).length >= 3}
            className="btn btn--ghost btn--sm !text-[var(--blue)] !border-[var(--blue)]/30 disabled:opacity-30"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-faint)] -mt-1">
          Links in the <strong className="text-[var(--text)]">BTC Impact Analysis</strong> block at the bottom of every article.
        </p>
        {(formData.ref_links || []).map((link: RefLink, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl relative">
            <button
              onClick={() => set({ ref_links: (formData.ref_links || []).filter((_, i: number) => i !== idx) })}
              className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--red)] text-white rounded-lg flex items-center justify-center hover:bg-[var(--red)]/80"
            >
              <Trash2 size={9} />
            </button>
            <input type="text" value={link.label} onChange={e => {
              const r = [...(formData.ref_links || [])]; r[idx] = { ...r[idx], label: e.target.value }; set({ ref_links: r });
            }} placeholder="e.g. ByBit" className="input text-[11px] font-bold !py-2" />
            <input type="text" value={link.url} onChange={e => {
              const r = [...(formData.ref_links || [])]; r[idx] = { ...r[idx], url: e.target.value }; set({ ref_links: r });
            }} placeholder="https://your-referral-link.com" className="md:col-span-2 input text-[11px] !py-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

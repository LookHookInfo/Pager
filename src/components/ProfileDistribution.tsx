"use client";

import { useState } from "react";
import { Plus, Trash2, Send, ShieldCheck, Languages, Eye, EyeOff } from "lucide-react";

const LANGUAGES = ["English", "Russian", "Spanish", "Chinese", "French", "German", "Japanese", "Turkish"];

const MAX_TELEGRAM_CHANNELS = 10;
const MAX_BINANCE_ACCOUNTS = 5;

function maskChatId(id: string): string {
  if (!id) return "";
  if (id.startsWith("-100")) return "-100••••" + id.slice(-3);
  if (id.startsWith("-")) return "-•••" + id.slice(-3);
  if (id.startsWith("@")) return id;
  return "•••" + id.slice(-3);
}

interface Props {
  formData: any;
  onFormChange: (data: any) => void;
}

export default function ProfileDistribution({ formData, onFormChange }: Props) {
  const set = (patch: any) => onFormChange({ ...formData, ...patch });
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());

  const toggleReveal = (idx: number) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-6 pt-6 border-t border-gray-50">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
        Distribution Protocols
      </h4>

      {/* Telegram Channels */}
      <div className="space-y-4 p-5 bg-gray-50/50 border border-gray-100 rounded-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={14} className="text-blue-500" />
            <label className="text-[10px] font-black uppercase text-black">Telegram Channels</label>
            <span className="text-[8px] font-bold text-gray-300">({MAX_TELEGRAM_CHANNELS} max)</span>
          </div>
          <button
            onClick={() => set({ telegram_channels: [...(formData.telegram_channels || []), { label: "", chatId: "", topicId: "", language: "English", style: "Engaging" }] })}
            disabled={(formData.telegram_channels || []).length >= MAX_TELEGRAM_CHANNELS}
            className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus size={10} /> Add Channel
          </button>
        </div>
        <div className="space-y-3">
          {(formData.telegram_channels || []).map((ch: any, idx: number) => {
            const isRevealed = revealedIds.has(idx);
            const isMasked = ch.chatId && ch.chatId.startsWith("-") && !isRevealed;
            return (
              <div key={idx} className="space-y-2 p-3 bg-white border border-gray-200 rounded-sm relative">
                <button
                  onClick={() => set({ telegram_channels: formData.telegram_channels.filter((_: any, i: number) => i !== idx) })}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <Trash2 size={10} />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={ch.label} onChange={e => {
                    const c = [...formData.telegram_channels]; c[idx] = { ...c[idx], label: e.target.value }; set({ telegram_channels: c });
                  }} placeholder="Channel Name" className="text-xs font-bold p-2 border border-gray-100 outline-none bg-gray-50/30" />
                  <div className="relative">
                    <input
                      type={isMasked ? "password" : "text"}
                      value={isMasked ? maskChatId(ch.chatId) : ch.chatId}
                      onChange={e => {
                        const c = [...formData.telegram_channels]; c[idx] = { ...c[idx], chatId: e.target.value }; set({ telegram_channels: c });
                      }}
                      onFocus={() => { if (ch.chatId?.startsWith("-") && !isRevealed) toggleReveal(idx); }}
                      placeholder="Chat ID / @channel"
                      className="text-xs font-mono p-2 pr-8 border border-gray-100 outline-none bg-gray-50/30 w-full"
                    />
                    {ch.chatId && ch.chatId.startsWith("-") && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(idx)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-black transition-colors"
                      >
                        {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={ch.topicId || ""} onChange={e => {
                    const c = [...formData.telegram_channels]; c[idx] = { ...c[idx], topicId: e.target.value }; set({ telegram_channels: c });
                  }} placeholder="Topic ID" className="text-xs font-mono p-2 border border-gray-100 outline-none bg-gray-50/30" />
                  <div className="flex items-center gap-2 bg-gray-50/50 p-2 border border-gray-50">
                    <Languages size={12} className="text-gray-400" />
                    <select value={ch.language} onChange={e => {
                      const c = [...formData.telegram_channels]; c[idx] = { ...c[idx], language: e.target.value }; set({ telegram_channels: c });
                    }} className="bg-transparent text-[10px] font-bold outline-none flex-1">
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <input type="text" value={ch.style} onChange={e => {
                    const c = [...formData.telegram_channels]; c[idx] = { ...c[idx], style: e.target.value }; set({ telegram_channels: c });
                  }} placeholder="Style" className="text-xs font-bold p-2 border border-gray-50 outline-none bg-gray-50/50" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Binance Square */}
      <div className="space-y-4 p-5 bg-gray-50/50 border border-gray-100 rounded-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-yellow-500" />
            <label className="text-[10px] font-black uppercase text-black">Binance Square</label>
            <span className="text-[8px] font-bold text-gray-300">({MAX_BINANCE_ACCOUNTS} max)</span>
          </div>
          <button
            onClick={() => set({ binance_accounts: [...(formData.binance_accounts || []), { label: "", apiKey: "", language: "English", style: "Professional" }] })}
            disabled={(formData.binance_accounts || []).length >= MAX_BINANCE_ACCOUNTS}
            className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus size={10} /> Add Account
          </button>
        </div>
        <div className="space-y-3">
          {(formData.binance_accounts || []).map((acc: any, idx: number) => (
            <div key={idx} className="space-y-2 p-3 bg-white border border-gray-200 rounded-sm relative">
              <button
                onClick={() => set({ binance_accounts: formData.binance_accounts.filter((_: any, i: number) => i !== idx) })}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <Trash2 size={10} />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={acc.label} onChange={e => {
                  const a = [...formData.binance_accounts]; a[idx] = { ...a[idx], label: e.target.value }; set({ binance_accounts: a });
                }} placeholder="Label" className="text-xs font-bold p-2 border border-gray-100 outline-none bg-gray-50/30" />
                <input type="password" value={acc.apiKey} onChange={e => {
                  const a = [...formData.binance_accounts]; a[idx] = { ...a[idx], apiKey: e.target.value }; set({ binance_accounts: a });
                }} placeholder="API Key" className="text-xs font-mono p-2 border border-gray-100 outline-none bg-gray-50/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-gray-50/50 p-2 border border-gray-50">
                  <Languages size={12} className="text-gray-400" />
                  <select value={acc.language} onChange={e => {
                    const a = [...formData.binance_accounts]; a[idx] = { ...a[idx], language: e.target.value }; set({ binance_accounts: a });
                  }} className="bg-transparent text-[10px] font-bold outline-none flex-1">
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <input type="text" value={acc.style} onChange={e => {
                  const a = [...formData.binance_accounts]; a[idx] = { ...a[idx], style: e.target.value }; set({ binance_accounts: a });
                }} placeholder="Style" className="text-xs font-bold p-2 border border-gray-50 outline-none bg-gray-50/50" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Author CTAs */}
      <div className="space-y-4 pt-4 border-t border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Author CTAs</h4>
            <span className="text-[8px] font-bold text-gray-300">(3 max)</span>
          </div>
          <button
            onClick={() => set({ cta_links: [...(formData.cta_links || []), { label: "", url: "" }] })}
            disabled={(formData.cta_links || []).length >= 3}
            className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus size={10} /> Add Link
          </button>
        </div>
        <p className="text-[9px] text-gray-400 ml-1 -mt-2 mb-3">
          These links appear in the <strong className="text-black">BTC Impact Analysis</strong> block as "FOLLOW FOR MORE INTEL". Set a name and URL for each channel.
        </p>
        {(formData.cta_links || []).map((link: any, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-white border border-gray-100 rounded-sm relative">
            <button
              onClick={() => set({ cta_links: formData.cta_links.filter((_: any, i: number) => i !== idx) })}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <Trash2 size={10} />
            </button>
            <input type="text" value={link.label} onChange={e => {
              const c = [...formData.cta_links]; c[idx] = { ...c[idx], label: e.target.value }; set({ cta_links: c });
            }} placeholder="e.g. Telegram" className="md:col-span-1 text-xs font-bold p-3 border border-gray-200 outline-none bg-gray-50/50 focus:border-black focus:bg-white transition-all" />
            <input type="text" value={link.url} onChange={e => {
              const c = [...formData.cta_links]; c[idx] = { ...c[idx], url: e.target.value }; set({ cta_links: c });
            }} placeholder="https://t.me/your-channel" className="md:col-span-2 text-xs p-3 border border-gray-200 outline-none bg-gray-50/50 focus:border-black focus:bg-white transition-all" />
          </div>
        ))}
      </div>

      {/* Referral Links */}
      <div className="space-y-4 pt-4 border-t border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Referral Links</h4>
            <span className="text-[8px] font-bold text-gray-300">(3 max)</span>
          </div>
          <button
            onClick={() => set({ ref_links: [...(formData.ref_links || []), { label: "", url: "" }] })}
            disabled={(formData.ref_links || []).length >= 3}
            className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus size={10} /> Add Link
          </button>
        </div>
        <p className="text-[9px] text-gray-400 ml-1 -mt-2 mb-3">
          These links appear in the <strong className="text-black">BTC Impact Analysis</strong> block at the bottom of every article you publish. Users see them as trading platform recommendations.
        </p>
        {(formData.ref_links || []).map((link: any, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-white border border-gray-100 rounded-sm relative">
            <button
              onClick={() => set({ ref_links: formData.ref_links.filter((_: any, i: number) => i !== idx) })}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <Trash2 size={10} />
            </button>
            <input type="text" value={link.label} onChange={e => {
              const r = [...formData.ref_links]; r[idx] = { ...r[idx], label: e.target.value }; set({ ref_links: r });
            }} placeholder="e.g. ByBit" className="md:col-span-1 text-xs font-bold p-3 border border-gray-200 outline-none bg-gray-50/50 focus:border-black focus:bg-white transition-all" />
            <input type="text" value={link.url} onChange={e => {
              const r = [...formData.ref_links]; r[idx] = { ...r[idx], url: e.target.value }; set({ ref_links: r });
            }} placeholder="https://your-referral-link.com" className="md:col-span-2 text-xs p-3 border border-gray-200 outline-none bg-gray-50/50 focus:border-black focus:bg-white transition-all" />
          </div>
        ))}
      </div>
    </div>
  );
}

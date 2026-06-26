"use client";

import { Plus, Trash2, Send, ShieldCheck, Languages, UserCircle } from "lucide-react";

const LANGUAGES = ["English", "Russian", "Spanish", "Chinese", "French", "German", "Japanese", "Turkish"];

interface Props {
  formData: any;
  onFormChange: (data: any) => void;
}

export default function ProfileDistribution({ formData, onFormChange }: Props) {
  const set = (patch: any) => onFormChange({ ...formData, ...patch });

  return (
    <div className="space-y-6 pt-6 border-t border-gray-50">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
        Distribution Protocols
      </h4>

      <div className="space-y-4 p-5 bg-gray-50/50 border border-gray-100 rounded-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={14} className="text-blue-500" />
            <label className="text-[10px] font-black uppercase text-black">Telegram Channels</label>
          </div>
          <button
            onClick={() => set({ telegram_channels: [...(formData.telegram_channels || []), { label: "", chatId: "", topicId: "", language: "English", style: "Engaging" }] })}
            className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm"
          >
            <Plus size={10} /> Add Channel
          </button>
        </div>
        <div className="space-y-3">
          {(formData.telegram_channels || []).map((ch: any, idx: number) => (
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
                <input type="text" value={ch.chatId} onChange={e => {
                  const c = [...formData.telegram_channels]; c[idx] = { ...c[idx], chatId: e.target.value }; set({ telegram_channels: c });
                }} placeholder="Chat ID / @channel" className="text-xs font-mono p-2 border border-gray-100 outline-none bg-gray-50/30" />
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
          ))}
        </div>
      </div>

      <div className="space-y-4 p-5 bg-gray-50/50 border border-gray-100 rounded-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-yellow-500" />
            <label className="text-[10px] font-black uppercase text-black">Binance Square</label>
          </div>
          <button
            onClick={() => set({ binance_accounts: [...(formData.binance_accounts || []), { label: "", apiKey: "", language: "English", style: "Professional" }] })}
            className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 border border-gray-200 rounded-sm"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" value={formData.cta_telegram} onChange={e => set({ cta_telegram: e.target.value })} placeholder="CTA Telegram Link" className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors" />
        <input type="text" value={formData.cta_forum} onChange={e => set({ cta_forum: e.target.value })} placeholder="CTA Forum Link" className="w-full text-xs p-3 border border-gray-200 outline-none bg-white focus:border-black transition-colors" />
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-50">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Protocol References (3 Max)</h4>
        {formData.ref_links.map((link: any, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" value={link.label} onChange={e => {
              const r = [...formData.ref_links]; r[idx] = { ...r[idx], label: e.target.value }; set({ ref_links: r });
            }} placeholder="Label" className="md:col-span-1 text-xs font-bold p-3 border border-gray-200 outline-none bg-white" />
            <input type="text" value={link.url} onChange={e => {
              const r = [...formData.ref_links]; r[idx] = { ...r[idx], url: e.target.value }; set({ ref_links: r });
            }} placeholder="https://..." className="md:col-span-2 text-xs p-3 border border-gray-200 outline-none bg-white" />
          </div>
        ))}
      </div>
    </div>
  );
}

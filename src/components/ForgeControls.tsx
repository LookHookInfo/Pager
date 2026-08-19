"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ShoppingCart, ChevronDown, X, Zap, Settings2,
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, Heading2, Quote,
} from "lucide-react";
import { MOODS, ATMOSPHERE_PRESETS } from "@/lib/moods";

export interface OwnedMascot {
  id: string;
  name: string;
  image: string;
  hasDna: boolean;
}

export function MascotRequiredPanel({ message }: { message: string }) {
  return (
    <div className="text-center py-8 bg-white border border-gray-100 p-8 rounded-sm">
      <AlertCircle className="mx-auto text-red-500 mb-4" size={32} />
      <h3 className="text-sm font-black uppercase tracking-widest mb-2">NFT Mascot Required</h3>
      <p className="text-xs text-gray-400 mb-6 uppercase font-bold">{message}</p>
      <Link href="/mascots" className="btn btn--primary inline-flex items-center gap-2 px-8 py-3 text-[10px] font-black uppercase tracking-widest">
        <ShoppingCart size={14} /> Visit Registry
      </Link>
    </div>
  );
}

interface MascotSelectorProps {
  mascots: OwnedMascot[];
  value: string | null;
  onChange: (id: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  placeholder?: string;
}

export function MascotSelector({ mascots, value, onChange, dropdownRef, isOpen, onToggle, placeholder }: MascotSelectorProps) {
  const selected = mascots.find(m => m.id === value);
  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => onToggle(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-3 bg-white border border-gray-200 rounded-sm hover:border-black transition-all group">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {selected ? (
            <>
              <img src={selected.image} className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0" alt="" />
              <span className="text-[10px] font-black uppercase truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-[10px] font-black uppercase text-gray-400">{placeholder || "Protocol"}</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] max-h-72 overflow-y-auto">
          {mascots.map(m => (
            <div key={m.id} onClick={() => { onChange(m.id); onToggle(false); }}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${value === m.id ? "bg-blue-50/50" : ""}`}>
              <img src={m.image} className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0" alt="" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black uppercase truncate">{m.name}</span>
                <span className="text-[8px] font-bold text-gray-400 uppercase">Mascot #{m.id}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {m.hasDna ? (
                  <span className="text-[7px] font-bold uppercase text-green-500 bg-green-50 px-1.5 py-0.5 rounded">DNA</span>
                ) : (
                  <span className="text-[7px] font-bold uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">No DNA</span>
                )}
                {value === m.id && <Zap size={10} className="text-yellow-400 fill-yellow-400" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MoodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-3 text-[10px] font-black uppercase tracking-widest border border-gray-200 outline-none bg-white cursor-pointer appearance-none pr-8 rounded-sm hover:border-black transition-all">
        {MOODS.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

export function AtmosphereSelect({
  value, onChange, isCustom, onCustomChange,
}: {
  value: string;
  onChange: (v: string) => void;
  isCustom: boolean;
  onCustomChange: (custom: boolean) => void;
}) {
  if (isCustom) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Custom atmosphere..."
          maxLength={100}
          className="w-full px-3 py-3 text-[10px] font-black uppercase tracking-widest border border-gray-200 outline-none bg-white rounded-sm hover:border-black transition-all"
        />
        <button
          onClick={() => { onCustomChange(false); onChange(ATMOSPHERE_PRESETS[0]); }}
          className="shrink-0 p-2 text-gray-400 hover:text-black"
          title="Back to presets"
        >
          <X size={14} />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <select
        value={ATMOSPHERE_PRESETS.includes(value) ? value : ""}
        onChange={e => {
          if (e.target.value === "__custom__") {
            onCustomChange(true);
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
        className="w-full px-3 py-3 text-[10px] font-black uppercase tracking-widest border border-gray-200 outline-none bg-white cursor-pointer appearance-none pr-8 rounded-sm hover:border-black transition-all"
      >
        {ATMOSPHERE_PRESETS.map(a => <option key={a} value={a}>{a}</option>)}
        <option value="__custom__">Custom...</option>
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

export function ForgeStatusFooter({
  step, hasDna, noDnaMessage,
}: {
  step: string;
  hasDna: boolean;
  noDnaMessage: string;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      {step !== "idle" ? (
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-black">
          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" /> Forge: {step}...
        </div>
      ) : !hasDna ? (
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-amber-600">
          <AlertCircle size={12} /> {noDnaMessage}
        </div>
      ) : <div />}
      <div className="flex items-center gap-3">
        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-300">Banner costs 10 $HASH credits</span>
        <Link href="/mascots" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-black">
          <Settings2 size={12} /> Registry
        </Link>
      </div>
    </div>
  );
}

export function EditorToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const items: ({ icon: typeof Bold; cmd: string; val?: string; tip: string } | { divider: true })[] = [
    { icon: Bold, cmd: "bold", tip: "Bold" },
    { icon: Italic, cmd: "italic", tip: "Italic" },
    { icon: UnderlineIcon, cmd: "underline", tip: "Underline" },
    { divider: true },
    { icon: Heading2, cmd: "formatBlock", val: "H2", tip: "Heading" },
    { icon: Quote, cmd: "formatBlock", val: "BLOCKQUOTE", tip: "Quote" },
    { divider: true },
    { icon: List, cmd: "insertUnorderedList", tip: "Bullet List" },
    { icon: ListOrdered, cmd: "insertOrderedList", tip: "Numbered List" },
    { divider: true },
    { icon: LinkIcon, cmd: "createLink", tip: "Insert Link" },
  ];

  return (
    <div className="border-b border-gray-100 pb-4 flex items-center gap-1 overflow-x-auto">
      {items.map((item, i) => {
        if ("divider" in item && item.divider) {
          return <div key={i} className="w-px h-5 bg-gray-200 mx-1 shrink-0" />;
        }
        const btn = item as { icon: typeof Bold; cmd: string; val?: string; tip: string };
        return (
          <button key={i}
            title={btn.tip}
            onMouseDown={e => {
              e.preventDefault();
              editorRef.current?.focus();
              if (btn.cmd === "createLink") {
                const url = prompt("Enter URL:");
                if (url) document.execCommand("createLink", false, url);
              } else if (btn.val) {
                document.execCommand(btn.cmd, false, btn.val);
              } else {
                document.execCommand(btn.cmd, false, undefined);
              }
            }}
            className="p-2 text-gray-300 hover:text-black hover:bg-gray-50 rounded-sm transition-all shrink-0">
            <btn.icon size={16} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}

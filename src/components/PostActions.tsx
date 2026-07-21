"use client";

import { Share2, Bookmark, Twitter, Send, Copy, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface PostActionsProps {
  title: string;
  id: string;
  content?: string;
  cmcUsername?: string;
}

const hashtags = "Web3,Base,Hash";
const formattedHashtags = `#${hashtags.split(',').join(' #')}`;

export default function PostActions({ title, id, content = "", cmcUsername }: PostActionsProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const decodeHtml = (html: string) => {
    if (typeof document === "undefined") return html;
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const cleanContent = decodeHtml(content.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim());
  const shortDescription = cleanContent.length > 80
    ? cleanContent.slice(0, 80).trim() + "..."
    : cleanContent;

  const getShareUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/article/${id}`;
  };

  const shareLinks = [
    {
      name: "Twitter",
      icon: <Twitter size={18} />,
      getUrl: () => {
        const url = getShareUrl();
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}\n\n${shortDescription}\n\nContinue reading: ${url}\n\n`)}&hashtags=${hashtags}`;
      },
      color: "hover:bg-sky-500"
    },
    {
      name: "Telegram",
      icon: <Send size={18} />,
      getUrl: () => {
        const url = getShareUrl();
        return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${title}\n\n${shortDescription}\n\n${formattedHashtags}`)}`;
      },
      color: "hover:bg-blue-500"
    }
  ];

  const buildCmcPostText = () => {
    const url = getShareUrl();
    return [
      title,
      "",
      shortDescription,
      "",
      `${formattedHashtags} #Crypto #Bitcoin`,
      "",
      `Read full article on Pager: ${url}`,
    ].join("\n");
  };

  const handleCmcShare = async () => {
    const text = buildCmcPostText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setToast("Text copied! Paste it (Ctrl+V) in your CMC post");
    setTimeout(() => setCopied(false), 3000);
    setTimeout(() => setToast(null), 4000);

    const cmcUrl = cmcUsername
      ? `https://coinmarketcap.com/community/profile/${cmcUsername}`
      : "https://coinmarketcap.com/community/";
    window.open(cmcUrl, "_blank", "noopener,noreferrer");
    setShowShareModal(false);
  };

  return (
    <div className="flex items-center gap-4 relative">
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-black text-white px-6 py-3 rounded-sm shadow-2xl border-l-4 border-yellow-500 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle size={16} className="text-yellow-500 shrink-0" />
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}
      <button className="text-[var(--text-secondary)] hover:text-black transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" title="Bookmark (Coming soon)"><Bookmark size={18} /></button>
      <div className="relative">
        <button onClick={() => setShowShareModal(!showShareModal)} className="text-[var(--text-secondary)] hover:text-black transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"><Share2 size={18} /><span>Share</span></button>
        {showShareModal && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setShowShareModal(false)} />
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-56 bg-white border border-[var(--border-soft)] shadow-xl z-[101] p-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col gap-1">
                {shareLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.getUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors hover:text-white rounded-sm ${link.color}`}
                    onClick={() => setShowShareModal(false)}
                  >
                    {link.icon}
                    <span>{link.name}</span>
                  </a>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleCmcShare}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-sm ${copied ? "bg-green-500 text-white" : "hover:bg-yellow-500 hover:text-white"}`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? "Copied!" : "CoinMarketCap"}</span>
                </button>
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-[var(--border-soft)] rotate-45 shadow-sm" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { Share2, Twitter, Send, Copy, Check, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

interface PostActionsProps {
  title: string;
  id: string;
  content?: string;
  cmcUsername?: string;
  authorAddress?: string;
}

const fallbackHashtags = "Web3,Base,Hash";
const fallbackFormatted = `#${fallbackHashtags.split(',').join(' #')}`;

export default function PostActions({ title, id, content = "", cmcUsername, authorAddress }: PostActionsProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [generatedTweet, setGeneratedTweet] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tweetError, setTweetError] = useState(false);

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

  const generateTweet = async () => {
    if (generatedTweet) return generatedTweet;
    setIsGenerating(true);
    setTweetError(false);
    try {
      const res = await fetch("/api/ai/tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, userAddress: authorAddress, articleUrl: getShareUrl() }),
      });
      if (!res.ok) {
        let errMsg = "Tweet generation failed";
        try { const err = await res.json(); errMsg = err.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      setGeneratedTweet(data.tweet);
      return data.tweet;
    } catch {
      setTweetError(true);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const getFallbackTweet = () => {
    return `${title}\n\n${shortDescription}\n\nContinue reading: ${getShareUrl()}\n\n${fallbackFormatted}`;
  };

  const shareLinks = [
    {
      name: "Twitter",
      icon: isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Twitter size={18} />,
      getUrl: async () => {
        const url = getShareUrl();
        const tweet = await generateTweet();
        const text = tweet || getFallbackTweet();
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      },
      color: "hover:bg-sky-500",
      needsAsync: true,
    },
    {
      name: "Telegram",
      icon: <Send size={18} />,
      getUrl: () => {
        const url = getShareUrl();
        return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${title}\n\n${shortDescription}\n\n${fallbackFormatted}`)}`;
      },
      color: "hover:bg-blue-500",
      needsAsync: false,
    }
  ];

  const buildCmcPostText = () => {
    const url = getShareUrl();
    const text = generatedTweet || `${title}\n\n${shortDescription}`;
    return `${text}\n\nRead full article on Pager:\n${url}`;
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

  const handleShareClick = async (link: typeof shareLinks[0]) => {
    const url = await link.getUrl();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
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
      <div className="relative">
        <button onClick={() => setShowShareModal(!showShareModal)} className="text-[var(--text-secondary)] hover:text-black transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"><Share2 size={18} /><span>Share</span></button>
        {showShareModal && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setShowShareModal(false)} />
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-64 bg-white border border-[var(--border-soft)] shadow-xl z-[101] p-2 animate-in fade-in slide-in-from-bottom-2">
              {/* Tweet preview */}
              {generatedTweet && (
                <div className="px-3 py-2 mb-1 bg-sky-50 rounded-sm border border-sky-100">
                  <p className="text-[9px] font-bold text-sky-600 uppercase tracking-widest mb-1">Generated Tweet</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{generatedTweet}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[9px] font-bold ${generatedTweet.length > 250 ? "text-red-500" : "text-green-600"}`}>
                      {generatedTweet.length}/250
                    </span>
                    <button
                      onClick={() => setGeneratedTweet(null)}
                      className="text-[9px] font-bold text-sky-500 hover:text-sky-700 flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Regenerate
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                {shareLinks.map((link) => (
                  <button
                    key={link.name}
                    onClick={() => handleShareClick(link)}
                    disabled={isGenerating && link.needsAsync}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors hover:text-white rounded-sm ${link.color} disabled:opacity-50`}
                  >
                    {link.icon}
                    <span>{link.name}</span>
                    {link.needsAsync && !generatedTweet && !isGenerating && (
                      <span className="text-[8px] font-bold text-gray-400 ml-auto">AI</span>
                    )}
                  </button>
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

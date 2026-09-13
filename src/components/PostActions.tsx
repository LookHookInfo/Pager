"use client";

import { Share2, Twitter, Send, Copy, Check, AlertCircle, Loader2, RefreshCw, Facebook, Instagram } from "lucide-react";
import { useState } from "react";

interface PostActionsProps {
  title: string;
  id: string;
  content?: string;
  imageUrl?: string;
  cmcUsername?: string;
  authorAddress?: string;
}

interface ShareLink {
  name: string;
  icon: React.ReactNode;
  getUrl: () => Promise<string> | string;
  needsAsync?: boolean;
}

const STOPWORDS = new Set([
  "with", "from", "that", "this", "have", "being", "their", "would", "about", "which",
  "there", "after", "before", "those", "where", "while", "been", "have", "more", "when",
  "than", "into", "over", "under", "until", "just", "also", "does", "will", "what",
  "these", "only", "your", "here", "they", "you", "out", "per", "via", "its", "was",
  "his", "her", "for", "and", "the", "are", "but", "not", "all", "any", "can", "had",
  "has", "him", "how", "our", "own", "may", "off", "old", "see", "she", "too", "use",
  "who", "now", "new", "say", "get", "one", "two", "day", "year", "crypto", "news",
  "price", "market", "token", "blockchain", "base", "web3",
]);

function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Хештеги по теме статьи — fallback на клиенте, когда AI-генерация твита
 * недоступна. Раньше подставлялся глухой набор #Web3 #Base #Hash; теперь теги
 * строятся из слов заголовка/текста. Тикеры ($HASH и т.п.) вырезаются целиком
 * и в теги не попадают. Упоминания (@mentions) генерирует серверный /api/ai/tweet.
 */
function buildTopicHashtags(title: string, content: string): string[] {
  const text = `${title} ${content}`.replace(/\$[A-Za-z0-9._]{1,24}/g, " ").toLowerCase();
  const picks: string[] = [];

  const words = text.match(/[a-zа-яё0-9]+/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 4 || /^\d+$/.test(w)) continue;
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 6);

  for (const [w] of ranked) {
    const h = `#${capitalize(w.replace(/[^a-zа-яё0-9]/g, ""))}`;
    if (h === "#" || picks.includes(h)) continue;
    picks.push(h);
    if (picks.length >= 4) break;
  }

  if (picks.length === 0) picks.push("#Crypto");
  if (picks.length < 3 && !picks.includes("#Web3")) picks.push("#Web3");
  return picks.slice(0, 5);
}

export default function PostActions({ title, id, content = "", imageUrl, cmcUsername, authorAddress }: PostActionsProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [generatedTweet, setGeneratedTweet] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const topicTagsLine = buildTopicHashtags(title, cleanContent).join(" ");

  const getShareUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/article/${id}`;
  };

  const generateTweet = async () => {
    if (generatedTweet) return generatedTweet;
    setIsGenerating(true);
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
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const getFallbackTweet = () => {
    return `${title}\n\n${shortDescription}\n\nContinue reading: ${getShareUrl()}\n\n${topicTagsLine}`;
  };

  const copyTextToClipboard = async (text: string) => {
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
  };

  const toJpegBlob = async (url: string): Promise<Blob> => {
    const res = await fetch(url);
    const blob = await res.blob();
    if (blob.type === "image/jpeg" || blob.type === "image/png") return blob;
    if (typeof createImageBitmap !== "function") return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    return jpeg || blob;
  };

  const downloadBlob = (blob: Blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pager-banner.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const handleInstagramShare = async () => {
    const url = getShareUrl();

    // On real mobile the native share sheet hands the banner straight to the
    // Instagram app. On desktop (where navigator.share is also available in Chrome)
    // we open instagram.com synchronously at click-time so popup blockers can't
    // kill the tab after the async AI/upload work below.
    const isNativeShare =
      typeof navigator.canShare === "function" &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

    const instaWindow = isNativeShare ? null : window.open("https://www.instagram.com/", "_blank");

    const tweet = generatedTweet || (await generateTweet());
    const body = (tweet || `${shortDescription}\n\n${topicTagsLine}`)
      .replace(/\n\nContinue reading:[^\n]*/g, "")
      .trim();
    const caption = `${title}\n\n${body}\n\nRead full article on Pager:\n${url}`;
    await copyTextToClipboard(caption);

    let file: File | null = null;
    if (imageUrl) {
      try {
        const jpeg = await toJpegBlob(imageUrl);
        file = new File([jpeg], "pager-banner.jpg", { type: "image/jpeg" });
      } catch {}
    }

    // 1) Mobile: native share sheet with the banner file (Instagram app picks it up)
    if (isNativeShare && file) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: caption, title });
          setShowShareModal(false);
          return;
        }
      } catch {}
    }

    // 2) Desktop/fallback: Instagram tab is already open, just download the banner
    if (file) {
      try { downloadBlob(file); } catch {}
    }
    setToast(
      instaWindow
        ? file
          ? "Caption copied with hashtags, banner downloaded. Post it on Instagram."
          : "Caption copied with hashtags. Add your banner image and post it on Instagram."
        : "Popup blocked — allow popups for this site, or open instagram.com manually. Caption copied with hashtags.",
    );
    setTimeout(() => setToast(null), 7000);
    setShowShareModal(false);
  };

  const handleFacebookShare = async () => {
    const url = getShareUrl();
    const tweet = generatedTweet || (await generateTweet());
    const text = (tweet || `${title}\n\n${shortDescription}\n\n${topicTagsLine}`)
      .replace(/\n\nContinue reading:[^\n]*/g, "")
      .trim();

    await copyTextToClipboard(text);

    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
    setToast("Post text copied with mentions & hashtags. Paste it (Ctrl+V) into the post field, then set the audience to Public.");
    setTimeout(() => setToast(null), 7000);
    setShowShareModal(false);
  };

  const shareLinks: ShareLink[] = [
    {
      name: "Twitter",
      icon: isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Twitter size={18} />,
      getUrl: async () => {
        const tweet = await generateTweet();
        const text = tweet || getFallbackTweet();
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      },
      needsAsync: true,
    },
    {
      name: "Telegram",
      icon: <Send size={18} />,
      getUrl: () => {
        const url = getShareUrl();
        return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${title}\n\n${shortDescription}\n\n${topicTagsLine}`)}`;
      },
      needsAsync: false,
    },
    {
      name: "Facebook",
      icon: isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Facebook size={18} />,
      getUrl: () => {
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
      },
      needsAsync: true,
    },
    {
      name: "Instagram",
      icon: isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Instagram size={18} />,
      getUrl: () => "https://www.instagram.com/",
      needsAsync: true,
    },
  ];

  const buildCmcPostText = () => {
    const url = getShareUrl();
    // The AI tweet already carries its own 5 on-topic hashtags and an inline
    // "Continue reading" link — reuse them as-is, strip the link, and append a
    // single Pager URL. Without the AI tweet, use title + description + the
    // client-built topic hashtags. Either way: ONE link, 3-5 on-topic tags.
    const tweet = (generatedTweet || "")
      .replace(/\n\nContinue reading:[^\n]*/g, "")
      .trim();
    const body = tweet || `${title}\n\n${shortDescription}`;
    const tags = tweet ? "" : `\n\n${topicTagsLine}`;
    return `${body}${tags}\n\nRead full article on Pager:\n${url}`;
  };

  const handleCmcShare = async () => {
    const text = buildCmcPostText();
    await copyTextToClipboard(text);
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

  const handleShareClick = async (link: ShareLink) => {
    if (link.name === "Instagram") {
      await handleInstagramShare();
      return;
    }
    if (link.name === "Facebook") {
      await handleFacebookShare();
      return;
    }
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
        <button onClick={() => setShowShareModal(!showShareModal)} className="text-[var(--text-dim)] hover:text-black transition-colors flex items-center gap-1.5 text-sm"><Share2 size={16} /><span>Share</span></button>
        {showShareModal && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setShowShareModal(false)} />
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-64 bg-white border border-[var(--border)] rounded-lg shadow-xl z-[101] p-2 animate-in fade-in slide-in-from-bottom-2">
              {/* Tweet preview */}
              {generatedTweet && (
                <div className="px-3 py-2 mb-1 bg-gray-50 rounded-md border border-[var(--border)]">
                  <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-1">Generated Tweet</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{generatedTweet}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[10px] font-semibold ${generatedTweet.length > 250 ? "text-red-500" : "text-green-600"}`}>
                      {generatedTweet.length}/250
                    </span>
                    <button
                      onClick={() => setGeneratedTweet(null)}
                      className="text-[10px] font-semibold text-[var(--text-dim)] hover:text-black flex items-center gap-1"
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
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 rounded-md disabled:opacity-50`}
                  >
                    {link.icon}
                    <span>{link.name}</span>
                    {link.needsAsync && !generatedTweet && !isGenerating && (
                      <span className="text-[8px] font-bold text-gray-400 ml-auto">AI</span>
                    )}
                  </button>
                ))}
                <div className="border-t border-[var(--border)] my-1" />
                <button
                  onClick={handleCmcShare}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-md ${copied ? "bg-green-500 text-white" : "hover:bg-gray-50"}`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? "Copied!" : "CoinMarketCap"}</span>
                </button>
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-[var(--border)] rotate-45 shadow-sm" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
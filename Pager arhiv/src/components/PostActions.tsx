"use client";

import { Share2, Bookmark, Twitter, Send } from "lucide-react";
import { useState, useEffect } from "react";

interface PostActionsProps {
  title: string;
  id: string;
  content?: string;
}

export default function PostActions({ title, id, content = "" }: PostActionsProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/article/${id}`);
    }
  }, [id]);

  const hashtags = "Web3,Base,Hash";
  const formattedHashtags = `#${hashtags.split(',').join(' #')}`;
  
  // Очистка и обрезка контента до 80 символов
  const cleanContent = content.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  const shortDescription = cleanContent.length > 80 
    ? cleanContent.slice(0, 80).trim() + "..." 
    : cleanContent;

  const shareLinks = [
    {
      name: "Twitter",
      icon: <Twitter size={18} />,
      // Твиттер: Заголовок -> Описание -> Ссылка -> (Отступ через \n\n) -> Хештеги (через параметр)
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}\n\n${shortDescription}\n\nContinue reading: ${shareUrl}\n\n`)}&hashtags=${hashtags}`,
      color: "hover:bg-sky-500"
    },
    {
      name: "Telegram",
      icon: <Send size={18} />,
      // Телеграм: Чтобы ссылка не дублировалась в начале, мы НЕ передаем параметр 'url',
      // а вставляем всё сообщение целиком в параметр 'text' в нужном порядке.
      url: `https://t.me/share/url?text=${encodeURIComponent(`${title}\n\n${shortDescription}\n\nContinue reading: ${shareUrl}\n\n${formattedHashtags}`)}`,
      color: "hover:bg-blue-500"
    }
  ];

  return (
    <div className="flex items-center gap-4 relative">
      <button className="text-[var(--text-secondary)] hover:text-black transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" title="Bookmark (Coming soon)"><Bookmark size={18} /></button>
      <div className="relative">
        <button onClick={() => setShowShareModal(!showShareModal)} className="text-[var(--text-secondary)] hover:text-black transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"><Share2 size={18} /><span>Share</span></button>
        {showShareModal && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setShowShareModal(false)} />
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 bg-white border border-[var(--border-soft)] shadow-xl z-[101] p-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col gap-1">
                {shareLinks.map((link) => (
                  <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors hover:text-white rounded-sm ${link.color}`} onClick={() => setShowShareModal(false)}>{link.icon}<span>{link.name}</span></a>
                ))}
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-[var(--border-soft)] rotate-45 shadow-sm" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

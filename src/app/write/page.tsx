"use client";

import { useState, useRef } from "react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Send, X, AlertCircle, CheckCircle2, Bold, Italic, Link as LinkIcon, Type } from "lucide-react";
import Link from "next/link";
import { client, HASH_TOKEN_ADDRESS } from "@/lib/web3";

const PROJECT_WALLET = "0x39adfb3eb6ff7f56bd5c09c62b4ab1d61997193a";
const POST_PRICE = "10";

export default function WritePage() {
  const account = useActiveAccount();
  const router = useRouter();
  const { mutate: sendTransaction, isPending: isPaying } = useSendTransaction();
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "paying" | "publishing" | "success" | "error">("idle");

  const { data: balance } = useWalletBalance({
    client,
    chain: base,
    address: account?.address,
    tokenAddress: HASH_TOKEN_ADDRESS,
  });

  const getDomain = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    } catch (e) {
      return url;
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    let text = e.clipboardData.getData("text/plain");

    // 1. Магия Markdown: превращаем **текст** в <b>текст</b>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');

    // 2. Магия Ссылок: превращаем URL в красивые ссылки (только домен)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, (url) => {
      const domain = getDomain(url);
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-black underline font-bold">${domain}</a>`;
    });

    // Вставляем очищенный и отформатированный HTML
    document.execCommand("insertHTML", false, text.replace(/\n/g, '<br>'));
  };

  const execAction = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const addLink = () => {
    const url = prompt("Enter the URL:");
    if (url) {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || getDomain(url);
      const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-black underline font-bold">${selectedText}</a>`;
      document.execCommand("insertHTML", false, linkHtml);
    }
  };

  const handlePublish = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!account) return alert("Please connect wallet");
    if (!title || !content || content === "<br>") return alert("Title and Content are required");
    
    const userBalance = parseFloat(balance?.displayValue || "0");
    if (userBalance < 10) {
      return alert("Insufficient $HASH balance. You need 10 $HASH to publish.");
    }

    try {
      setStatus("paying");
      const contract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 value)",
        params: [PROJECT_WALLET, BigInt(toWei(POST_PRICE))],
      });

      sendTransaction(transaction, {
        onSuccess: async () => {
          setStatus("publishing");
          const newArticle = {
            id: Date.now().toString(),
            title,
            content, // Теперь здесь HTML
            image_url: imageUrl,
            author_address: account.address.toLowerCase(),
            lang: "ru",
            likes: 0,
            created_at: new Date().toISOString()
          };

          const { error } = await supabase.from('articles').insert([newArticle]);

          if (error) { setStatus("error"); } 
          else {
            setStatus("success");
            setTimeout(() => router.push("/"), 2000);
          }
        },
        onError: () => setStatus("error")
      });
    } catch (e) { setStatus("error"); }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-main)]">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Sign in to write</h1>
          <Link href="/" className="btn-primary inline-block">Back to Feed</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-[var(--border-soft)] h-16 flex items-center justify-between px-6 md:px-12 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-black uppercase tracking-tighter">Pager</Link>
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest border-l border-gray-200 pl-4 hidden md:block">
            New Story
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[9px] text-gray-400 uppercase font-bold">Balance</span>
            <span className="text-xs font-bold">{Math.floor(parseFloat(balance?.displayValue || "0"))} $HASH</span>
          </div>
          <button 
            onClick={handlePublish}
            disabled={status !== "idle" || !title}
            className="btn-primary rounded-none px-6 py-2 disabled:opacity-50 flex items-center gap-2"
          >
            {status === "paying" ? "Paying..." : 
             status === "publishing" ? "Publishing..." : 
             status === "success" ? "Published!" : "Publish"}
            <Send size={14} />
          </button>
        </div>
      </nav>

      {/* Панель инструментов (Toolbar) */}
      <div className="sticky top-16 bg-white/80 backdrop-blur-md border-b border-[var(--border-soft)] z-40 py-2">
        <div className="max-w-3xl mx-auto px-6 flex items-center gap-4 text-[var(--text-secondary)]">
          <button onClick={() => execAction('bold')} className="p-2 hover:bg-gray-100 rounded-sm hover:text-black transition-colors" title="Bold">
            <Bold size={18} />
          </button>
          <button onClick={() => execAction('italic')} className="p-2 hover:bg-gray-100 rounded-sm hover:text-black transition-colors" title="Italic">
            <Italic size={18} />
          </button>
          <button onClick={addLink} className="p-2 hover:bg-gray-100 rounded-sm hover:text-black transition-colors" title="Insert Link">
            <LinkIcon size={18} />
          </button>
          <div className="h-4 w-[1px] bg-gray-200 mx-2" />
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-300">
            <Type size={14} /> Rich Editor Active
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12 pb-32">
        {status === "error" && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-sm flex items-center gap-3 text-sm">
            <AlertCircle size={18} />
            Something went wrong. Please check your balance or try again.
            <button onClick={() => setStatus("idle")} className="ml-auto underline">Try again</button>
          </div>
        )}

        {status === "success" && (
          <div className="mb-8 p-4 bg-green-50 border border-green-100 text-green-700 rounded-sm flex items-center gap-3 text-sm">
            <CheckCircle2 size={18} />
            Story published successfully!
          </div>
        )}

        <div className="space-y-8">
          <input 
            type="text"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-4xl md:text-6xl typography-title border-none focus:outline-none placeholder:text-gray-100"
          />

          <div className="flex items-center gap-4 border-y border-gray-50 py-4">
            <div className="flex items-center gap-2 text-gray-400 hover:text-black cursor-pointer transition-colors relative group">
              <ImageIcon size={20} />
              <input 
                type="text" 
                placeholder="Paste Image URL"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="text-xs font-medium border-none focus:outline-none bg-transparent w-40 md:w-64"
              />
            </div>
            {imageUrl && (
              <button onClick={() => setImageUrl("")} className="text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            )}
          </div>

          {imageUrl && (
            <div className="aspect-[21/9] bg-gray-50 overflow-hidden border border-gray-100 rounded-sm shadow-sm">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Визуальный редактор */}
          <div 
            ref={editorRef}
            contentEditable
            onPaste={handlePaste}
            data-placeholder="Tell your story..."
            className="w-full min-h-[500px] text-xl typography-body outline-none prose prose-stone max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-200 empty:before:pointer-events-none leading-[1.8]"
          />
        </div>
      </div>

      {status === "paying" && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-xl font-bold">Confirming Transaction</h2>
            <p className="text-gray-500">Confirm the {POST_PRICE} $HASH transfer in your wallet.</p>
          </div>
        </div>
      )}
    </main>
  );
}

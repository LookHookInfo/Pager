"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getContract, prepareContractCall, toWei, createThirdwebClient } from "thirdweb";
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Image as ImageIcon, Send, X, AlertCircle, 
  Bold, Italic, Link as LinkIcon, Loader2, Upload 
} from "lucide-react";
import Link from "next/link";
import { client, HASH_TOKEN_ADDRESS } from "@/lib/web3";
import imageCompression from "browser-image-compression";
import { upload, resolveScheme } from "thirdweb/storage";

// --- Constants ---
const PROJECT_WALLET = "0x39adfb3eb6ff7f56bd5c09c62b4ab1d61997193a";
const POST_PRICE = "10";
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.2,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
};

interface ToolbarPos {
  top: number;
  left: number;
  visible: boolean;
}

export default function WritePage() {
  const account = useActiveAccount();
  const router = useRouter();
  const { mutate: sendTransaction } = useSendTransaction();
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [mood, setMood] = useState("sarcastic");
  const [character, setCharacter] = useState<"ghoul" | "nana">("ghoul");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "publishing" | "success" | "error">("idle");
  const [profile, setProfile] = useState<any>(null);

  const moods = [
    { id: "sarcastic", label: "Sarcastic", icon: "🎭" },
    { id: "bullish", label: "Bullish", icon: "🚀" },
    { id: "bearish", label: "Bearish", icon: "📉" },
    { id: "humorous", label: "Humorous", icon: "😆" },
    { id: "negative", label: "Negative", icon: "💀" },
  ];

  const [processingStep, setProcessingStep] = useState<"idle" | "scraping" | "rewriting" | "persisting" | "done">("idle");

  // --- Persistence Logic ---
  const persistAiImage = async (url: string) => {
    if (!url || url.startsWith('https://gateway.ipn.io') || url.includes('supabase.co')) return url;
    
    try {
      setProcessingStep("persisting");
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], "ai-banner.png", { type: "image/png" });

      const clientId = profile?.thirdweb_client_id;
      if (clientId) {
        // Premium: IPFS
        const customClient = createThirdwebClient({ clientId });
        const uri = await upload({ client: customClient, files: [file] });
        return resolveScheme({ client: customClient, uri });
      } else {
        // Standard: Supabase
        const compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);
        const fileToUpload = new File([compressedBlob], `ai-${Date.now()}.png`, { type: "image/png" });
        const { data, error } = await supabase.storage.from('banners').upload(`banners/${fileToUpload.name}`, fileToUpload);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(data.path);
        return publicUrl;
      }
    } catch (e) {
      console.error("❌ [Persist] Failed to save AI image:", e);
      return url; // Return original if persistence fails
    }
  };

  const handleAiRewrite = async () => {
    if (!externalUrl) return alert("Paste a link first!");
    setIsAiProcessing(true);
    setProcessingStep("scraping");
    
    try {
      const scrapeRes = await fetch("/api/ai/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: externalUrl })
      });
      const scrapeData = await scrapeRes.json();

      setProcessingStep("rewriting");
      const processRes = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: scrapeData.textContent,
          title: scrapeData.title,
          mood,
          character,
          userApiKey: profile?.ai_api_key
        })
      });
      const data = await processRes.json();
      
      setTitle(data.title);
      if (editorRef.current) editorRef.current.innerHTML = data.content;

      // Auto-Persist Image
      if (data.image_url) {
        const permanentUrl = await persistAiImage(data.image_url);
        setImageUrl(permanentUrl);
      }
      
      setProcessingStep("done");
      setTimeout(() => setProcessingStep("idle"), 2000);
    } catch (err: any) {
      alert(err.message);
      setProcessingStep("idle");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const [toolbarPos, setToolbarPos] = useState<ToolbarPos>({ top: 0, left: 0, visible: false });

  const fetchProfile = useCallback(async () => {
    if (!account?.address) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('thirdweb_client_id, ai_api_key')
        .eq('address', account.address.toLowerCase())
        .maybeSingle();
      if (data) setProfile(data);
    } catch (err) {
      console.error("❌ [WritePage] Profile fetch error:", err);
    }
  }, [account?.address]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) {
        setToolbarPos(prev => ({ ...prev, visible: false }));
        return;
      }
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbarPos({ top: rect.top + window.scrollY - 50, left: rect.left + window.scrollX + rect.width / 2, visible: true });
    };
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, []);

  const { data: balance } = useWalletBalance({ client, chain: base, address: account?.address, tokenAddress: HASH_TOKEN_ADDRESS });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const clientId = profile?.thirdweb_client_id;
      if (clientId) {
        const customClient = createThirdwebClient({ clientId });
        const uri = await upload({ client: customClient, files: [file] });
        setImageUrl(resolveScheme({ client: customClient, uri }));
      } else {
        const compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);
        const fileToUpload = new File([compressedBlob], `${Date.now()}-${file.name}`, { type: file.type });
        const { data, error } = await supabase.storage.from('banners').upload(`banners/${fileToUpload.name}`, fileToUpload);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(data.path);
        setImageUrl(publicUrl);
      }
    } catch (error: any) {
      alert(error.message || "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePublish = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!account) return alert("Connect wallet");
    if (!title || !content || content === "<br>") return alert("Title and Content required");
    const currentBalance = parseFloat(balance?.displayValue || "0");
    if (currentBalance < parseFloat(POST_PRICE)) return alert(`Insufficient $HASH. Need ${POST_PRICE}.`);

    setStatus("paying");
    try {
        const contract = getContract({ client, chain: base, address: HASH_TOKEN_ADDRESS });
        const transaction = prepareContractCall({
          contract,
          method: "function transfer(address to, uint256 value)",
          params: [PROJECT_WALLET, BigInt(toWei(POST_PRICE))],
        });

        sendTransaction(transaction, {
          onSuccess: async () => {
            setStatus("publishing");
            try {
              const res = await fetch("/api/article/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content, image_url: imageUrl || null, author_address: account.address.toLowerCase() })
              });
              if (!res.ok) throw new Error("Failed to create article");
              setStatus("success");
              setTimeout(() => router.push("/"), 1500);
            } catch (err: any) { setStatus("error"); }
          },
          onError: () => { setStatus("error"); }
        });
    } catch (err) { setStatus("error"); }
  };

  const execAction = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const addLink = () => {
    const url = prompt("URL:");
    if (!url) return;
    const selection = window.getSelection();
    const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
    const linkHtml = `<a href="${url}" target="_blank" rel="noopener" class="text-black underline font-bold">${selection?.toString() || domain}</a>`;
    document.execCommand("insertHTML", false, linkHtml);
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Sign in to write</h1>
          <Link href="/" className="btn-primary inline-block">Back to Feed</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white relative pb-32">
      <nav className="border-b border-[var(--border-soft)] h-16 flex items-center justify-between px-6 md:px-12 sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-black uppercase tracking-tighter">Pager</Link>
          <div className="h-4 w-[1px] bg-gray-200 hidden md:block" />
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest hidden md:block">Draft</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end mr-4">
            <span className="text-[9px] text-gray-400 uppercase font-bold">Balance</span>
            <span className="text-xs font-bold">{Math.floor(parseFloat(balance?.displayValue || "0"))} $HASH</span>
          </div>
          <button onClick={handlePublish} disabled={status !== "idle" || !title} className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50">
            {status === "idle" ? <>Publish <Send size={14} /></> : <Loader2 size={14} className="animate-spin" />}
          </button>
        </div>
      </nav>

      {toolbarPos.visible && (
        <div className="fixed z-[100] flex items-center bg-black text-white rounded-full px-2 py-1 shadow-xl animate-in fade-in zoom-in-95 duration-200" style={{ top: toolbarPos.top, left: toolbarPos.left, transform: "translateX(-50%)" }}>
          <ToolbarButton icon={<Bold size={16} />} onClick={() => execAction('bold')} title="Bold" />
          <ToolbarButton icon={<Italic size={16} />} onClick={() => execAction('italic')} title="Italic" />
          <ToolbarButton icon={<LinkIcon size={16} />} onClick={addLink} title="Link" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 pt-12 space-y-8">
        {status === "error" && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-sm flex items-center gap-3 text-sm">
            <AlertCircle size={18} /> Error publishing.
          </div>
        )}

        <div className="bg-gray-50 p-6 rounded-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
            AI Production Protocol
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input type="text" placeholder="Paste article URL..." value={externalUrl} onChange={e => setExternalUrl(e.target.value)} className="flex-[3] px-4 py-3 text-sm border border-gray-200 focus:border-black outline-none bg-white transition-colors" />
            <select value={mood} onChange={e => setMood(e.target.value)} className="flex-1 px-3 py-3 text-sm border border-gray-200 outline-none bg-white cursor-pointer">
              {moods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
            </select>
            <select value={character} onChange={e => setCharacter(e.target.value as any)} disabled={!profile?.ai_api_key} className="flex-1 px-3 py-3 text-sm border border-gray-200 outline-none bg-white cursor-pointer disabled:opacity-50 disabled:bg-gray-100">
              <option value="ghoul">🤖 Ghoul</option>
              <option value="nana">🍌 Nana</option>
            </select>
            <button onClick={handleAiRewrite} disabled={isAiProcessing || !externalUrl} className="flex-1 bg-black text-white text-xs font-bold uppercase tracking-widest py-3 px-6 hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isAiProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{processingStep === "scraping" ? "Reading..." : processingStep === "rewriting" ? "Rewriting..." : "Saving..."}</span>
                </div>
              ) : "Magic Rewrite"}
            </button>
          </div>
          {processingStep !== "idle" && <div className="text-[10px] font-black uppercase tracking-tighter text-black animate-pulse">Status: {processingStep}</div>}
        </div>

        <input type="text" placeholder="Story Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full text-4xl md:text-6xl font-bold border-none focus:outline-none placeholder:text-gray-100" />

        <div className="border-y border-gray-50 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-3 text-gray-400 focus-within:text-black">
              <ImageIcon size={20} />
              <input type="text" placeholder={profile?.thirdweb_client_id ? "IPFS Persistence Active..." : "Local Persistence..."} value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full text-xs font-medium border-none focus:outline-none bg-transparent" />
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16} /> Upload</>}
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
          </div>
          {imageUrl && <div className="aspect-[21/9] bg-gray-50 overflow-hidden border border-gray-100 rounded-sm"><img src={imageUrl} alt="Preview" className="w-full h-full object-cover" /></div>}
        </div>

        <div ref={editorRef} contentEditable data-placeholder="Start your story here..." className="w-full min-h-[500px] text-xl outline-none prose prose-stone max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-200 empty:before:pointer-events-none leading-[1.8]" />
      </div>

      {status === "paying" && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-2xl font-black uppercase">Confirm Payment</h2>
            <p className="text-gray-500 font-medium">Authorize {POST_PRICE} $HASH transfer.</p>
          </div>
        </div>
      )}
    </main>
  );
}

function ToolbarButton({ icon, onClick, title }: { icon: React.ReactNode, onClick: () => void, title: string }) {
  return <button onClick={onClick} className="p-2 hover:bg-white/10 rounded-full transition-colors" title={title}>{icon}</button>;
}

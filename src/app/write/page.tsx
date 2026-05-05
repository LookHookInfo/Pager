"use client";

import { useState, useRef, useEffect } from "react";
import { getContract, prepareContractCall, toWei, createThirdwebClient } from "thirdweb";
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Image as ImageIcon, Send, X, AlertCircle, 
  Bold, Italic, Link as LinkIcon, Type, Loader2, Upload 
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

export default function WritePage() {
  const account = useActiveAccount();
  const router = useRouter();
  const { mutate: sendTransaction } = useSendTransaction();
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "publishing" | "success" | "error">("idle");
  const [profile, setProfile] = useState<any>(null);

  // --- Initialization: Fetch Profile from DB ---
  useEffect(() => {
    if (account?.address) {
      fetchProfile();
    }
  }, [account?.address]);

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('thirdweb_client_id')
      .eq('address', account?.address?.toLowerCase())
      .maybeSingle();
    
    if (data) setProfile(data);
  }

  const { data: balance } = useWalletBalance({
    client,
    chain: base,
    address: account?.address,
    tokenAddress: HASH_TOKEN_ADDRESS,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const clientId = profile?.thirdweb_client_id;

      if (clientId) {
        await handleIPFSUpload(file, clientId);
      } else {
        await uploadToSupabase(file);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(error.message || "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleIPFSUpload = async (file: File, clientId: string) => {
    try {
      const customClient = createThirdwebClient({ clientId });
      const uri = await upload({ client: customClient, files: [file] });
      setImageUrl(resolveScheme({ client: customClient, uri }));
    } catch (err: any) {
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        if (confirm("Your Thirdweb Client ID is unauthorized. Use Supabase instead?")) {
          await uploadToSupabase(file);
        }
      } else throw err;
    }
  };

  const uploadToSupabase = async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error("Only images are allowed for Supabase storage.");
    
    const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
    const fileName = `${Math.random().toString(36).slice(2)}-${Date.now()}.${file.name.split('.').pop()}`;
    const filePath = `banners/${fileName}`;

    const { error } = await supabase.storage.from('banners').upload(filePath, compressedFile);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);
    setImageUrl(publicUrl);
  };

  const handlePublish = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!account) return alert("Please connect wallet");
    if (!title || !content || content === "<br>") return alert("Title and Content are required");
    if (parseFloat(balance?.displayValue || "0") < 10) return alert("Insufficient $HASH balance.");

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
        const { error } = await supabase.from('articles').insert([{
          title, content, image_url: imageUrl, 
          author_address: account.address.toLowerCase(),
          lang: "ru", likes: 0, created_at: new Date().toISOString()
        }]);

        if (error) setStatus("error");
        else {
          setStatus("success");
          setTimeout(() => router.push("/"), 1500);
        }
      },
      onError: () => setStatus("error")
    });
  };

  const execAction = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const addLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      const selection = window.getSelection();
      const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
      const linkHtml = `<a href="${url}" target="_blank" rel="noopener" class="text-black underline font-bold">${selection?.toString() || domain}</a>`;
      document.execCommand("insertHTML", false, linkHtml);
    }
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
          
          <button 
            onClick={handlePublish}
            disabled={status !== "idle" || !title}
            className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50"
          >
            {status === "idle" ? <>Publish <Send size={14} /></> : <Loader2 size={14} className="animate-spin" />}
          </button>
        </div>
      </nav>

      <div className="sticky top-16 bg-white/80 backdrop-blur-md border-b border-[var(--border-soft)] z-40 py-2">
        <div className="max-w-3xl mx-auto px-6 flex items-center gap-2 text-[var(--text-secondary)]">
          <ToolbarButton icon={<Bold size={18} />} onClick={() => execAction('bold')} title="Bold" />
          <ToolbarButton icon={<Italic size={18} />} onClick={() => execAction('italic')} title="Italic" />
          <ToolbarButton icon={<LinkIcon size={18} />} onClick={addLink} title="Link" />
          <div className="h-4 w-[1px] bg-gray-200 mx-2" />
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-300">
            <Type size={14} /> Visual Editor
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12 space-y-8">
        {status === "error" && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-sm flex items-center gap-3 text-sm">
            <AlertCircle size={18} /> Error publishing. Please try again.
          </div>
        )}

        <input 
          type="text"
          placeholder="Story Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-4xl md:text-6xl font-bold border-none focus:outline-none placeholder:text-gray-100"
        />

        <div className="border-y border-gray-50 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-3 text-gray-400 focus-within:text-black">
              <ImageIcon size={20} />
              <input 
                type="text" 
                placeholder={profile?.thirdweb_client_id ? "IPFS Upload Active..." : "Standard Upload..."}
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="w-full text-xs font-medium border-none focus:outline-none bg-transparent"
              />
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <><Upload size={16} /> Upload</>}
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
            {imageUrl && <button onClick={() => setImageUrl("")} className="text-red-400"><X size={14} /></button>}
          </div>

          {imageUrl && (
            <div className="aspect-[21/9] bg-gray-50 overflow-hidden border border-gray-100 rounded-sm">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div 
          ref={editorRef}
          contentEditable
          data-placeholder="Start your story here..."
          className="w-full min-h-[500px] text-xl outline-none prose prose-stone max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-200 empty:before:pointer-events-none leading-[1.8]"
        />
      </div>

      {status === "paying" && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-2xl font-black uppercase">Confirm Payment</h2>
            <p className="text-gray-500 font-medium">Please authorize the {POST_PRICE} $HASH transfer.</p>
          </div>
        </div>
      )}
    </main>
  );
}

function ToolbarButton({ icon, onClick, title }: { icon: React.ReactNode, onClick: () => void, title: string }) {
  return (
    <button onClick={onClick} className="p-2 hover:bg-gray-100 rounded-sm hover:text-black transition-colors" title={title}>
      {icon}
    </button>
  );
}

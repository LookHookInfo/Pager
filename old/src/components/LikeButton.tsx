"use client";

import { useState, useRef, useEffect } from "react";
import { Heart, Send } from "lucide-react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { client, HASH_TOKEN_ADDRESS } from "@/lib/web3";

interface ClapParticle {
  id: number;
  x: string;
  y: string;
  rotation: string;
  scale: string;
  image: string;
}

export default function LikeButton({ 
  articleId, 
  initialLikes, 
  authorAddress 
}: { 
  articleId: string, 
  initialLikes: number,
  authorAddress?: string
}) {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  
  const [likes, setLikes] = useState(initialLikes);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [claps, setClaps] = useState<ClapParticle[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const clapIdRef = useRef(0);

  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  const handleLikeClick = () => {
    if (!account) {
      alert("Please connect your wallet to support authors.");
      return;
    }

    setPendingAmount(prev => prev + 1);
    
    // Генерируем "струю" из 4 иконок на один клик
    const particleCount = 4; 
    const newParticles: ClapParticle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const id = ++clapIdRef.current;
      
      // Направленная вверх струя (узкий угол от -15 до 15 градусов)
      const angle = (Math.random() * 30 - 15) * (Math.PI / 180);
      const distance = 80 + Math.random() * 100; // летим выше
      const x = Math.sin(angle) * distance;
      const y = -Math.cos(angle) * distance;

      // Случайный выбор между двумя иконками
      const tokenImage = Math.random() > 0.5 ? "/token.png" : "/token-black.png";

      newParticles.push({
        id,
        x: `${x}px`,
        y: `${y}px`,
        rotation: `${(Math.random() * 40 - 20)}deg`, // легкое вращение
        scale: (1.2 + Math.random() * 0.5).toFixed(2), // иконки крупнее
        image: tokenImage
      });

      // Удаляем частицу после завершения анимации (теперь 1.5 сек)
      setTimeout(() => {
        setClaps(prev => prev.filter(p => p.id !== id));
      }, 1500);
    }

    setClaps(prev => [...prev, ...newParticles]);
    setShowConfirm(true);
  };

  const confirmReward = async () => {
    if (!account || pendingAmount === 0) return;

    const targetAddress = authorAddress || HASH_TOKEN_ADDRESS;
    
    try {
      const contract = getContract({
        client,
        chain: base,
        address: HASH_TOKEN_ADDRESS,
      });

      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 value)",
        params: [targetAddress, BigInt(toWei(pendingAmount.toString()))],
      });

      sendTransaction(transaction, {
        onSuccess: async () => {
          const { data: currentArt } = await supabase.from('articles').select('likes').eq('id', articleId).single();
          const newLikesCount = (currentArt?.likes || 0) + pendingAmount;
          
          await supabase
            .from('articles')
            .update({ likes: newLikesCount })
            .eq('id', articleId);

          setLikes(newLikesCount);
          setPendingAmount(0);
          setShowConfirm(false);
        },
        onError: (error) => {
          console.error("Reward error:", error);
          alert("Error sending reward. Please check your $HASH balance.");
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex items-center gap-2">
        <button 
          onClick={handleLikeClick}
          disabled={isPending}
          className={`group flex items-center gap-1.5 transition-all ${pendingAmount > 0 ? 'text-black' : 'text-[var(--text-secondary)] hover:text-black'}`}
        >
          <div className="relative">
            <Heart 
              size={20} 
              strokeWidth={1.5}
              className={`${pendingAmount > 0 ? 'fill-black' : ''} transition-transform group-active:scale-125`} 
            />
            {claps.map(clap => (
              <div 
                key={clap.id} 
                className="absolute top-0 left-0 pointer-events-none z-[100] animate-clap"
                style={{
                  // @ts-ignore
                  '--x': clap.x,
                  '--y': clap.y,
                  '--r': clap.rotation,
                  '--s': clap.scale
                } as React.CSSProperties}
              >
                <img src={clap.image} className="w-6 h-6 object-contain drop-shadow-md" alt="" />
              </div>
            ))}
          </div>
          <span className="text-sm font-medium">{likes + pendingAmount}</span>
        </button>

        {pendingAmount > 0 && (
          <div className="text-[10px] font-bold text-black uppercase tracking-tighter">
            {pendingAmount} $HASH pending
          </div>
        )}
      </div>

      {showConfirm && (
        <button
          onClick={confirmReward}
          disabled={isPending}
          className="btn-primary py-1.5 px-4 text-xs h-8"
        >
          {isPending ? (
            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Confirm <Send size={12} /></>
          )}
        </button>
      )}
    </div>
  );
}

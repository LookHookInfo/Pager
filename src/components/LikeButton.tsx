"use client";

import { useState, useEffect } from "react";
import { Heart, Send } from "lucide-react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall, toWei } from "thirdweb";
import { base } from "thirdweb/chains";
import { supabase } from "@/lib/supabase";
import { client, HASH_TOKEN_ADDRESS } from "@/lib/web3";

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
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  const handleLikeClick = () => {
    if (!account) {
      alert("Please connect your wallet to support authors.");
      return;
    }
    setPendingAmount(prev => prev + 1);
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
      <div className="flex items-center gap-2">
        <button 
          onClick={handleLikeClick}
          disabled={isPending}
          className={`flex items-center gap-1.5 transition-colors ${pendingAmount > 0 ? "text-black" : "text-[var(--text-secondary)] hover:text-black"}`}
        >
          <Heart 
            size={18} 
            strokeWidth={1.75}
            className={`${pendingAmount > 0 ? "fill-black" : ""} transition-transform active:scale-125`} 
          />
          <span className="text-sm font-medium">{likes + pendingAmount}</span>
        </button>

        {pendingAmount > 0 && (
          <span className="text-xs text-[var(--text-secondary)]">
            {pendingAmount} $HASH
          </span>
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

"use client";

import { Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ 
  articleId, 
  authorAddress 
}: { 
  articleId: string, 
  authorAddress: string 
}) {
  const account = useActiveAccount();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // Показываем кнопку только автору
  const isAuthor = account?.address?.toLowerCase() === authorAddress.toLowerCase();

  if (!isAuthor) return null;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this story? This action cannot be undone.")) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/article/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, authorAddress })
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to delete article");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting article");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 group/del"
      title="Delete Story"
    >
      {isDeleting ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Trash2 size={14} className="group-hover/del:scale-110 transition-transform" />
      )}
    </button>
  );
}

"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.back()}
      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-black transition-colors"
    >
      <ArrowLeft size={14} />
      <span>Back</span>
    </button>
  );
}

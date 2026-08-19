"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-black transition-colors"
    >
      <ArrowLeft size={14} />
      <span>Back</span>
    </button>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, PenLine, Globe, Image as ImageIcon, Check, Activity, Cpu } from "lucide-react";

interface ForgeOverlayProps {
  step: "idle" | "scraping" | "rewriting" | "banner" | "done";
  mascotImage?: string;
  mascotName?: string;
  /** Live banner sub-phase, driven by the server's SSE progress. */
  bannerPhase?: "probing" | "rendering" | "pinning" | "done" | null;
  /** The image model currently rendering (only meaningful during rendering). */
  bannerModel?: string;
  /** Live per-engine probe verdicts, in the order the server tested them. */
  bannerProbes?: { model: string; ok: boolean; status?: number }[];
}

const TIPS = [
  "Your banner is being painted pixel by pixel...",
  "The AI is studying your article's DNA...",
  "Composing visual elements from the story...",
  "Mixing character personality with article context...",
  "Almost there — final render in progress...",
  "Generating a scene that tells YOUR story...",
  "Every banner is unique — like a fingerprint...",
  "The more detailed the article, the better the banner...",
  "Your mascot is getting into character...",
  "Art takes time. Great art takes a bit more...",
];

const STEP_CONFIG = {
  scraping: { icon: Globe, label: "Scraping Article", sub: "Extracting content from source", progress: 20 },
  rewriting: { icon: PenLine, label: "AI Rewriting", sub: "Morphing into character voice", progress: 50 },
  banner: { icon: ImageIcon, label: "Generating Banner", sub: "Painting the scene", progress: 80 },
  done: { icon: Check, label: "Complete", sub: "Your article is ready", progress: 100 },
};

// Brief, clear status lines for the banner sub-phases so the user always knows
// exactly what's happening and doesn't close the page.
function bannerSubLabel(phase: "probing" | "rendering" | "pinning" | "done", model?: string): string {
  switch (phase) {
    case "probing":
      return "Checking available engines…";
    case "rendering":
      return model ? `Rendering with ${model}…` : "Rendering image…";
    case "pinning":
      return "Finalizing image…";
    case "done":
      return "Banner ready!";
    default:
      return "Painting the scene…";
  }
}

export default function ForgeOverlay({ step, mascotImage, mascotName, bannerPhase, bannerModel, bannerProbes }: ForgeOverlayProps) {
  const [tip, setTip] = useState(TIPS[0]);
  const [tipIndex, setTipIndex] = useState(0);
  const [dots, setDots] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (step === "idle" || step === "done") return;
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    setTip(TIPS[tipIndex]);
  }, [tipIndex]);

  useEffect(() => {
    if (step === "idle" || step === "done") return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step === "idle") { setElapsed(0); return; }
    if (step === "done") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [step]);

  if (step === "idle") return null;

  const config = STEP_CONFIG[step] || STEP_CONFIG.banner;
  const StepIcon = config.icon;
  const isActive = step !== "done";

  // During the banner step, show a live status line driven by real server progress.
  const bannerSub =
    step === "banner" && bannerPhase ? bannerSubLabel(bannerPhase, bannerModel) : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">

        {/* Animated gradient top bar */}
        <div className="h-1 bg-gray-100 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-black transition-all duration-1000 ease-out"
            style={{ width: `${config.progress}%` }}
          />
          {isActive && (
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]" />
          )}
        </div>

        <div className="p-8 text-center">

          {/* Mascot avatar */}
          <div className="relative mx-auto w-20 h-20 mb-6">
            {mascotImage ? (
              <img
                src={mascotImage}
                alt={mascotName || "Mascot"}
                className={`w-20 h-20 rounded-full object-cover border-2 border-gray-100 ${isActive ? "animate-pulse" : ""}`}
              />
            ) : (
              <div className={`w-20 h-20 rounded-full bg-gray-50 border-2 border-gray-100 flex items-center justify-center ${isActive ? "animate-pulse" : ""}`}>
                <Sparkles size={28} className="text-gray-300" />
              </div>
            )}
            {isActive && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-black rounded-full flex items-center justify-center">
                <Loader2 size={14} className="text-white animate-spin" />
              </div>
            )}
            {!isActive && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
            )}
          </div>

          {/* Step label */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <StepIcon size={14} className="text-black" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
              {config.label}{isActive ? dots : ""}
            </span>
          </div>

          {/* Live, brief status line for the banner phase */}
          {bannerSub ? (
            <div className="flex items-center justify-center gap-2 mb-3">
              {bannerPhase === "probing" && <Activity size={12} className="text-gray-400" />}
              {bannerPhase === "rendering" && <Cpu size={12} className="text-gray-400" />}
              <p className="text-xs text-gray-500 font-medium">{bannerSub}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-6">{config.sub}</p>
          )}

          {/* Live engine probe feed — the user sees each model tested and its verdict */}
          {step === "banner" && bannerProbes && bannerProbes.length > 0 && (
            <div className="bg-gray-50 rounded-sm px-3 py-2 mb-4 text-left space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Engines</p>
              {bannerProbes.map((p) => (
                <div key={p.model} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.ok ? (
                      <Check size={10} className="text-green-500 shrink-0" />
                    ) : (
                      <Loader2 size={10} className="text-red-500 shrink-0 animate-spin" />
                    )}
                    <span className="text-[9px] font-mono font-bold text-gray-600 truncate">{p.model}</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase shrink-0 ${p.ok ? "text-green-600" : "text-red-500"}`}>
                    {p.ok ? "up" : p.status ? `down ${p.status}` : "down"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {(["scraping", "rewriting", "banner"] as const).map((s, i) => {
              const stepOrder = { scraping: 0, rewriting: 1, banner: 2, done: 3, idle: -1 };
              const currentOrder = stepOrder[step];
              const isCompleted = stepOrder[s] < currentOrder;
              const isCurrent = s === step;

              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-500 ${
                    isCompleted ? "bg-black text-white" : isCurrent ? "bg-black text-white animate-pulse" : "bg-gray-100 text-gray-300"
                  }`}>
                    {isCompleted ? <Check size={12} /> : i + 1}
                  </div>
                  {i < 2 && (
                    <div className={`w-8 h-[1px] transition-all duration-500 ${stepOrder[s] < currentOrder ? "bg-black" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tip */}
          <div className="bg-gray-50 rounded-sm px-4 py-3 min-h-[48px] flex items-center justify-center">
            <p className="text-[10px] font-bold text-gray-400 italic text-center">
              {step === "done" ? "Banner generated! Redirecting..." : tip}
            </p>
          </div>

          {/* Timer */}
          {isActive && (
            <p className="text-[9px] font-bold text-gray-300 mt-4 uppercase tracking-widest">
              {elapsed}s elapsed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { getCharacterVisualPrompt } from "@/lib/character";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { sanitizeBannerPrompt, generateReliableBanner, generateSvgBanner } from "@/lib/image";
import { MOODS } from "@/lib/moods";
import { verifySessionAnyAction } from "@/lib/auth";
import { atomicDebitCredits, atomicRefundCredits } from "@/lib/credits";
import { withBudget } from "@/lib/with-budget";
import { aiLog, aiWarn } from "@/lib/ai-log";

// nano-banana-lite is the banner model: ~4-15s on the gateway. The attempt
// budget must also cover probing candidates (fast for dead/rate-limited models,
// up to ~12s each) plus a full render and pin, so 140s keeps one full render
// inside maxDuration while still allowing a couple of probe+render attempts.
export const maxDuration = 150;
export const dynamic = "force-dynamic";

const KNOWN_MOODS = new Set(MOODS.map((m) => m.id));

const ANYMODEL_ATTEMPT_BUDGET_MS = 140000;

type BannerPhase = "probing" | "rendering" | "pinning" | "done";

interface BannerInput {
  mood: string;
  title: string;
  bannerDescription?: string;
  atmosphere?: string;
  nftTokenId: string;
  userAddress: string;
  signature: string;
  message: string;
}

/**
 * Runs the full debited banner job (authorize not included — caller gates).
 * Writes progress into `emit` (called on phase changes) and resolves to the
 * ready banner, or null when every engine failed (SVG fallback path handled by
 * caller).
 */
async function runBannerJob(
  input: BannerInput,
  emit: (phase: BannerPhase, model?: string) => void,
  emitProbe?: (model: string, ok: boolean, status?: number) => void,
): Promise<{ url: string; model: string } | null> {
  const normalizedAddress = input.userAddress.toLowerCase();

  const supabase = getSupabaseServer();
  const { data: profile } = await supabase.from("profiles").select("ai_credits").eq("address", normalizedAddress).maybeSingle();

  const credits = profile?.ai_credits || 0;
  if (credits < 10) {
    throw Object.assign(new Error("Not enough $HASH credits for banner. Top up in Profile settings."), { status: 402 });
  }

  // ATOMIC DEBIT: debit credits BEFORE generation
  const debited = await atomicDebitCredits(normalizedAddress, 10);
  if (!debited) {
    throw Object.assign(new Error("Failed to debit credits. Try again."), { status: 409 });
  }

  const activeDna = await resolveDna(input.nftTokenId);
  if (!activeDna) {
    await atomicRefundCredits(normalizedAddress, 10);
    throw Object.assign(new Error(`Mascot DNA not found for token #${input.nftTokenId}. Try a different mascot.`), { status: 404 });
  }

  // Only allow controlled enums — arbitrary user strings must never reach the
  // image prompt (image models hard-block unexpected content). Unknown values
  // fall back to safe defaults.
  let atmosphere = input.atmosphere
    ? input.atmosphere.replace(/["`${}]/g, "").trim().slice(0, 100)
    : "";
  if (!atmosphere) atmosphere = "Surrealism";
  const safeMood = KNOWN_MOODS.has(input.mood) ? input.mood : "neutral";

  const prompt = sanitizeBannerPrompt(getCharacterVisualPrompt(safeMood, atmosphere, activeDna, input.bannerDescription || input.title, input.title));

  aiLog("banner-route", `start mood=${safeMood} atmosphere=${atmosphere} credits=${credits}`);

  const imageResult = await withBudget(
    () => generateReliableBanner(
      prompt,
      { inputImage: activeDna.image_url || undefined },
      undefined,
      (phase, model) => emit(phase, model),
      (probe) => emitProbe?.(probe.model, probe.ok, probe.status),
    ),
    ANYMODEL_ATTEMPT_BUDGET_MS,
  );

  if (imageResult) {
    aiLog("banner-route", `OK model=${imageResult.model}`);
    return imageResult;
  }

  // True last resort — every probed engine failed to produce a real banner.
  // We refund credits and serve a branded SVG placeholder so the article still
  // gets a banner instead of an error screen (per product decision the SVG is
  // the final fallback; the client surfaces a retry hint).
  aiWarn("banner-route", "all engines failed → SVG fallback");
  await atomicRefundCredits(normalizedAddress, 10);
  const svgUrl = await generateSvgBanner(input.title || "Pager", atmosphere);
  if (svgUrl) {
    return { url: svgUrl, model: "svg" };
  }
  return null;
}

export async function POST(req: Request) {
  const wantsStream = (req.headers.get("accept") || "").includes("text/event-stream");
  const emitProgress = wantsStream
    ? (phase: BannerPhase, model?: string) => {
        // fire-and-forget progress is handled by the stream below
      }
    : () => {};

  if (!wantsStream) {
    try {
      const body = (await req.json()) as BannerInput;
      if (!body.userAddress) return NextResponse.json({ error: "Address required" }, { status: 400 });
      if (!body.nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

      const authError = await verifySessionAnyAction(body.userAddress.toLowerCase(), body.signature, body.message);
      if (authError) return authError;

      const result = await runBannerJob(body, emitProgress);
      if (result) {
        if (result.model === "svg") {
          return NextResponse.json({ image_url: result.url, image_engine: "svg", error: "anymodel_failed" });
        }
        return NextResponse.json({ image_url: result.url, image_engine: "anymodel", image_model: result.model });
      }
      return NextResponse.json({ error: "Banner engine unavailable. Please try again." }, { status: 502 });
    } catch (error: any) {
      const status = error?.status || 500;
      return NextResponse.json({ error: error.message }, { status });
    }
  }

  // ---- Streaming variant: push phase updates (SSE) then a final result ----
  const encoder = new TextEncoder();
  let body: BannerInput;
  try {
    body = (await req.json()) as BannerInput;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.userAddress) return NextResponse.json({ error: "Address required" }, { status: 400 });
  if (!body.nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

  const authError = await verifySessionAnyAction(body.userAddress.toLowerCase(), body.signature, body.message);
  if (authError) return authError;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* stream already closed */
        }
      };

      const emit = (phase: BannerPhase, model?: string) => {
        if (phase === "pinning") return; // brief, inform-only
        send({ type: "progress", phase, model: phase === "rendering" ? model : undefined });
      };

      // Report each engine's live probe verdict so the UI can show the user
      // exactly which model is being tried and whether it's up or down.
      const emitProbe = (model: string, ok: boolean, status?: number) => {
        send({ type: "probe", model, ok, status });
      };

      (async () => {
        try {
          const result = await runBannerJob(body, emit, emitProbe);
          if (result) {
            if (result.model === "svg") {
              send({ type: "result", image_url: result.url, image_engine: "svg", error: "anymodel_failed" });
            } else {
              send({ type: "result", image_url: result.url, image_engine: "anymodel", image_model: result.model });
            }
          } else {
            send({ type: "error", error: "Banner engine unavailable. Please try again." });
          }
        } catch (e: any) {
          send({ type: "error", error: e?.message || "Banner generation failed" });
        } finally {
          try {
            controller.close();
          } catch {
            /* noop */
          }
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import { NextResponse } from "next/server";
import { getCharacterVisualPrompt } from "@/lib/character";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { submitBflTask, generateBflImage, generateOpenRouterImage, generateSvgBanner } from "@/lib/image";
import { DEFAULT_BFL_MODEL } from "@/lib/bfl-models";
import { verifySessionAnyAction } from "@/lib/auth";
import { atomicDebitCredits, atomicRefundCredits } from "@/lib/credits";
import { createBannerJob, updateBannerJob } from "@/lib/banner-jobs";

// Vercel Hobby caps serverless functions at 60s — the async BFL-polling flow
// must be the primary path. The inline fallback below is budgeted to fit.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BFL_SUBMIT_BUDGET_MS = 25000;
const BFL_SYNC_BUDGET_MS = 20000;
const OPENROUTER_SYNC_BUDGET_MS = 30000;

async function withBudget<T>(task: () => Promise<T | null>, budgetMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timerP = new Promise<T | null>((resolve) => { timer = setTimeout(() => resolve(null), budgetMs); });
  try {
    return await Promise.race([task(), timerP]);
  } finally {
    clearTimeout(timer);
  }
}

/** Synchronous generation used when the BFL submit fails. Bounded to stay
 *  inside the 60s function cap. */
async function generateBannerSync(
  prompt: string,
  title: string,
  atmosphere: string,
  address: string,
): Promise<{ image_url: string; image_engine: "bfl" | "openrouter" | "svg" }> {
  let imageUrl: string | null = null;

  try {
    imageUrl = await withBudget(() => generateBflImage(prompt).catch(() => null), BFL_SYNC_BUDGET_MS);
    if (imageUrl) return { image_url: imageUrl, image_engine: "bfl" };
  } catch (e: any) {
    console.warn("⚠️ [Banner] BFL sync failed:", e.message);
  }

  imageUrl = await withBudget(() => generateOpenRouterImage(prompt), OPENROUTER_SYNC_BUDGET_MS);
  if (imageUrl) return { image_url: imageUrl, image_engine: "openrouter" };

  const svgUrl = await generateSvgBanner(title, atmosphere);
  await atomicRefundCredits(address, 10);
  console.warn("⚠️ [Banner] Only SVG placeholder produced (sync path) — 10 credits refunded");
  return { image_url: svgUrl, image_engine: "svg" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mood = "neutral", title, bannerDescription, atmosphere: providedAtmosphere, nftTokenId, userAddress, signature, message, content } = body;

    if (!userAddress) return NextResponse.json({ error: "Address required" }, { status: 400 });
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    const authError = await verifySessionAnyAction(normalizedAddress, signature, message);
    if (authError) return authError;

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase.from("profiles").select("ai_credits").eq("address", normalizedAddress).maybeSingle();

    const credits = profile?.ai_credits || 0;
    if (credits < 10) {
      return NextResponse.json({ error: "Not enough $HASH credits for banner. Top up in Profile settings." }, { status: 402 });
    }

    // ATOMIC DEBIT: debit credits BEFORE generation
    const debited = await atomicDebitCredits(normalizedAddress, 10);
    if (!debited) {
      return NextResponse.json({ error: "Failed to debit credits. Try again." }, { status: 409 });
    }

    const activeDna = await resolveDna(nftTokenId);
    if (!activeDna) {
      await atomicRefundCredits(normalizedAddress, 10);
      return NextResponse.json({ error: `Mascot DNA not found for token #${nftTokenId}. Try a different mascot.` }, { status: 404 });
    }

    let atmosphere = (providedAtmosphere || "Surrealism")
      .replace(/["`${}]/g, "").trim().slice(0, 100);
    if (!atmosphere) atmosphere = "Surrealism";

    const articleContext = content
      ? content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 600)
      : "";

    const prompt = getCharacterVisualPrompt(bannerDescription || title, mood, title, atmosphere, activeDna, articleContext);

    const jobId = await createBannerJob({
      address: normalizedAddress,
      prompt,
      title: title || "",
      atmosphere,
      jobId: null,
      pollingUrl: null,
    });

    // Async path: submit to BFL WITHOUT a webhook_url so BFL returns the
    // cluster-specific polling_url (in webhook mode BFL omits polling_url and
    // the reconstructed global URL 404s for cluster-routed tasks, which broke
    // self-heal). The client polls /api/ai/banner/status, which polls BFL.
    // Return job_id immediately.
    try {
      const task = await withBudget(() => submitBflTask(prompt, DEFAULT_BFL_MODEL), BFL_SUBMIT_BUDGET_MS);
      if (!task) throw new Error("BFL submit timed out");

      await updateBannerJob(jobId, { job_id: task.id, polling_url: task.pollingUrl, status: "processing" });
      return NextResponse.json({ job_id: jobId, status: "processing" });
    } catch (e: any) {
      console.warn("⚠️ [Banner] BFL submit failed, using inline fallback:", e.message);
      const result = await generateBannerSync(prompt, title, atmosphere, normalizedAddress);
      await updateBannerJob(jobId, {
        status: result.image_engine === "svg" ? "svg_placeholder" : "ready",
        image_url: result.image_url,
        image_engine: result.image_engine,
        error: result.image_engine === "svg" ? `BFL submit failed: ${e.message}` : null,
      });
      return NextResponse.json(result);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

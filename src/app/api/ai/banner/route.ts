import { NextResponse } from "next/server";
import { getCharacterVisualPrompt } from "@/lib/character";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { sanitizeBannerPrompt, generateAnyModelImage, generateSvgBanner } from "@/lib/image";
import { ATMOSPHERE_PRESETS, MOODS } from "@/lib/moods";
import { verifySessionAnyAction } from "@/lib/auth";
import { atomicDebitCredits, atomicRefundCredits } from "@/lib/credits";
import { withBudget } from "@/lib/with-budget";

// gpt-image-2 on the AnyModel gateway takes up to ~2 minutes for a 1280x720
// banner, so the function must run well past the default 60s. maxDuration=300
// is valid on Vercel Pro (Hobby is capped at 60s and would time out here).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const KNOWN_ATMOSPHERES = new Set(ATMOSPHERE_PRESETS);
const KNOWN_MOODS = new Set(MOODS.map((m) => m.id));

// AnyModel image generation is synchronous. gpt-image-2 needs up to ~2 min
// for a 1280x720 banner, so the chain budget is generous and each attempt gets
// a 140s slice; the route must stay under maxDuration (300s) with pinning time.
const ANYMODEL_BUDGET_MS = 280000;
const ANYMODEL_ATTEMPT_BUDGET_MS = 140000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mood = "neutral", title, bannerDescription, atmosphere: providedAtmosphere, nftTokenId, userAddress, signature, message } = body;

    if (!userAddress) return NextResponse.json({ error: "Address required" }, { status: 400 });
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    const authError = await verifySessionAnyAction(normalizedAddress, signature, message);
    if (authError) return authError;

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase.from("profiles").select("ai_credits, ai_image_model").eq("address", normalizedAddress).maybeSingle();

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

    // Only allow controlled enums — arbitrary user strings must never reach the
    // image prompt (image models hard-block unexpected content). Unknown values
    // fall back to safe defaults.
    let atmosphere = providedAtmosphere
      ? providedAtmosphere.replace(/["`${}]/g, "").trim().slice(0, 100)
      : "";
    if (!KNOWN_ATMOSPHERES.has(atmosphere)) atmosphere = "Surrealism";
    const safeMood = KNOWN_MOODS.has(mood) ? mood : "neutral";

    const prompt = sanitizeBannerPrompt(getCharacterVisualPrompt(safeMood, atmosphere, activeDna, bannerDescription || title, title));

    // Synchronous AnyModel generation. The mascot image is passed as a base64
    // data URL reference (I2I) — models without image-to-image support simply
    // ignore it. The image is compressed to WebP and pinned to IPFS inside
    // generateAnyModelImage; the client gets the ready URL inline.
    // Model chain: profile choice first, then the env default, then known-good
    // fallbacks. AnyModel failures (429/503) return fast, so a down pool is
    // skipped quickly in favor of the next model. Wall time is bounded by
    // ANYMODEL_BUDGET_MS via per-attempt remaining budget.
    const preferredModel = profile?.ai_image_model?.trim() || undefined;
    const defaultModel = process.env.ANYMODEL_IMAGE_MODEL?.trim() || "ag/gemini-3.1-flash-image";

    const CANDIDATE_MODELS = [
      "ag/gemini-3.1-flash-image",
      "am/flux.2-klein-4b",
      "cx/gpt-image-2",
      "flow/nano-banana",
    ];
    const modelChain: string[] = [];
    for (const m of [preferredModel, defaultModel, ...CANDIDATE_MODELS]) {
      if (m && !modelChain.includes(m)) modelChain.push(m);
    }

    const generate = (model: string) =>
      generateAnyModelImage(prompt, { model, inputImage: activeDna.image_url || undefined });

    const startedAt = Date.now();
    let imageUrl: string | null = null;
    let imageModel: string | null = null;
    for (const model of modelChain) {
      const remaining = ANYMODEL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 8000) break;
      imageUrl = await withBudget(() => generate(model), Math.min(ANYMODEL_ATTEMPT_BUDGET_MS, remaining));
      if (imageUrl) {
        imageModel = model;
        break;
      }
    }

    if (imageUrl) {
      return NextResponse.json({ image_url: imageUrl, image_engine: "anymodel", image_model: imageModel });
    }

    // Total failure: refund credits and serve a branded SVG placeholder so the
    // article still gets a banner instead of an error screen.
    await atomicRefundCredits(normalizedAddress, 10);
    const svgUrl = await generateSvgBanner(title || "Pager", atmosphere);
    if (svgUrl) {
      return NextResponse.json({ image_url: svgUrl, image_engine: "svg", error: "anymodel_failed" });
    }
    return NextResponse.json({ error: "Banner engine unavailable. Please try again." }, { status: 502 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

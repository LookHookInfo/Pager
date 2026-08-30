import { NextResponse } from "next/server";
import { getCharacterVisualPrompt } from "@/lib/character";
import { resolveDna } from "@/lib/character/resolve";
import { getSupabaseServer } from "@/lib/supabase";
import { sanitizeBannerPrompt, generateAnyModelImage, generateSvgBanner } from "@/lib/image";
import { MOODS } from "@/lib/moods";
import { verifySessionAnyAction } from "@/lib/auth";
import { atomicDebitCredits, atomicRefundCredits } from "@/lib/credits";
import { withBudget } from "@/lib/with-budget";
import { ANYMODEL_IMAGE_MODEL } from "@/lib/ai-models";

// nano-banana-lite is the banner model: ~4-15s on the gateway. The attempt
// budget must also cover fetching the mascot reference (up to ~25s) and
// recompressing + pinning (up to ~12s), so 90s keeps a full render inside
// maxDuration without falling back to the SVG placeholder.
export const maxDuration = 150;
export const dynamic = "force-dynamic";

const KNOWN_MOODS = new Set(MOODS.map((m) => m.id));

const ANYMODEL_ATTEMPT_BUDGET_MS = 90000;

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

    // Only allow controlled enums — arbitrary user strings must never reach the
    // image prompt (image models hard-block unexpected content). Unknown values
    // fall back to safe defaults.
    let atmosphere = providedAtmosphere
      ? providedAtmosphere.replace(/["`${}]/g, "").trim().slice(0, 100)
      : "";
    if (!atmosphere) atmosphere = "Surrealism";
    const safeMood = KNOWN_MOODS.has(mood) ? mood : "neutral";

    const prompt = sanitizeBannerPrompt(getCharacterVisualPrompt(safeMood, atmosphere, activeDna, bannerDescription || title, title));

    // Synchronous AnyModel generation. The mascot image is passed as a base64
    // data URL reference (I2I) — models without image-to-image support simply
    // ignore it. The image is compressed to WebP and pinned to IPFS inside
    // generateAnyModelImage; the client gets the ready URL inline.
    const model = ANYMODEL_IMAGE_MODEL();

    const imageUrl = await withBudget(
      () => generateAnyModelImage(prompt, { model, inputImage: activeDna.image_url || undefined }),
      ANYMODEL_ATTEMPT_BUDGET_MS,
    );

    if (imageUrl) {
      return NextResponse.json({ image_url: imageUrl, image_engine: "anymodel", image_model: model });
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

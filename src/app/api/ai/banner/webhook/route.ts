import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { findBannerJobByBflId, processBflResult } from "@/lib/banner-jobs";

// Must ACK BFL within 30s — keep this handler lean.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function verifyBflSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const [prefix, hex] = signatureHeader.split("=");
  if (prefix !== "sha256" || !hex) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(hex);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.BFL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("BFL_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-bfl-signature");
  if (!verifyBflSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!payload?.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const job = await findBannerJobByBflId(payload.id);
  if (!job) {
    // Unknown/already-cleaned job — acknowledge so BFL stops retrying.
    return NextResponse.json({ ok: true });
  }

  try {
    await processBflResult(job, payload);
  } catch (e: any) {
    console.error(`❌ [Banner] webhook processing failed: ${e.message}`);
    // Still ACK — BFL would retry otherwise; the status route self-heals.
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getPrivateLogs } from "@/lib/ai-log";

// Developer-only endpoint: surfaces the recent PAGER-PRIVATE AI pipeline logs.
// Guarded by the PAGER_ADMIN_KEY header so end users can never reach it. The
// logs contain internal model-selection noise that users must not see.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const adminKey = process.env.PAGER_ADMIN_KEY?.trim();
  if (!adminKey) {
    return NextResponse.json({ error: "debug endpoint disabled (no PAGER_ADMIN_KEY)" }, { status: 404 });
  }

  const supplied = req.headers.get("x-pager-admin-key") || "";
  if (supplied !== adminKey) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "100", 10) || 100, 1), 250);
  return NextResponse.json({ enabled: true, items: getPrivateLogs(limit) });
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TEXT_MODELS = [
  { id: "ag/gemini-3.5-flash-low", label: "Gemini 3.5 Flash" },
  { id: "ag/gemini-3.5-flash-extra-low", label: "Gemini 3.5 Flash Extra Low" },
  { id: "gc/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gc/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

const BANNER_MODELS = [
  { id: "ag/gemini-3.1-flash-image", label: "Gemini Flash-Image" },
  { id: "cx/gpt-image-2", label: "GPT Image 2" },
  { id: "am/flux.2-klein-4b", label: "FLUX.2 Klein 4B" },
  { id: "flow/nano-banana", label: "Nano Banana" },
];

// Text replies fast when healthy; a 12s timeout = dead/slow pool.
const TEXT_TIMEOUT_MS = 12000;
// Image models legitimately take 30-90s to render (gpt-image-2, nano-banana),
// so a 15s probe timeout means "slow" (yellow), not necessarily down.
const IMAGE_TIMEOUT_MS = 15000;

// Probes cost real credits (image gens especially), so results are cached and
// refreshes are throttled to one per 30s.
const CACHE_TTL_MS = 60000;
const MIN_REFRESH_INTERVAL_MS = 30000;

let cache: { at: number; data: any } | null = null;

type ProbeResult = {
  id: string;
  label: string;
  status: "ok" | "slow" | "down";
  latencyMs: number | null;
};

async function probeText(key: string, m: { id: string; label: string }): Promise<ProbeResult> {
  const startedAt = Date.now();
  try {
    const res = await fetch("https://anymodel.org/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: m.id,
        messages: [{ role: "user", content: "Reply with the single word OK" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
    });
    const latency = Date.now() - startedAt;
    const ok = res.status === 200;
    if (!ok) {
      const body = await res.text().catch(() => "");
      console.log(`[AI Status] text ${m.id}: ${res.status} — ${body.slice(0, 120)}`);
    }
    return { ...m, status: ok ? "ok" : "down", latencyMs: latency };
  } catch (e: any) {
    return { ...m, status: e?.name === "TimeoutError" ? "slow" : "down", latencyMs: Date.now() - startedAt };
  }
}

async function probeImage(key: string, m: { id: string; label: string }): Promise<ProbeResult> {
  const startedAt = Date.now();
  try {
    const res = await fetch("https://anymodel.org/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: m.id,
        prompt: "A simple red circle on a white background",
        n: 1,
        size: "1024x1024",
        quality: "low",
        output_format: "png",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    const latency = Date.now() - startedAt;
    const body = await res.text().catch(() => "");
    const ok = res.status === 200 && (body.includes("b64_json") || body.includes("\"url\""));
    if (!ok) console.log(`[AI Status] image ${m.id}: ${res.status} — ${body.slice(0, 120)}`);
    return { ...m, status: ok ? "ok" : "down", latencyMs: latency };
  } catch (e: any) {
    return { ...m, status: e?.name === "TimeoutError" ? "slow" : "down", latencyMs: Date.now() - startedAt };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const now = Date.now();

  if (!refresh && cache && now - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }
  if (refresh && cache && now - cache.at < MIN_REFRESH_INTERVAL_MS) {
    return NextResponse.json({ ...cache.data, throttled: true, cachedAt: cache.at });
  }

  const apiKey = process.env.ANYMODEL_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ANYMODEL_API_KEY missing" }, { status: 500 });
  }

  // Sequential probes — the gateway rate-limits concurrent requests per key,
  // so firing them all at once would create 429s that look like outages.
  const text: ProbeResult[] = [];
  for (const m of TEXT_MODELS) text.push(await probeText(apiKey, m));
  const banner: ProbeResult[] = [];
  for (const m of BANNER_MODELS) banner.push(await probeImage(apiKey, m));

  const data = { text, banner, checkedAt: Date.now() };
  cache = { at: now, data };
  return NextResponse.json(data);
}

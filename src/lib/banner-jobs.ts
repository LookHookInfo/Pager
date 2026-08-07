import { getSupabaseServer } from "@/lib/supabase";
import { generateOpenRouterImage, generateSvgBanner, uploadToPinata } from "@/lib/image";
import { atomicRefundCredits } from "@/lib/credits";

const BANNER_JOBS_TABLE = "banner_jobs";

// BFL statuses that are still running (polling self-heal must NOT fall back
// when these come back — only terminal statuses trigger the fallback chain).
export const BFL_ACTIVE_STATUSES = new Set([
  "Pending",
  "Processing",
  "In Progress",
  "InProgress",
  "Queued",
]);

// Hard cap on the OpenRouter image fallback so a fallback triggered from the
// status route stays inside the 60s function cap and the client gets a
// response promptly.
const FALLBACK_BUDGET_MS = 40000;

export interface BannerJob {
  id: string;
  address: string;
  job_id: string | null;
  polling_url: string | null;
  status: string;
  image_url: string | null;
  image_engine: string | null;
  prompt: string | null;
  title: string | null;
  atmosphere: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface BannerJobState {
  status: string;
  image_url: string | null;
  image_engine: string | null;
  error: string | null;
}

function serializeJob(job: BannerJob): BannerJobState {
  return {
    status: job.status,
    image_url: job.image_url,
    image_engine: job.image_engine,
    error: job.error,
  };
}

export async function createBannerJob(input: {
  address: string;
  prompt: string;
  title: string;
  atmosphere: string;
  jobId: string | null;
  pollingUrl: string | null;
}): Promise<string> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from(BANNER_JOBS_TABLE)
    .insert({
      address: input.address,
      prompt: input.prompt,
      title: input.title,
      atmosphere: input.atmosphere,
      job_id: input.jobId,
      polling_url: input.pollingUrl,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create banner job: ${error?.message || "unknown"}`);
  }
  return data.id as string;
}

export async function getBannerJob(jobId: string): Promise<BannerJob | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from(BANNER_JOBS_TABLE)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  return data as BannerJob;
}

export async function findBannerJobByBflId(bflId: string): Promise<BannerJob | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from(BANNER_JOBS_TABLE)
    .select("*")
    .eq("job_id", bflId)
    .maybeSingle();

  if (error || !data) return null;
  return data as BannerJob;
}

export async function updateBannerJob(jobId: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from(BANNER_JOBS_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

/**
 * Apply a BFL result (from status-route polling, or a webhook if ever used)
 * to a job. Idempotent: terminal jobs are never re-processed (prevents double
 * refunds on duplicate deliveries). Active statuses are ignored.
 */
export async function processBflResult(
  job: BannerJob,
  bfl: { status: string; result?: { sample?: string }; error?: string; message?: string },
): Promise<BannerJobState> {
  if (job.status === "ready" || job.status === "svg_placeholder" || job.status === "failed") {
    return serializeJob(job);
  }
  if (BFL_ACTIVE_STATUSES.has(bfl.status)) {
    return serializeJob(job);
  }

  // Success: pin the BFL sample and mark the job ready.
  if (bfl.status === "Ready" && bfl.result?.sample) {
    const imageUrl = await uploadToPinata(bfl.result.sample);
    if (imageUrl) {
      await updateBannerJob(job.id, { status: "ready", image_url: imageUrl, image_engine: "bfl", error: null });
      return { status: "ready", image_url: imageUrl, image_engine: "bfl", error: null };
    }
  }

  // Terminal failure (or Ready without sample): fall back to OpenRouter → SVG.
  const failure = bfl.error || bfl.message || bfl.status || "BFL failed";

  let imageUrl: string | null = null;
  let engine: "openrouter" | "svg" = "svg";
  if (job.prompt) {
    const prompt = job.prompt;
    imageUrl = await withBudget(() => generateOpenRouterImage(prompt), FALLBACK_BUDGET_MS);
    if (imageUrl) engine = "openrouter";
  }
  if (!imageUrl) {
    imageUrl = await generateSvgBanner(job.title || "Pager", job.atmosphere || "Surrealism");
  }

  if (!imageUrl) {
    await updateBannerJob(job.id, { status: "failed", error: failure });
    return { status: "failed", image_url: null, image_engine: null, error: failure };
  }

  if (engine === "svg") {
    await atomicRefundCredits(job.address, 10);
    await updateBannerJob(job.id, { status: "svg_placeholder", image_url: imageUrl, image_engine: "svg", error: failure });
    console.warn(`⚠️ [Banner] Only SVG placeholder produced (${failure}) — 10 credits refunded`);
    return { status: "svg_placeholder", image_url: imageUrl, image_engine: "svg", error: failure };
  }

  await updateBannerJob(job.id, { status: "ready", image_url: imageUrl, image_engine: "openrouter", error: null });
  return { status: "ready", image_url: imageUrl, image_engine: "openrouter", error: null };
}

async function withBudget<T>(task: () => Promise<T | null>, budgetMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timerP = new Promise<T | null>((resolve) => { timer = setTimeout(() => resolve(null), budgetMs); });
  try {
    return await Promise.race([task(), timerP]);
  } finally {
    clearTimeout(timer);
  }
}

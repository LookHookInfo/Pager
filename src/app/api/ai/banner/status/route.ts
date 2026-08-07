import { NextResponse } from "next/server";
import { getBannerJob, updateBannerJob, processBflResult } from "@/lib/banner-jobs";
import { pollBflTask } from "@/lib/image";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Poll BFL at most once per cooldown (client polls every ~3s, so each BFL
// GET is throttled to ~1 per 12s). BFL finishes in ~10-15s, so the result
// lands on the second or third BFL poll.
const STALE_POLL_MS = 12000;
// Hard cap so a broken polling_url eventually fails the job instead of
// leaving it stuck as "processing" forever.
const MAX_ATTEMPTS = 20;

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  let job = await getBannerJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Self-heal: the client drives the poll. If the job has been "processing"
  // past the cooldown, poll the stored cluster polling_url directly and apply
  // the result (Ready → pin; failure → OpenRouter → SVG fallback).
  const staleForMs = Date.now() - new Date(job.updated_at).getTime();
  if (job.status === "processing" && job.polling_url && staleForMs > STALE_POLL_MS) {
    if (job.attempts >= MAX_ATTEMPTS) {
      await updateBannerJob(job.id, { status: "failed", error: "BFL result unavailable (polling exhausted)" });
      job = (await getBannerJob(jobId)) || job;
    } else {
      const bfl = await pollBflTask(job.polling_url);
      await updateBannerJob(job.id, { attempts: job.attempts + 1 });
      if (bfl) {
        await processBflResult(job, bfl);
        job = (await getBannerJob(jobId)) || job;
      }
    }
  }

  return NextResponse.json({
    status: job.status,
    image_url: job.image_url,
    image_engine: job.image_engine,
    error: job.error,
  });
}

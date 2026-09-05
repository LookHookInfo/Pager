/**
 * Private, developer-only logging for the AI pipeline.
 *
 * These logs are NEVER rendered to end users — they land only on the server
 * console (tagged [PAGER-PRIVATE]) and, when PAGER_PRIVATE_LOG_FILE is set, in
 * a local file. A ring buffer of the latest events is kept in memory and can
 * be read by the protected /api/ai/debug-logs endpoint (guarded by an admin
 * key) so the developer can inspect the exact state of the model chain.
 *
 * This shields internal model-selection noise from the "news feed crowd" while
 * still giving us full visibility into what the banner pipeline is doing.
 */
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

interface LogEntry {
  ts: string;
  level: "log" | "warn" | "error";
  scope: string;
  args: string;
}

const LOG_FILE =
  process.env.PAGER_PRIVATE_LOG_FILE?.trim() ||
  join(tmpdir(), "pager-ai-private.log");

export const PRIVATE_LOGS_ENABLED = process.env.PAGER_PRIVATE_LOG !== "0";

// In-memory ring buffer (most recent first) for the debug endpoint.
const RING: LogEntry[] = [];
const RING_CAP = 250;

function append(level: LogEntry["level"], scope: string, args: unknown[]): void {
  if (!PRIVATE_LOGS_ENABLED) return;
  const ts = new Date().toISOString();
  const serialized = args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");

  RING.unshift({ ts, level, scope, args: serialized });
  if (RING.length > RING_CAP) RING.length = RING_CAP;

  if (level === "log") console.log(`[PAGER-PRIVATE][${scope}]`, serialized);
  else if (level === "warn") console.warn(`[PAGER-PRIVATE][${scope}]`, serialized);
  else console.error(`[PAGER-PRIVATE][${scope}]`, serialized);

  if (process.env.PAGER_PRIVATE_LOG_FILE?.trim()) {
    void logToFile(`${ts} ${level.toUpperCase()} [${scope}] ${serialized}\n`).catch(() => {});
  }
}

async function logToFile(line: string): Promise<void> {
  const dir = LOG_FILE.split(/[\\/]/).slice(0, -1).join("/");
  if (dir) await mkdir(dir, { recursive: true });
  await appendFile(LOG_FILE, line, "utf8");
}

export function aiLog(scope: string, ...args: unknown[]): void {
  append("log", scope, args);
}
export function aiWarn(scope: string, ...args: unknown[]): void {
  append("warn", scope, args);
}
export function aiError(scope: string, ...args: unknown[]): void {
  append("error", scope, args);
}

/** Developer-only access to the recent ring buffer. */
export function getPrivateLogs(limit = 100): LogEntry[] {
  return RING.slice(0, limit);
}

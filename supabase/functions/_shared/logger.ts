/**
 * Shared structured logger for edge functions.
 * Outputs JSON to stdout for easy aggregation.
 *
 * BetterStack Logtail integration:
 *   Set BETTERSTACK_SOURCE_TOKEN in Supabase Edge Function secrets.
 *   All log entries are forwarded to https://in.logs.betterstack.com
 *   as fire-and-forget (failures are silently swallowed to avoid impacting
 *   the main function execution path).
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

/** Fire-and-forget log drain to BetterStack Logtail. */
function drainToLogtail(entry: LogEntry): void {
  const token =
    typeof Deno !== "undefined"
      ? Deno.env.get("BETTERSTACK_SOURCE_TOKEN")
      : undefined;
  if (!token) return;

  // Map our levels to BetterStack dt+level format
  const payload = {
    dt: entry.timestamp,
    level: entry.level,
    message: entry.event,
    ...entry,
  };

  // Fire-and-forget — never await, never let errors surface
  fetch("https://in.logs.betterstack.com", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* swallow — log drain must never break the function */
  });
}

export function log(
  level: LogLevel,
  event: string,
  meta?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const message = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(message);
      break;
    case "warn":
      console.warn(message);
      break;
    default:
      console.log(message);
  }

  drainToLogtail(entry);
}

/** Measure duration of an async operation */
export async function withTiming<T>(
  event: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log("info", `${event}_completed`, {
      ...meta,
      durationMs: Date.now() - start,
    });
    return result;
  } catch (e) {
    log("error", `${event}_failed`, {
      ...meta,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

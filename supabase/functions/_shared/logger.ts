/**
 * Shared structured logger for edge functions.
 * Outputs JSON to stdout for easy aggregation.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

export function log(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
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
}

/** Measure duration of an async operation */
export async function withTiming<T>(
  event: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log("info", `${event}_completed`, { ...meta, durationMs: Date.now() - start });
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

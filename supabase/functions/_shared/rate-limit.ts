/**
 * Minimal in-memory rate limiter for Supabase Edge Functions.
 *
 * Because each edge-function instance is ephemeral, this provides
 * per-instance (best-effort) rate limiting. It is sufficient to
 * blunt abuse bursts against a single warm instance.
 *
 * Usage:
 *   import { checkRateLimit } from "../_shared/rate-limit.ts";
 *
 *   const allowed = checkRateLimit(`scrape:${userId}`, 10, 60_000);
 *   if (!allowed) return new Response(..., { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically purge expired entries to prevent unbounded memory growth.
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60_000; // clean up every 5 minutes

function maybeCleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Returns true when the caller is within the allowed rate, false when the
 * limit has been exceeded.
 *
 * @param key      Unique identifier for the caller (e.g. `"fn:userId"`).
 * @param limit    Maximum number of requests allowed per window.
 * @param windowMs Window size in milliseconds.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  maybeCleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

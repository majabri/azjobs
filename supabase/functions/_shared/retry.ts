/**
 * retry.ts — Exponential backoff retry for Edge Function fetches
 *
 * Wraps any fetch call with configurable retry behaviour:
 *  - Exponential backoff with jitter
 *  - Per-attempt AbortSignal timeout
 *  - Configurable retryable status codes and error types
 *  - Respects Retry-After header on 429s
 *
 * Runtime: Deno (Supabase Edge Functions — no Node.js APIs)
 *
 * Usage:
 *   const result = await withRetryText(
 *     (signal) => fetch(url, { headers, signal }),
 *     { maxAttempts: 3, baseDelayMs: 500, timeoutMs: 12_000, label: url }
 *   );
 *   if (!result.ok) { ... handle error ... }
 *   const html = result.value!;
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Total attempts including the first (default: 3). */
  maxAttempts?: number;
  /** Base delay in ms for backoff calculation (default: 500). */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 10_000). */
  maxDelayMs?: number;
  /** Max random jitter added per delay in ms (default: 200). */
  jitterMs?: number;
  /** Per-attempt timeout in ms; 0 = none (default: 15_000). */
  timeoutMs?: number;
  /** Given a Response, return true to retry (default: 429/5xx). */
  shouldRetryResponse?: (res: Response) => boolean;
  /** Given a caught error, return true to retry (default: network/timeout errors). */
  shouldRetryError?: (err: unknown) => boolean;
  /** Label for log output (e.g. URL being fetched). */
  label?: string;
}

export interface RetryResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  retriesMade: number;
  durationMs: number;
  lastStatus?: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function defaultShouldRetryResponse(res: Response): boolean {
  return RETRYABLE_STATUSES.has(res.status);
}

function defaultShouldRetryError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  return (
    err.name === "AbortError" ||
    err.name === "TypeError" ||
    err.message.includes("fetch failed") ||
    err.message.includes("connection") ||
    err.message.includes("timeout")
  );
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Execute a fetch with retry, exponential backoff, and per-attempt timeouts.
 *
 * @param fn  Factory returning a fetch Promise. Called fresh each attempt.
 */
export async function withRetry(
  fn: (signal: AbortSignal) => Promise<Response>,
  options: RetryOptions = {}
): Promise<RetryResult<Response>> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    jitterMs = 200,
    timeoutMs = 15_000,
    shouldRetryResponse = defaultShouldRetryResponse,
    shouldRetryError = defaultShouldRetryError,
    label = "request",
  } = options;

  const startTime = Date.now();
  let retriesMade = 0;
  let lastError = "";
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(
        () => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)),
        timeoutMs
      );
    }

    try {
      const res = await fn(controller.signal);
      clearTimeout(timeoutHandle);
      lastStatus = res.status;

      if (res.ok) {
        return { ok: true, value: res, retriesMade, durationMs: Date.now() - startTime, lastStatus };
      }

      if (!shouldRetryResponse(res)) {
        const body = await res.text().catch(() => "");
        return {
          ok: false,
          error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
          retriesMade,
          durationMs: Date.now() - startTime,
          lastStatus,
        };
      }

      // Respect Retry-After on 429
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const waitSec = parseInt(retryAfter, 10);
          if (!isNaN(waitSec) && waitSec > 0 && waitSec <= 30) {
            console.log(`[retry] ${label}: 429 — honoring Retry-After: ${waitSec}s`);
            await sleep(waitSec * 1_000);
            retriesMade++;
            continue;
          }
        }
      }

      lastError = `HTTP ${res.status}`;
      await res.body?.cancel();
    } catch (err) {
      clearTimeout(timeoutHandle);
      if (!shouldRetryError(err)) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Non-retryable: ${msg}`, retriesMade, durationMs: Date.now() - startTime, lastStatus };
      }
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < maxAttempts) {
      retriesMade++;
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * jitterMs),
        maxDelayMs
      );
      console.log(`[retry] ${label}: attempt ${attempt}/${maxAttempts} failed (${lastError}), retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  return {
    ok: false,
    error: `All ${maxAttempts} attempts failed. Last: ${lastError}`,
    retriesMade,
    durationMs: Date.now() - startTime,
    lastStatus,
  };
}

/**
 * Convenience: withRetry that reads the response body as text.
 */
export async function withRetryText(
  fn: (signal: AbortSignal) => Promise<Response>,
  options: RetryOptions = {}
): Promise<RetryResult<string>> {
  const result = await withRetry(fn, options);
  if (!result.ok || !result.value) return { ...result, value: undefined };

  try {
    const text = await result.value.text();
    return { ...result, value: text };
  } catch {
    return { ok: false, error: "Failed to read response body", retriesMade: result.retriesMade, durationMs: result.durationMs, lastStatus: result.lastStatus };
  }
}

/**
 * Convenience: withRetry that parses the response body as JSON.
 */
export async function withRetryJson<T>(
  fn: (signal: AbortSignal) => Promise<Response>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const result = await withRetry(fn, options);
  if (!result.ok || !result.value) return { ...result, value: undefined };

  try {
    const data: T = await result.value.json();
    return { ...result, value: data };
  } catch {
    return { ok: false, error: "Failed to parse JSON", retriesMade: result.retriesMade, durationMs: result.durationMs, lastStatus: result.lastStatus };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

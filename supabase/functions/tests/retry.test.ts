/**
 * Unit tests — retry.ts
 *
 * Run with:  deno test tests/retry.test.ts --allow-net
 */

import {
  assertEquals,
  assert,
  assertAlmostEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { withRetry, withRetryText } from "../_shared/retry.ts";

// ---------------------------------------------------------------------------
// Helpers — mock fetch factories
// ---------------------------------------------------------------------------

/** Always returns a successful 200 response. */
function alwaysOk(): (signal: AbortSignal) => Promise<Response> {
  return (_signal) =>
    Promise.resolve(new Response("OK", { status: 200 }));
}

/** Returns failure N times, then success. */
function failThenOk(failCount: number): (signal: AbortSignal) => Promise<Response> {
  let calls = 0;
  return (_signal) => {
    calls++;
    if (calls <= failCount) {
      return Promise.resolve(
        new Response("Server Error", { status: 503 })
      );
    }
    return Promise.resolve(new Response("OK", { status: 200 }));
  };
}

/** Always throws a network error. */
function alwaysThrows(message = "Network error"): (signal: AbortSignal) => Promise<Response> {
  return (_signal) => Promise.reject(new TypeError(message));
}

/** Always returns a non-retryable 404. */
function always404(): (signal: AbortSignal) => Promise<Response> {
  return (_signal) =>
    Promise.resolve(new Response("Not Found", { status: 404 }));
}

/** Resolves after delayMs, then returns 200 (for timeout tests). */
function slowOk(delayMs: number): (signal: AbortSignal) => Promise<Response> {
  return (signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response("OK", { status: 200 })), delayMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("The signal has been aborted", "AbortError"));
      });
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("withRetry: succeeds on first attempt", async () => {
  const result = await withRetry(alwaysOk(), {
    maxAttempts: 3,
    baseDelayMs: 10,
  });
  assertEquals(result.ok, true);
  assertEquals(result.retriesMade, 0);
});

Deno.test("withRetry: retries and succeeds on 3rd attempt", async () => {
  const result = await withRetry(failThenOk(2), {
    maxAttempts: 3,
    baseDelayMs: 10,
    jitterMs: 0,
  });
  assertEquals(result.ok, true);
  assertEquals(result.retriesMade, 2);
});

Deno.test("withRetry: fails after exhausting all attempts", async () => {
  const result = await withRetry(failThenOk(10), {
    maxAttempts: 3,
    baseDelayMs: 10,
    jitterMs: 0,
  });
  assertEquals(result.ok, false);
  assert(result.error?.includes("3 attempts"), `Unexpected error: ${result.error}`);
});

Deno.test("withRetry: returns immediately on non-retryable 404", async () => {
  const result = await withRetry(always404(), {
    maxAttempts: 3,
    baseDelayMs: 10,
  });
  assertEquals(result.ok, false);
  assertEquals(result.retriesMade, 0); // no retry for 404
  assertEquals(result.lastStatus, 404);
  assert(result.error?.includes("404"));
});

Deno.test("withRetry: retries on network TypeError", async () => {
  let attempts = 0;
  const fn = (signal: AbortSignal): Promise<Response> => {
    attempts++;
    if (attempts < 3) return Promise.reject(new TypeError("fetch failed"));
    return Promise.resolve(new Response("OK", { status: 200 }));
  };
  const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitterMs: 0 });
  assertEquals(result.ok, true);
  assertEquals(attempts, 3);
});

Deno.test("withRetry: respects timeout per attempt", async () => {
  const start = Date.now();
  const result = await withRetry(slowOk(500), {
    maxAttempts: 2,
    baseDelayMs: 10,
    jitterMs: 0,
    timeoutMs: 100, // abort after 100ms
  });
  const elapsed = Date.now() - start;

  assertEquals(result.ok, false);
  // Should not wait for the full 500ms × 2 attempts
  assert(elapsed < 800, `Took too long: ${elapsed}ms — timeout not working`);
});

Deno.test("withRetry: durationMs is populated", async () => {
  const result = await withRetry(alwaysOk(), { maxAttempts: 1, baseDelayMs: 10 });
  assert(typeof result.durationMs === "number");
  assert(result.durationMs >= 0);
});

Deno.test("withRetryText: returns string body on success", async () => {
  const fn = (_signal: AbortSignal) =>
    Promise.resolve(new Response("Hello world", { status: 200 }));
  const result = await withRetryText(fn, { maxAttempts: 1, baseDelayMs: 10 });
  assertEquals(result.ok, true);
  assertEquals(result.value, "Hello world");
});

Deno.test("withRetryText: propagates error on failure", async () => {
  const result = await withRetryText(alwaysThrows(), {
    maxAttempts: 2,
    baseDelayMs: 10,
    jitterMs: 0,
  });
  assertEquals(result.ok, false);
  assert(result.error, "Expected error message");
});

Deno.test("withRetry: maxAttempts=1 means no retries", async () => {
  let calls = 0;
  const fn = (_signal: AbortSignal): Promise<Response> => {
    calls++;
    return Promise.resolve(new Response("Error", { status: 500 }));
  };
  const result = await withRetry(fn, { maxAttempts: 1, baseDelayMs: 10 });
  assertEquals(result.ok, false);
  assertEquals(calls, 1);
  assertEquals(result.retriesMade, 0);
});

Deno.test("withRetry: custom shouldRetryResponse", async () => {
  // Only retry on 503, not 429
  let calls = 0;
  const fn = (_signal: AbortSignal): Promise<Response> => {
    calls++;
    return Promise.resolve(new Response("Rate limited", { status: 429 }));
  };
  const result = await withRetry(fn, {
    maxAttempts: 3,
    baseDelayMs: 10,
    shouldRetryResponse: (res) => res.status === 503, // 429 not retried
  });
  assertEquals(calls, 1); // should not retry
  assertEquals(result.lastStatus, 429);
});

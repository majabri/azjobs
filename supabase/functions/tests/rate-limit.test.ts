/**
 * Unit tests — rate-limit.ts
 *
 * Run with:  deno test tests/rate-limit.test.ts
 */

import {
  assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  checkRateLimit,
  getRemainingQuota,
  resetRateLimit,
} from "../_shared/rate-limit.ts";

const KEY = "test:user-abc";

Deno.test("allows requests under the limit", () => {
  resetRateLimit(KEY);
  assertEquals(checkRateLimit(KEY, 5, 60_000), true);
  assertEquals(checkRateLimit(KEY, 5, 60_000), true);
  assertEquals(checkRateLimit(KEY, 5, 60_000), true);
});

Deno.test("blocks requests over the limit", () => {
  resetRateLimit(KEY);
  for (let i = 0; i < 5; i++) checkRateLimit(KEY, 5, 60_000);
  assertEquals(checkRateLimit(KEY, 5, 60_000), false);
  assertEquals(checkRateLimit(KEY, 5, 60_000), false);
});

Deno.test("getRemainingQuota returns correct count", () => {
  resetRateLimit(KEY);
  assertEquals(getRemainingQuota(KEY, 5, 60_000), 5);
  checkRateLimit(KEY, 5, 60_000); // 1 used
  assertEquals(getRemainingQuota(KEY, 5, 60_000), 4);
  checkRateLimit(KEY, 5, 60_000); // 2 used
  assertEquals(getRemainingQuota(KEY, 5, 60_000), 3);
});

Deno.test("resetRateLimit clears the counter", () => {
  resetRateLimit(KEY);
  for (let i = 0; i < 5; i++) checkRateLimit(KEY, 5, 60_000);
  assertEquals(checkRateLimit(KEY, 5, 60_000), false);
  resetRateLimit(KEY);
  assertEquals(checkRateLimit(KEY, 5, 60_000), true); // new window
});

Deno.test("window resets after windowMs expires", async () => {
  const SHORT_KEY = "test:short-window";
  resetRateLimit(SHORT_KEY);
  // Use a 50ms window
  checkRateLimit(SHORT_KEY, 2, 50);
  checkRateLimit(SHORT_KEY, 2, 50);
  assertEquals(checkRateLimit(SHORT_KEY, 2, 50), false); // over limit

  // Wait for window to expire
  await new Promise((r) => setTimeout(r, 60));

  // Should allow again (new window)
  assertEquals(checkRateLimit(SHORT_KEY, 2, 50), true);
});

Deno.test("different keys are independent", () => {
  const KEY_A = "test:user-x";
  const KEY_B = "test:user-y";
  resetRateLimit(KEY_A);
  resetRateLimit(KEY_B);

  for (let i = 0; i < 3; i++) checkRateLimit(KEY_A, 3, 60_000);
  assertEquals(checkRateLimit(KEY_A, 3, 60_000), false);
  assertEquals(checkRateLimit(KEY_B, 3, 60_000), true); // B is unaffected
});

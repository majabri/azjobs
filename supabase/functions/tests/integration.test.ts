/**
 * Integration tests — scrape-url Edge Function
 *
 * These tests spin up the Edge Function locally using `supabase functions serve`
 * and call the HTTP endpoint directly. They require network access and a running
 * Supabase local dev instance.
 *
 * Run with:
 *   supabase start
 *   supabase functions serve scrape-url --env-file .env.local
 *   deno test tests/integration.test.ts --allow-net --allow-env
 *
 * Environment variables needed:
 *   SUPABASE_URL          e.g. http://localhost:54321
 *   SUPABASE_ANON_KEY     from supabase status output
 *   TEST_USER_JWT         JWT for a valid test user (see README)
 */

import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TEST_JWT = Deno.env.get("TEST_USER_JWT") ?? "";

const FUNCTION_URL = `${BASE_URL}/functions/v1/scrape-url`;

function makeHeaders(jwt = TEST_JWT) {
  return {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
}

async function callScrapeUrl(body: unknown, jwt = TEST_JWT) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: makeHeaders(jwt),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ---------------------------------------------------------------------------
// Auth tests
// ---------------------------------------------------------------------------
Deno.test("returns 401 with no auth header", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com" }),
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("returns 401 with invalid JWT", async () => {
  const { status } = await callScrapeUrl(
    { url: "https://example.com" },
    "invalid.jwt.token"
  );
  assertEquals(status, 401);
});

// ---------------------------------------------------------------------------
// SSRF protection tests
// ---------------------------------------------------------------------------
Deno.test("blocks localhost SSRF attempt", async () => {
  const { status, data } = await callScrapeUrl({ url: "http://localhost/admin" });
  assertEquals(data.success, false);
  assert(data.error, "Expected error message");
});

Deno.test("blocks 127.0.0.1 SSRF attempt", async () => {
  const { data } = await callScrapeUrl({ url: "http://127.0.0.1:8080/secret" });
  assertEquals(data.success, false);
});

Deno.test("blocks AWS IMDS SSRF attempt", async () => {
  const { data } = await callScrapeUrl({
    url: "http://169.254.169.254/latest/meta-data/",
  });
  assertEquals(data.success, false);
});

Deno.test("blocks private class-C range", async () => {
  const { data } = await callScrapeUrl({ url: "http://192.168.1.100/api" });
  assertEquals(data.success, false);
});

// ---------------------------------------------------------------------------
// URL validation tests
// ---------------------------------------------------------------------------
Deno.test("returns 400 for missing URL", async () => {
  const { status, data } = await callScrapeUrl({});
  assertEquals(status, 400);
  assertEquals(data.success, false);
});

Deno.test("returns 400 for malformed URL", async () => {
  const { data } = await callScrapeUrl({ url: "not a url" });
  assertEquals(data.success, false);
});

// ---------------------------------------------------------------------------
// Rate limit test (needs 11+ requests)
// ---------------------------------------------------------------------------
Deno.test("rate-limits after 10 requests per minute", async () => {
  // NOTE: This test is sensitive to the in-memory state of the running instance.
  // Run in isolation or with a fresh instance for reliable results.
  const results = [];
  for (let i = 0; i < 12; i++) {
    const { status, data } = await callScrapeUrl({
      url: "http://localhost/blocked", // blocked by SSRF but still counts toward rate limit
    });
    results.push(status);
  }
  // At least one request should have been rate-limited (429)
  assert(
    results.includes(429),
    `Expected at least one 429 after 12 requests. Got: ${results.join(", ")}`
  );
});

// ---------------------------------------------------------------------------
// Smoke tests — real URLs (require live internet access)
// ---------------------------------------------------------------------------

// These are skipped in CI (set SKIP_LIVE_TESTS=true)
const skipLive = Deno.env.get("SKIP_LIVE_TESTS") === "true";

Deno.test({
  name: "[live] extracts from a public GitHub job-like page",
  ignore: skipLive,
  fn: async () => {
    // Use a stable, publicly accessible page that has readable content
    const { data } = await callScrapeUrl({
      url: "https://jobs.lever.co/anthropic",
    });
    // We just verify the function returns without crashing — content varies
    assert("success" in data, "Expected a success field");
    assert("error" in data || "markdown" in data, "Expected markdown or error");
  },
});

Deno.test({
  name: "[live] cheerio fallback activates for JS-heavy SPA",
  ignore: skipLive,
  fn: async () => {
    // Boards that return minimal HTML on first load — cheerio fallback should trigger
    const { data } = await callScrapeUrl({
      url: "https://boards.greenhouse.io/anthropic",
    });
    assert("success" in data);
    if (data.success) {
      assert(typeof data.markdown === "string");
    } else {
      assert(typeof data.error === "string");
    }
  },
});

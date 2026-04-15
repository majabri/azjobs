/**
 * Unit tests — validate-url.ts
 *
 * Run with:  deno test tests/validate-url.test.ts
 */

import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { validatePublicUrl } from "../_shared/validate-url.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ok(value: unknown) {
  const r = validatePublicUrl(value);
  assertEquals(r.ok, true, `Expected ok=true for ${JSON.stringify(value)}, got: ${r.error}`);
  return r;
}

function fail(value: unknown) {
  const r = validatePublicUrl(value);
  assertEquals(r.ok, false, `Expected ok=false for ${JSON.stringify(value)}`);
  return r;
}

// ---------------------------------------------------------------------------
// Valid URLs
// ---------------------------------------------------------------------------
Deno.test("valid: https job board URL", () => {
  const r = ok("https://boards.greenhouse.io/company/jobs/123");
  assertMatch(r.url, /^https:\/\/boards\.greenhouse\.io/);
});

Deno.test("valid: http LinkedIn URL", () => {
  ok("http://linkedin.com/jobs/view/123456");
});

Deno.test("valid: no scheme — auto-prepends https", () => {
  const r = ok("lever.co/company/apply");
  assertMatch(r.url, /^https:\/\//);
});

Deno.test("valid: standard ports ignored", () => {
  ok("https://example.com:443/job");
  ok("http://example.com:80/job");
});

// ---------------------------------------------------------------------------
// Invalid / blocked URLs
// ---------------------------------------------------------------------------
Deno.test("blocked: localhost", () => {
  fail("http://localhost/api/secret");
});

Deno.test("blocked: 127.0.0.1 loopback", () => {
  fail("http://127.0.0.1/admin");
});

Deno.test("blocked: 127.x.x.x loopback subnet", () => {
  fail("http://127.1.2.3/admin");
});

Deno.test("blocked: 10.x private class A", () => {
  fail("http://10.0.0.5/internal");
});

Deno.test("blocked: 172.16.x private class B", () => {
  fail("http://172.16.0.1/internal");
});

Deno.test("blocked: 192.168.x private class C", () => {
  fail("http://192.168.1.100/job");
});

Deno.test("blocked: 169.254.169.254 AWS IMDS", () => {
  fail("http://169.254.169.254/latest/meta-data/");
});

Deno.test("blocked: metadata.google.internal", () => {
  fail("http://metadata.google.internal/computeMetadata/v1/");
});

Deno.test("blocked: .local mDNS suffix", () => {
  fail("http://myserver.local/jobs");
});

Deno.test("blocked: .internal suffix", () => {
  fail("http://hr.corp.internal/jobs");
});

Deno.test("blocked: IPv6 loopback ::1", () => {
  fail("http://[::1]/admin");
});

Deno.test("blocked: IPv6 unique-local fc00::", () => {
  fail("http://[fc00::1]/api");
});

Deno.test("blocked: IPv6 link-local fe80::", () => {
  fail("http://[fe80::1]/link");
});

Deno.test("blocked: ftp scheme", () => {
  fail("ftp://example.com/file.txt");
});

Deno.test("blocked: file scheme", () => {
  fail("file:///etc/passwd");
});

Deno.test("blocked: non-standard port", () => {
  fail("https://example.com:8080/job");
});

Deno.test("blocked: port 22 (SSH probe)", () => {
  fail("http://example.com:22/");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
Deno.test("rejects: empty string", () => {
  fail("");
});

Deno.test("rejects: null", () => {
  fail(null);
});

Deno.test("rejects: number", () => {
  fail(42);
});

Deno.test("rejects: malformed URL", () => {
  fail("not a url at all!!");
});

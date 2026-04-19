/**
 * Tests for URL normalization and validation utilities.
 */
import { describe, it, expect, vi } from "vitest";
import { isValidURL, sanitizeURL } from "@/lib/platform/urlUtils";

// service.ts imports Supabase; mock it so module loads without env vars
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: { refreshSession: vi.fn(), getSession: vi.fn() },
  },
}));

import { normalizeJobUrl } from "@/services/job/service";

describe("normalizeJobUrl", () => {
  it("returns empty string for null/undefined", () => {
    expect(normalizeJobUrl(null)).toBe("");
    expect(normalizeJobUrl(undefined)).toBe("");
    expect(normalizeJobUrl("")).toBe("");
  });

  it("strips leading/trailing whitespace", () => {
    const result = normalizeJobUrl("  https://example.com/jobs/1  ");
    expect(result).toBe("https://example.com/jobs/1");
  });

  it("adds https:// prefix when missing", () => {
    const result = normalizeJobUrl("example.com/jobs/1");
    expect(result).toContain("https://example.com");
  });

  it("strips trailing punctuation", () => {
    const result = normalizeJobUrl("https://example.com/jobs/1.");
    expect(result).not.toMatch(/\.$/);
  });

  it("removes UTM tracking parameters", () => {
    const result = normalizeJobUrl("https://example.com/jobs/1?utm_source=linkedin&utm_campaign=test");
    expect(result).not.toContain("utm_source");
    expect(result).not.toContain("utm_campaign");
  });

  it("removes gclid tracking parameter", () => {
    const result = normalizeJobUrl("https://example.com/jobs/1?gclid=abc123");
    expect(result).not.toContain("gclid");
  });

  it("strips fragment (#section)", () => {
    const result = normalizeJobUrl("https://example.com/jobs/1#apply");
    expect(result).not.toContain("#apply");
  });

  it("removes quote characters from URL", () => {
    const result = normalizeJobUrl(`"https://example.com/jobs/1"`);
    expect(result).not.toContain('"');
  });

  it("returns empty string for placeholder hostnames", () => {
    expect(normalizeJobUrl("https://placeholder/jobs/1")).toBe("");
  });

  it("returns valid https URL unchanged (except fragment strip)", () => {
    const url = "https://jobs.lever.co/company/abc-123";
    expect(normalizeJobUrl(url)).toBe(url);
  });
});

describe("isValidURL", () => {
  it("returns true for valid https URL", () => {
    expect(isValidURL("https://example.com")).toBe(true);
  });

  it("returns true for valid http URL", () => {
    expect(isValidURL("http://example.com/path")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidURL("")).toBe(false);
  });

  it("returns false for plain text with spaces", () => {
    expect(isValidURL("not a url here")).toBe(false);
  });

  it("accepts URLs without explicit protocol (protocol is optional in pattern)", () => {
    // isValidURL pattern has (https?://)? making it optional
    expect(isValidURL("example.com/path")).toBe(true);
  });
});

describe("sanitizeURL", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeURL("")).toBe("");
  });

  it("returns valid URL unchanged", () => {
    const url = "https://example.com/jobs/1";
    expect(sanitizeURL(url)).toBe(url);
  });

  it("returns empty string for non-URL input", () => {
    expect(sanitizeURL("not a url at all")).toBe("");
  });
});

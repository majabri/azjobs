/**
 * Tests for job service URL normalization (pure function, no Supabase needed).
 */
import { describe, it, expect, vi } from "vitest";

// Mock Supabase so service.ts can be imported without real env vars
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    auth: { refreshSession: vi.fn(), getSession: vi.fn() },
  },
}));

import { normalizeJobUrl } from "@/services/job/service";

describe("normalizeJobUrl", () => {
  it("returns empty string for null", () => {
    expect(normalizeJobUrl(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeJobUrl(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeJobUrl("")).toBe("");
  });

  it("prepends https:// when protocol is missing", () => {
    const result = normalizeJobUrl("jobs.example.com/position/123");
    expect(result).toContain("https://jobs.example.com");
  });

  it("preserves valid https URLs", () => {
    const url = "https://jobs.lever.co/company/abc-def-123";
    expect(normalizeJobUrl(url)).toBe(url);
  });

  it("strips UTM parameters", () => {
    const url = "https://example.com/job?utm_source=linkedin&utm_medium=social";
    const result = normalizeJobUrl(url);
    expect(result).not.toContain("utm_source");
    expect(result).not.toContain("utm_medium");
  });

  it("strips fbclid tracking parameter", () => {
    const result = normalizeJobUrl("https://example.com/job?fbclid=xyz");
    expect(result).not.toContain("fbclid");
  });

  it("strips fragment identifier", () => {
    const result = normalizeJobUrl("https://example.com/job/123#section-apply");
    expect(result).not.toContain("#section-apply");
  });

  it("removes surrounding quotes", () => {
    const result = normalizeJobUrl(`'https://example.com/job/1'`);
    expect(result).not.toContain("'");
    expect(result).toContain("example.com");
  });

  it("strips trailing periods and semicolons", () => {
    const result = normalizeJobUrl("https://example.com/job/1;");
    expect(result).not.toMatch(/;$/);
  });

  it("handles redirect param unwrapping", () => {
    const inner = "https://example.com/real-job";
    const outer = `https://redirect.com?url=${encodeURIComponent(inner)}`;
    const result = normalizeJobUrl(outer);
    expect(result).toBe(inner);
  });

  it("returns empty string for placeholder hostname", () => {
    expect(normalizeJobUrl("https://placeholder.example/job")).toBe("");
  });
});

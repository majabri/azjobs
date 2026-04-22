/**
 * Tests for JobCard helper logic (extracted from JobSearch.tsx in Phase 3).
 * These test pure functions that don't need DOM or React.
 */
import { describe, it, expect } from "vitest";

// ── Helpers replicated from JobCard.tsx for testability ───────────────────────
// (pure functions — no JSX, no DOM)

function parseSalaryNumber(salary: string): number | null {
  const match = salary.replace(/,/g, "").match(/(\d+)/g);
  if (!match) return null;
  const nums = match.map(Number);
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return nums[0];
}

const MARKET_BENCHMARKS: Record<string, number> = {
  entry: 65000,
  junior: 75000,
  mid: 105000,
  senior: 140000,
  lead: 165000,
  staff: 185000,
  principal: 210000,
  director: 195000,
  vp: 230000,
};

function estimateMarketRate(title: string): number {
  const lower = title.toLowerCase();
  for (const [key, val] of Object.entries(MARKET_BENCHMARKS)) {
    if (lower.includes(key)) return val;
  }
  if (lower.includes("engineer") || lower.includes("developer")) return 120000;
  if (lower.includes("manager")) return 130000;
  if (lower.includes("analyst")) return 90000;
  if (lower.includes("designer")) return 100000;
  return 100000;
}

// ── parseSalaryNumber ─────────────────────────────────────────────────────────
describe("parseSalaryNumber", () => {
  it("parses a single number", () => {
    expect(parseSalaryNumber("120000")).toBe(120000);
  });

  it("strips commas before parsing", () => {
    expect(parseSalaryNumber("120,000")).toBe(120000);
  });

  it("averages a salary range", () => {
    expect(parseSalaryNumber("100,000 – 140,000")).toBe(120000);
  });

  it("returns null for non-numeric strings", () => {
    expect(parseSalaryNumber("TBD")).toBeNull();
    expect(parseSalaryNumber("")).toBeNull();
  });

  it("handles k-style notation by extracting digits", () => {
    // "120k" → digits: ["120"] → 120 (not 120000, intentional — display only)
    expect(parseSalaryNumber("120k")).toBe(120);
  });
});

// ── estimateMarketRate ────────────────────────────────────────────────────────
describe("estimateMarketRate", () => {
  it("returns senior rate for a senior title", () => {
    expect(estimateMarketRate("Senior Security Engineer")).toBe(140000);
  });

  it("returns director rate", () => {
    expect(estimateMarketRate("Engineering Director")).toBe(195000);
  });

  it("falls back to engineer rate for generic engineer title", () => {
    expect(estimateMarketRate("Software Engineer")).toBe(120000);
  });

  it("falls back to analyst rate", () => {
    expect(estimateMarketRate("Data Analyst")).toBe(90000);
  });

  it("falls back to default rate for unknown title", () => {
    expect(estimateMarketRate("Chief Happiness Officer")).toBe(100000);
  });

  it("is case-insensitive", () => {
    expect(estimateMarketRate("SENIOR DEVELOPER")).toBe(140000);
  });
});

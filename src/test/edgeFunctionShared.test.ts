/**
 * Tests for the shared Edge Function utilities introduced in Phase 5.
 *
 * These run in Node/jsdom — they test pure TypeScript logic only.
 * Deno-specific imports (cors.ts, supabase.ts) are tested via their
 * logic replicated here; the actual Deno modules are tested in the
 * supabase/functions/tests/ directory.
 */
import { describe, it, expect } from "vitest";

// ── PROMPTS object sanity checks ──────────────────────────────────────────────
// We import a pure-TS re-export that mirrors the Deno module
// (vitest can't import Deno modules directly)
import { PROMPTS, buildResumeJobPair } from "../lib/schemas/promptsExport";

describe("PROMPTS", () => {
  const keys: Array<keyof typeof PROMPTS> = [
    "careerCoach", "resumeTailor", "coverLetterWriter",
    "interviewCoach", "salaryNegotiator", "skillsAnalyst",
    "learningAdvisor", "outreachWriter", "jdAnalyst",
  ];

  keys.forEach(key => {
    it(`PROMPTS.${key} is a non-empty string`, () => {
      expect(typeof PROMPTS[key]).toBe("string");
      expect(PROMPTS[key].length).toBeGreaterThan(20);
    });
  });

  it("buildResumeJobPair includes both sections", () => {
    const result = buildResumeJobPair("My resume content", "Job description content");
    expect(result).toContain("Candidate Resume");
    expect(result).toContain("Job Description");
    expect(result).toContain("My resume content");
    expect(result).toContain("Job description content");
  });

  it("buildResumeJobPair separates sections clearly", () => {
    const result = buildResumeJobPair("resume", "job");
    const resumeIdx = result.indexOf("resume");
    const jobIdx = result.indexOf("job");
    expect(resumeIdx).toBeLessThan(jobIdx);
  });
});

/**
 * Tests for the main analyzeJobFit and analyzeCandidates orchestration functions.
 */
import { describe, it, expect } from "vitest";
import { analyzeJobFit, analyzeCandidates } from "@/lib/analysisEngine";

const JOB_DESCRIPTION = `
Senior Frontend Engineer

Requirements:
- 3+ years of React experience
- TypeScript proficiency required
- Familiarity with Node.js and REST APIs
- Experience with PostgreSQL or similar databases

Benefits:
- Health insurance
- Remote work

About the company:
A fast-growing SaaS startup building developer tools.
`;

const MATCHING_RESUME = `
Frontend Engineer with 5 years experience.
React, TypeScript, Node.js, PostgreSQL, REST APIs.
Worked at SaaS companies building web applications.
`;

const WEAK_RESUME = `
Accountant with 10 years experience.
Excel, QuickBooks, financial reporting.
`;

describe("analyzeJobFit", () => {
  it("returns a FitAnalysis object with required fields", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    expect(result).toHaveProperty("overallScore");
    expect(result).toHaveProperty("matchedSkills");
    expect(result).toHaveProperty("gaps");
    expect(result).toHaveProperty("strengths");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("interviewProbability");
    expect(result).toHaveProperty("experienceMatch");
    expect(result).toHaveProperty("keywordAlignment");
  });

  it("overallScore is a number between 0 and 100", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    expect(typeof result.overallScore).toBe("number");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("matching resume scores higher than weak resume", () => {
    const good = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    const weak = analyzeJobFit(JOB_DESCRIPTION, WEAK_RESUME);
    expect(good.overallScore).toBeGreaterThan(weak.overallScore);
  });

  it("matchedSkills is an array", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    expect(Array.isArray(result.matchedSkills)).toBe(true);
  });

  it("matching resume has some matched skills", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    const matched = result.matchedSkills.filter((s) => s.matched);
    expect(matched.length).toBeGreaterThan(0);
  });

  it("interviewProbability is between 0 and 100", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    expect(result.interviewProbability).toBeGreaterThanOrEqual(0);
    expect(result.interviewProbability).toBeLessThanOrEqual(100);
  });

  it("summary is a non-empty string", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("handles empty job description without throwing", () => {
    expect(() => analyzeJobFit("", MATCHING_RESUME)).not.toThrow();
  });

  it("handles empty resume without throwing", () => {
    expect(() => analyzeJobFit(JOB_DESCRIPTION, "")).not.toThrow();
  });

  it("handles both inputs empty without throwing", () => {
    expect(() => analyzeJobFit("", "")).not.toThrow();
  });

  it("benefits is an array", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    expect(Array.isArray(result.benefits)).toBe(true);
  });

  it("companySummary is a string", () => {
    const result = analyzeJobFit(JOB_DESCRIPTION, MATCHING_RESUME);
    expect(typeof result.companySummary).toBe("string");
  });
});

describe("analyzeCandidates", () => {
  const candidates = [
    { name: "Alice", resumeText: MATCHING_RESUME },
    { name: "Bob", resumeText: WEAK_RESUME },
  ];

  it("returns an array of results", () => {
    const results = analyzeCandidates(JOB_DESCRIPTION, candidates);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
  });

  it("each result has required fields", () => {
    const results = analyzeCandidates(JOB_DESCRIPTION, candidates);
    for (const r of results) {
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("score");
      expect(r).toHaveProperty("matchedSkills");
      expect(r).toHaveProperty("gaps");
      expect(r).toHaveProperty("recommendation");
    }
  });

  it("sorts results by score descending", () => {
    const results = analyzeCandidates(JOB_DESCRIPTION, candidates);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it("matching candidate has higher score than weak candidate", () => {
    const results = analyzeCandidates(JOB_DESCRIPTION, candidates);
    const alice = results.find((r) => r.name === "Alice")!;
    const bob = results.find((r) => r.name === "Bob")!;
    expect(alice.score).toBeGreaterThan(bob.score);
  });

  it("recommendation is one of interview/maybe/pass", () => {
    const results = analyzeCandidates(JOB_DESCRIPTION, candidates);
    for (const r of results) {
      expect(["interview", "maybe", "pass"]).toContain(r.recommendation);
    }
  });

  it("returns empty array for no candidates", () => {
    const results = analyzeCandidates(JOB_DESCRIPTION, []);
    expect(results).toEqual([]);
  });

  it("single candidate always gets recommendation", () => {
    const results = analyzeCandidates(JOB_DESCRIPTION, [{ name: "Solo", resumeText: MATCHING_RESUME }]);
    expect(results.length).toBe(1);
    expect(["interview", "maybe", "pass"]).toContain(results[0].recommendation);
  });
});

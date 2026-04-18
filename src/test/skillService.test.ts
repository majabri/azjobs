/**
 * Tests for skill extraction and overlap scoring (exposed via analysisEngine).
 */
import { describe, it, expect } from "vitest";
import {
  extractKeywords,
  extractSkillsFromText,
  scoreOverlap,
} from "@/lib/analysisEngine";

describe("extractKeywords", () => {
  it("returns an array for empty input", () => {
    expect(Array.isArray(extractKeywords(""))).toBe(true);
  });

  it("extracts recognisable tech keywords", () => {
    const keywords = extractKeywords("Looking for a React developer with TypeScript and Node.js experience");
    const lower = keywords.map((k: string) => k.toLowerCase());
    expect(lower.some((k: string) => k.includes("react") || k.includes("typescript") || k.includes("node"))).toBe(true);
  });

  it("returns unique keywords (no duplicates)", () => {
    const keywords = extractKeywords("python python developer python");
    const lower = keywords.map((k: string) => k.toLowerCase());
    const unique = new Set(lower);
    expect(unique.size).toBe(keywords.length);
  });
});

describe("extractSkillsFromText", () => {
  it("returns an array", () => {
    expect(Array.isArray(extractSkillsFromText("react typescript node"))).toBe(true);
  });

  it("extracts known skills from job description", () => {
    const skills = extractSkillsFromText("We need React, TypeScript, and PostgreSQL skills");
    const lower = skills.map((s: string) => s.toLowerCase());
    expect(lower.some((s: string) => ["react", "typescript", "postgresql"].includes(s))).toBe(true);
  });

  it("returns array (possibly empty) for input with no skills", () => {
    const skills = extractSkillsFromText("The quick brown fox jumps");
    expect(Array.isArray(skills)).toBe(true);
  });
});

describe("scoreOverlap", () => {
  it("returns 0 when there is no overlap", () => {
    const score = scoreOverlap(["react", "typescript"], ["python", "django"]);
    expect(score).toBe(0);
  });

  it("returns max score (98) when all job keywords match resume", () => {
    const score = scoreOverlap(["react", "typescript"], ["react", "typescript", "node"]);
    // Implementation caps score at 98 to avoid false-perfect scores
    expect(score).toBe(98);
  });

  it("returns a value between 0 and 100 for partial overlap", () => {
    const score = scoreOverlap(["react", "typescript", "node"], ["react", "python"]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("returns baseline score (65) for empty job keywords", () => {
    // Implementation returns 65 as a neutral baseline when no job keywords exist
    expect(scoreOverlap([], ["react", "typescript"])).toBe(65);
  });

  it("returns 0 when resume keywords are empty", () => {
    expect(scoreOverlap(["react"], [])).toBe(0);
  });

  it("returns a valid number (not NaN)", () => {
    expect(isNaN(scoreOverlap(["a"], ["a"]))).toBe(false);
  });
});

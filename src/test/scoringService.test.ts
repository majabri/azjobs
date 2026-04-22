import { describe, it, expect, vi } from "vitest";
import {
  buildSkillMatches,
  buildGaps,
  buildImprovementPlan,
  buildSummary,
  computeExperienceMatch,
  buildTopActions,
} from "../lib/services/scoringService";

describe("scoringService", () => {
  describe("buildSkillMatches", () => {
    it("should correctly identify matched and unmatched skills", () => {
      const jobKeywords = ["react", "typescript", "kubernetes"];
      const resumeKeywords = ["react", "node", "typescript"];

      const matches = buildSkillMatches(jobKeywords, resumeKeywords);

      expect(matches).toHaveLength(3);
      expect(matches.find((m) => m.skill === "React")?.matched).toBe(true);
      expect(matches.find((m) => m.skill === "Typescript")?.matched).toBe(true);
      expect(matches.find((m) => m.skill === "Kubernetes")?.matched).toBe(
        false,
      );

      // Confidence checks
      expect(
        matches.find((m) => m.skill === "React")?.confidence,
      ).toBeGreaterThanOrEqual(70);
      expect(matches.find((m) => m.skill === "Kubernetes")?.confidence).toBe(0);
    });
  });

  describe("buildGaps", () => {
    it("should generate structured gaps for unmatched skills", () => {
      const matches = [
        {
          skill: "AWS",
          matched: false,
          confidence: 0,
          context: "",
          category: "Cloud",
        },
        {
          skill: "Docker",
          matched: false,
          confidence: 0,
          context: "",
          category: "Cloud",
        },
        {
          skill: "React",
          matched: true,
          confidence: 80,
          context: "",
          category: "Frontend",
        },
        {
          skill: "Jest",
          matched: false,
          confidence: 0,
          context: "",
          category: "Testing",
        },
        {
          skill: "CSS",
          matched: false,
          confidence: 0,
          context: "",
          category: "Frontend",
        },
        {
          skill: "Figma",
          matched: false,
          confidence: 0,
          context: "",
          category: "Design",
        },
        {
          skill: "SQL",
          matched: false,
          confidence: 0,
          context: "",
          category: "Backend",
        },
      ];

      const gaps = buildGaps(matches);

      // Should cap at 5 gaps
      expect(gaps).toHaveLength(5);

      // Verify severity scaling
      expect(gaps[0].severity).toBe("critical");
      expect(gaps[1].severity).toBe("moderate");
      expect(gaps[2].severity).toBe("moderate");
      expect(gaps[3].severity).toBe("minor");

      // Verify resources attached
      expect(gaps[0].resources?.length).toBeGreaterThan(0);
    });
  });

  describe("buildImprovementPlan", () => {
    it("should map gaps to a week-by-week plan", () => {
      const gaps = buildGaps([
        {
          skill: "AWS",
          matched: false,
          confidence: 0,
          context: "",
          category: "Cloud",
        },
      ]);
      const plan = buildImprovementPlan(gaps);

      expect(plan).toHaveLength(4);
      expect(plan[0].action).toContain("AWS");
      expect(plan[1].week).toContain("Week 3–4");
    });
  });

  describe("buildSummary", () => {
    it("should provide appropriate summary strings based on score", () => {
      expect(buildSummary(80, 2)).toContain("strong match");
      expect(buildSummary(60, 4)).toContain("solid foundation");
      expect(buildSummary(30, 8)).toContain("roadmap");
    });
  });

  describe("computeExperienceMatch", () => {
    it("should penalize score for extreme job level mismatches", () => {
      // Junior applying to Executive
      const match1 = computeExperienceMatch(
        "Chief Technology Officer",
        "Entry-level developer intern",
      );
      expect(match1).toBeLessThan(50);

      // Senior applying to Senior
      const match2 = computeExperienceMatch(
        "Senior Engineer",
        "Senior Developer",
      );
      expect(match2).toBeGreaterThan(80);
    });
  });

  describe("buildTopActions", () => {
    it("should return the top 3 targeted actions to fix extreme gaps", () => {
      const gaps = buildGaps([
        {
          skill: "Security Architecture",
          matched: false,
          confidence: 0,
          context: "",
          category: "Cybersecurity",
        },
      ]);
      const actions = buildTopActions(gaps, 50, 40, "Senior");

      expect(actions).toHaveLength(3);
      expect(actions[0]).toContain("Security Architecture");
      expect(actions[1]).toContain("Senior-level achievements");
      expect(actions[2]).toContain("AI optimizer");
    });
  });
});

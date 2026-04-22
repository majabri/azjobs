import { describe, it, expect } from "vitest";
import {
  detectCareerLevel,
  extractJobTitles,
  extractProfileFromResume,
} from "../lib/services/careerService";

describe("careerService", () => {
  describe("detectCareerLevel", () => {
    it("should correctly detect entry-level thresholds", () => {
      expect(
        detectCareerLevel(
          "We are seeking an energetic intern to join our team.",
        ),
      ).toBe("Entry-Level / Junior");
      expect(
        detectCareerLevel(
          "Looking for a candidate with no prior experience for this junior role.",
        ),
      ).toBe("Entry-Level / Junior");
    });

    it("should correctly detect C-Level over senior conflicts", () => {
      expect(
        detectCareerLevel(
          "We are hiring a new Chief Technology Officer (CTO) to oversee our senior engineers.",
        ),
      ).toBe("C-Level / Executive");
    });

    it("should fall back to Mid-Level if no clear indicators exist", () => {
      expect(
        detectCareerLevel(
          "Looking for someone with great communication skills and HTML/CSS.",
        ),
      ).toBe("Mid-Level");
    });

    it("should properly identify VP and Directors", () => {
      expect(detectCareerLevel("Vice President of Engineering")).toBe(
        "VP / Senior Leadership",
      );
      expect(detectCareerLevel("Managing Director of Sales")).toBe("Director");
    });
  });

  describe("extractJobTitles", () => {
    it("should expand known acronyms like CISO correctly", () => {
      const titles = extractJobTitles("Required: 3+ years as a CISO or BISO.");
      expect(titles).toContain("Chief Information Security Officer");
      expect(titles).toContain("Business Information Security Officer");
    });

    it("should lift distinct titles from header bullets", () => {
      const text = "Senior Backend Developer\nInfrastructure Engineer";
      const titles = extractJobTitles(text);
      expect(titles).toContain("Senior Backend Developer");
      expect(titles).toContain("Infrastructure Engineer");
    });

    it("should parse compound titles correctly", () => {
      const text = "Currently serving as Vice President of Global Strategy";
      const titles = extractJobTitles(text);
      expect(
        titles.some(
          (t) => t.toLowerCase() === "vice president of global strategy",
        ),
      ).toBe(true);
    });
  });

  describe("extractProfileFromResume", () => {
    it("should seamlessly compose skills, levels, and titles into a unified profile", () => {
      const resume = `
        Jane Doe
        Senior Technical Program Manager
        Certifications: CISSP, PMP
        
        Experience:
        - Built a python backend
        - Worked with AWS and kubernetes
      `;

      const profile = extractProfileFromResume(resume);

      expect(profile.careerLevel).toBe("Manager");
      expect(profile.jobTitles).toContain("Senior Technical Program Manager");
      expect(profile.certifications.map((c) => c.toUpperCase())).toContain(
        "CISSP",
      );
      expect(profile.certifications.map((c) => c.toUpperCase())).toContain(
        "PMP",
      );
      expect(profile.skills.map((s) => s.toLowerCase())).toEqual(
        expect.arrayContaining(["python", "aws", "kubernetes"]),
      );
    });
  });
});

import { describe, it, expect } from "vitest";
import { extractBenefits } from "../lib/services/benefitsService";

describe("benefitsService", () => {
  describe("extractBenefits", () => {
    it("should correctly identify standard benefits from text blocks", () => {
      const fullJobText = "We offer a competitive salary, 401(k) matching, and generous paid time off.";
      const benefitsSectionText = "- 401(k)\n- Paid time off";
      
      const benefits = extractBenefits(fullJobText, benefitsSectionText);
      
      const categories = benefits.map(b => b.category);
      expect(categories).toContain("retirement_401k");
      expect(categories).toContain("pto");
    });

    it("should fall back to scanning full text if benefits section is empty", () => {
      const fullJobText = `Join us!
      We offer a $120,000 base salary.
      We provide medical insurance.
      Also flexible hours.`;
      const benefitsSectionText = "";
      
      const benefits = extractBenefits(fullJobText, benefitsSectionText);
      
      const categories = benefits.map(b => b.category);
      expect(categories).toContain("health_insurance");
      expect(categories).toContain("flexible_hours");
      expect(categories).toContain("salary");
    });

    it("should extract salary metadata if a valid range string is provided", () => {
      const fullJobText = "Base salary is $150k - $200k/year depending on experience.";
      const benefitsSectionText = "";
      
      const benefits = extractBenefits(fullJobText, benefitsSectionText);
      const salary = benefits.find(b => b.category === "salary");
      
      expect(salary).toBeDefined();
      expect(salary?.metadata?.range).toBe("$150k - $200k/year");
    });

    it("should correctly bypass exclusion patterns disguised as benefits", () => {
      const fullJobText = "You must have 5+ years of experience with medical insurance billing software.";
      // "medical insurance" is matched by health_insurance regex, but the line contains "years of experience with"
      const benefits = extractBenefits(fullJobText, "");
      
      expect(benefits.find(b => b.category === "health_insurance")).toBeUndefined();
    });

    it("should not crash when handed empty buffers", () => {
      expect(extractBenefits("", "")).toHaveLength(0);
    });
  });
});

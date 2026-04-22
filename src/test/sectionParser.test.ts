import { describe, it, expect } from "vitest";
import { parseJobSections } from "../lib/services/sectionParser";

describe("sectionParser", () => {
  describe("parseJobSections", () => {
    it("should split standard job descriptions into distinct blocks", () => {
      const text = `
        SOFTWARE ENGINEER LEVEL 2
        We are a great team doing great things.

        REQUIREMENTS
        - Must have React
        - Must have Node

        BENEFITS AND PERKS
        - 401(k)
        - Unlimited PTO
        
        ABOUT US
        We are an established company.
      `;

      const parsed = parseJobSections(text);
      expect(parsed.requirementsText).toContain("Must have React");
      expect(parsed.requirementsText).toContain("Must have Node");
      expect(parsed.requirementsText).not.toContain("401(k)");

      expect(parsed.benefitsText).toContain("Unlimited PTO");
      expect(parsed.benefitsText).not.toContain("Must have Node");

      expect(parsed.companyText).toContain("established company");
    });

    it("should capture everything into requirements if no headers exist except for company/benefits", () => {
      const text = `
        We are looking for a developer.
        You will build things.
        
        ABOUT US
        We rock.
      `;
      // 'We are looking for a developer. You will build things.' falls into 'other' section initially
      // Then `reqSections.length > 0 ? ... : sections.filter(...)` groups 'other' into requirementsText
      const parsed = parseJobSections(text);
      expect(parsed.requirementsText).toContain("You will build things.");
      expect(parsed.companyText).toContain("We rock.");
    });

    it("should handle formatting variants like markdown hashtags and colons", () => {
      const text = `
        ### Qualifications:
        - CSS

        **What We Offer:**
        - Free lunch
      `;
      const parsed = parseJobSections(text);
      expect(parsed.requirementsText).toContain("CSS");
      expect(parsed.benefitsText).toContain("Free lunch");
    });

    it("should safely truncate excessively massive benefit sections", () => {
      const text = "Benefits\n" + "- Money\n".repeat(200);
      const parsed = parseJobSections(text);
      expect(parsed.benefitsText.length).toBeLessThanOrEqual(1500);
    });
  });
});

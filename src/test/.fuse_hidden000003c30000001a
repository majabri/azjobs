import { describe, it, expect } from "vitest";
import { extractCompanySection } from "../lib/services/companyService";

describe("companyService", () => {
  describe("extractCompanySection", () => {
    it("should extract company bios constrained between headers", () => {
      const text = `
        About The Company
        We are a leading GenAI firm building the next generation of LLMs.
        Founded in 2024, our mission is to empower developers.

        Responsibilities
        - Build things
        - Write code
      `;
      
      const companyText = extractCompanySection(text);
      expect(companyText).toContain("We are a leading GenAI firm");
      expect(companyText).toContain("empower developers.");
      expect(companyText).not.toContain("Responsibilities");
      expect(companyText).not.toContain("Build things");
    });

    it("should filter out stray noisy requirements lines that leak into the company bio", () => {
      const text = `
        About Us
        We build fast web apps.
        We are an equal opportunity employer.
        Must have 10 years of experience.
        Our team spans the globe.
      `;
      
      const companyText = extractCompanySection(text);
      expect(companyText).toContain("We build fast web apps.");
      expect(companyText).toContain("Our team spans the globe.");
      // Excluded via COMPANY_EXCLUSION_PATTERNS
      expect(companyText.toLowerCase()).not.toContain("equal opportunity");
      expect(companyText.toLowerCase()).not.toContain("must have");
    });

    it("should fall back to semantic sentence-level extraction if there is no header", () => {
      const text = `
        Looking for a Senior Developer.
        We are a fast-growing startup in the fintech space. Our goal is to democratize banking. We believe in open finance.
        Please apply now. You will be responsible for the architecture.
      `;
      
      const companyText = extractCompanySection(text);
      expect(companyText).toContain("We are a fast-growing startup in the fintech space.");
      expect(companyText).toContain("We believe in open finance.");
      expect(companyText).not.toContain("Please apply now.");
      expect(companyText).not.toContain("responsible for");
    });

    it("should enforce a hard length limit on massive company payloads", () => {
      const massiveText = "About Us\n" + "We are great. ".repeat(200);
      const companyText = extractCompanySection(massiveText);
      expect(companyText.length).toBeLessThanOrEqual(1200);
    });
  });
});

import { describe, it, expect } from "vitest";
import { detectCareerLevel, extractJobTitles, extractProfileFromResume } from "@/lib/analysisEngine";

const SAMPLE_RESUME = `
AMIR JABRI
VP of IT and Cybersecurity | BISO | Security Architect
Detroit, MI

Experience:

Vice President of IT and Cybersecurity
Major Corp — 2020–Present
- Led enterprise security strategy across 3 business units
- Managed $5M annual security budget

Business Information Security Officer (BISO)
Another Corp — 2017–2020
- Drove GRC initiatives and compliance programs

Senior Security Architect
TechCo — 2014–2017
- Designed zero trust architecture

Skills: CISSP, Risk Management, Cloud Security, Cybersecurity, Leadership
`;

describe("Career Level Detection", () => {
  it("detects VP / Senior Leadership from VP title", () => {
    expect(detectCareerLevel(SAMPLE_RESUME)).toBe("VP / Senior Leadership");
  });

  it("detects C-Level from CISO", () => {
    expect(detectCareerLevel("Chief Information Security Officer at Corp")).toBe("C-Level / Executive");
  });

  it("detects VP from BISO alone", () => {
    expect(detectCareerLevel("BISO at Corp")).toBe("VP / Senior Leadership");
  });
});

describe("Job Title Extraction", () => {
  it("extracts VP, BISO, and Security Architect titles", () => {
    const titles = extractJobTitles(SAMPLE_RESUME);
    const titlesLower = titles.map(t => t.toLowerCase());
    
    expect(titlesLower.some(t => t.includes("vice president") || t.includes("vp"))).toBe(true);
    expect(titlesLower.some(t => t.includes("security architect"))).toBe(true);
  });

  it("expands BISO acronym", () => {
    const titles = extractJobTitles("BISO at Global Corp");
    expect(titles.some(t => t.includes("Business Information Security Officer"))).toBe(true);
  });
});

describe("Full Profile Extraction", () => {
  it("extracts career level and titles together", () => {
    const profile = extractProfileFromResume(SAMPLE_RESUME);
    expect(profile.careerLevel).toBe("VP / Senior Leadership");
    expect(profile.jobTitles.length).toBeGreaterThan(0);
    expect(profile.skills.length).toBeGreaterThan(0);
    expect(profile.certifications.length).toBeGreaterThan(0);
  });
});

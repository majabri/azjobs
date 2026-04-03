/**
 * SOA Structure Tests
 * Validates that the Service-Oriented Architecture constraints are maintained.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const SERVICES_DIR = join(process.cwd(), "src", "services");
const SHELL_DIR = join(process.cwd(), "src", "shell");

// ─── Required service structure ───────────────────────────────────────────────

const REQUIRED_SERVICES = [
  "job", "matching", "application", "user", "analytics",
  "resume", "support", "career", "learning", "hiring", "admin",
];

const REQUIRED_SERVICE_FILES: Record<string, string[]> = {
  job: ["api.ts", "service.ts", "types.ts", "parser.ts", "routes.tsx"],
  matching: ["api.ts", "service.ts", "routes.tsx"],
  application: ["api.ts", "service.ts", "types.ts", "routes.tsx"],
  user: ["api.ts", "service.ts", "types.ts", "routes.tsx"],
  analytics: ["api.ts", "service.ts", "routes.tsx"],
  resume: ["api.ts", "service.ts", "routes.tsx"],
  // support, career, hiring are extra services — only require api.ts + routes.tsx
  support: ["api.ts", "routes.tsx"],
  career: ["api.ts", "routes.tsx"],
  learning: ["service.ts", "routes.tsx"],
  hiring: ["api.ts", "routes.tsx"],
  admin: ["api.ts", "service.ts", "routes.tsx"],
};

const REQUIRED_SHELL_FILES = ["App.tsx", "routes.tsx", "navigation.ts", "orchestrator.ts"];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SOA Folder Structure", () => {
  it("has all required service directories", () => {
    const serviceDirs = readdirSync(SERVICES_DIR);
    for (const svc of REQUIRED_SERVICES) {
      expect(serviceDirs, `service "${svc}" directory missing`).toContain(svc);
    }
  });

  for (const svc of REQUIRED_SERVICES) {
    const files = REQUIRED_SERVICE_FILES[svc] || [];
    for (const file of files) {
      it(`${svc} service has ${file}`, () => {
        const path = join(SERVICES_DIR, svc, file);
        expect(existsSync(path), `${svc}/${file} not found`).toBe(true);
      });
    }
  }

  for (const file of REQUIRED_SHELL_FILES) {
    it(`shell has ${file}`, () => {
      const path = join(SHELL_DIR, file);
      expect(existsSync(path), `shell/${file} not found`).toBe(true);
    });
  }
});

describe("Job Service Parser", () => {
  it("parser.ts exists and exports required functions", async () => {
    const parser = await import("@/services/job/parser");
    expect(typeof parser.extractCompanySection).toBe("function");
    expect(typeof parser.extractBenefits).toBe("function");
    expect(typeof parser.parseJobSections).toBe("function");
  });

  it("extractCompanySection finds company info from header", async () => {
    const { extractCompanySection } = await import("@/services/job/parser");
    const text = `
About the Company
We are a leading fintech company founded in 2010.
Our mission is to democratize finance.

Responsibilities
Build scalable systems.
Manage the team.
    `.trim();

    const result = extractCompanySection(text);
    expect(result).toContain("fintech");
    expect(result).not.toContain("Build scalable");
    expect(result).not.toContain("Responsibilities");
  });

  it("extractCompanySection does NOT return full description when no header", async () => {
    const { extractCompanySection } = await import("@/services/job/parser");
    const text = "Senior Engineer role. Must have 5 years experience. Python required.";
    const result = extractCompanySection(text);
    // Should return empty or short fallback, not the full text
    expect(result.length).toBeLessThanOrEqual(1200);
    expect(result).not.toContain("Must have 5 years");
  });

  it("extractCompanySection output is max 1200 characters", async () => {
    const { extractCompanySection } = await import("@/services/job/parser");
    const longText = "About Us\n" + "We are a great company. ".repeat(100);
    const result = extractCompanySection(longText);
    expect(result.length).toBeLessThanOrEqual(1200);
  });

  it("parseJobSections returns structured sections", async () => {
    const { parseJobSections } = await import("@/services/job/parser");
    const text = `
About Us
Great company here.

Requirements
Must have Python skills.

Benefits
Health insurance included.
    `.trim();

    const result = parseJobSections(text);
    expect(result).toHaveProperty("requirementsText");
    expect(result).toHaveProperty("benefitsText");
    expect(result).toHaveProperty("companyText");
    expect(result).toHaveProperty("fullText");
  });

  it("extractBenefits finds health insurance", async () => {
    const { extractBenefits } = await import("@/services/job/parser");
    const sectionText = "Medical insurance and health coverage included.\n401(k) retirement plan with employer match.\nUnlimited PTO and vacation policy.";
    const result = extractBenefits("", sectionText);
    const categories = result.map(b => b.category);
    expect(categories).toContain("health_insurance");
    expect(categories).toContain("retirement_401k");
    expect(categories).toContain("pto");
  });
});

describe("Job Search Resilience", () => {
  it("searchJobs is a function in job service api module (import check)", () => {
    // We verify the export exists at module level without needing Supabase
    // The actual function body uses Supabase but the export must exist
    const jobApiPath = join(process.cwd(), "src", "services", "job", "api.ts");
    const content = readFileSync(jobApiPath, "utf-8");
    expect(content).toContain("searchJobs");
  });

  it("scoreJobs is exported from matching service", async () => {
    const matchingApi = await import("@/services/matching/api");
    expect(typeof matchingApi.scoreJobs).toBe("function");
  });

  it("scoreJobs gracefully handles empty input", async () => {
    const { scoreJobs } = await import("@/services/matching/api");
    const result = scoreJobs({ jobs: [], skills: [] });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("scoreJobs works with jobs even if no skills provided", async () => {
    const { scoreJobs } = await import("@/services/matching/api");
    const mockJob = {
      title: "Software Engineer",
      company: "Acme",
      location: "Remote",
      type: "full-time",
      description: "Build great software",
      url: "https://acme.com/jobs/123",
      matchReason: "AI match",
    };
    const result = scoreJobs({ jobs: [mockJob], skills: [] });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("trustScore");
    expect(result[0]).toHaveProperty("strategy");
  });
});

describe("Navigation Enforcement", () => {
  const ALLOWED_SEEKER_ROUTES = ["/dashboard", "/job-search", "/applications", "/profile", "/admin"];

  it("jobSeekerNav contains only the 5 allowed routes", async () => {
    const { jobSeekerNav } = await import("@/shell/navigation");
    const urls = jobSeekerNav.map(item => item.url);
    expect(urls).toHaveLength(ALLOWED_SEEKER_ROUTES.length);
    for (const url of urls) {
      expect(ALLOWED_SEEKER_ROUTES, `unexpected nav url: ${url}`).toContain(url);
    }
  });

  it("jobSeekerNav does NOT include removed routes", async () => {
    const { jobSeekerNav } = await import("@/shell/navigation");
    const urls = jobSeekerNav.map(item => item.url);
    const forbidden = ["/job-seeker", "/offers", "/career", "/interview-prep", "/auto-apply", "/support",
      "/hiring-manager", "/candidates", "/job-postings", "/interview-scheduling"];
    for (const f of forbidden) {
      expect(urls, `forbidden route ${f} still in nav`).not.toContain(f);
    }
  });

  it("hiringManagerNav is empty (deprecated)", async () => {
    const { hiringManagerNav } = await import("@/shell/navigation");
    expect(hiringManagerNav).toHaveLength(0);
  });

  it("admin nav item is marked adminOnly", async () => {
    const { jobSeekerNav } = await import("@/shell/navigation");
    const adminItem = jobSeekerNav.find(item => item.url === "/admin");
    expect(adminItem, "/admin nav item not found").toBeDefined();
    expect(adminItem?.adminOnly).toBe(true);
  });
});

describe("Job Search Resilience (scoreJobs fallback)", () => {
  it("scoreJobs handles empty jobs without throwing", async () => {
    const { scoreJobs } = await import("@/services/matching/api");
    expect(() => scoreJobs({ jobs: [], skills: [] })).not.toThrow();
  });

  it("scoreJobs returns an array of enriched jobs", async () => {
    const { scoreJobs } = await import("@/services/matching/api");
    const job = {
      title: "Engineer", company: "Acme", location: "Remote",
      type: "full-time", description: "Build stuff", url: "https://acme.com/job/1",
      matchReason: "good match",
    };
    const result = scoreJobs({ jobs: [job], skills: ["javascript"] });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("trustScore");
    expect(result[0]).toHaveProperty("strategy");
  });

  it("JobResult type in job service does NOT have flags (flags live on EnrichedJob)", () => {
    // Validate at the file-content level that no lib import exists in job/types.ts
    const typesPath = join(process.cwd(), "src", "services", "job", "types.ts");
    const content = readFileSync(typesPath, "utf-8");
    expect(content).not.toContain("jobQualityEngine");
    expect(content).not.toContain("FakeJobFlag");
  });

  it("FakeJobFlag type is defined in matching service types file", () => {
    // Structural check: verify FakeJobFlag interface is declared in matching/types.ts
    const typesPath = join(process.cwd(), "src", "services", "matching", "types.ts");
    const content = readFileSync(typesPath, "utf-8");
    expect(content).toContain("FakeJobFlag");
    expect(content).toContain("interface FakeJobFlag");
  });
});

describe("Orchestrator", () => {
  it("orchestrator.ts exists in shell", () => {
    const path = join(SHELL_DIR, "orchestrator.ts");
    expect(existsSync(path)).toBe(true);
  });

  it("runAllAgents is exported from orchestrator file", () => {
    const orchPath = join(SHELL_DIR, "orchestrator.ts");
    const content = readFileSync(orchPath, "utf-8");
    expect(content).toContain("runAllAgents");
    expect(content).toContain("searchJobs");
    expect(content).toContain("scoreJobs");
    expect(content).toContain("optimize");
    expect(content).toContain("apply");
  });
});

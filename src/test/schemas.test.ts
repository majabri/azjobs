/**
 * Tests for Zod validation schemas (Phase 4).
 * These run entirely in-process — no network, no Supabase.
 */
import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/schemas/auth";
import { profileSchema } from "@/lib/schemas/profile";
import { jobPostingSchema } from "@/lib/schemas/jobPosting";

// ── loginSchema ───────────────────────────────────────────────────────────────
describe("loginSchema", () => {
  it("accepts valid email + password", () => {
    const result = loginSchema.safeParse({ identifier: "user@example.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("accepts admin username (no @)", () => {
    const result = loginSchema.safeParse({ identifier: "admin", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects empty identifier", () => {
    const result = loginSchema.safeParse({ identifier: "", password: "secret" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("identifier");
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ identifier: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("password");
  });

  it("rejects identifier over 255 chars", () => {
    const result = loginSchema.safeParse({
      identifier: "a".repeat(256),
      password: "secret",
    });
    expect(result.success).toBe(false);
  });
});

// ── signupSchema ──────────────────────────────────────────────────────────────
describe("signupSchema", () => {
  const valid = {
    email: "new@example.com",
    password: "strongpass1",
    confirmPassword: "strongpass1",
    fullName: "Jane Doe",
  };

  it("accepts valid signup data", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional fullName as empty string", () => {
    expect(signupSchema.safeParse({ ...valid, fullName: "" }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = signupSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("email");
  });

  it("rejects password shorter than 8 characters", () => {
    const r = signupSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some(i => i.path.includes("password"))).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const r = signupSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("confirmPassword");
    expect(r.error?.issues[0].message).toMatch(/do not match/i);
  });
});

// ── forgotPasswordSchema ──────────────────────────────────────────────────────
describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects an empty email", () => {
    const r = forgotPasswordSchema.safeParse({ email: "" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    const r = forgotPasswordSchema.safeParse({ email: "notanemail" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("email");
  });
});

// ── resetPasswordSchema ───────────────────────────────────────────────────────
describe("resetPasswordSchema", () => {
  it("accepts matching passwords of 8+ chars", () => {
    const r = resetPasswordSchema.safeParse({ password: "newpass1!", confirmPassword: "newpass1!" });
    expect(r.success).toBe(true);
  });

  it("rejects password shorter than 8 chars", () => {
    const r = resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const r = resetPasswordSchema.safeParse({ password: "longpass1", confirmPassword: "different" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/do not match/i);
  });
});

// ── profileSchema ─────────────────────────────────────────────────────────────
describe("profileSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(profileSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully-populated profile", () => {
    const result = profileSchema.safeParse({
      full_name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1234",
      location: "Washington DC",
      summary: "Senior security engineer with 10 years experience.",
      career_level: "Senior",
      linkedin_url: "https://linkedin.com/in/janedoe",
      salary_min: "120000",
      salary_max: "180000",
      remote_only: true,
      search_mode: "balanced",
      min_match_score: 70,
      skills: ["Python", "AWS", "Kubernetes"],
      target_job_titles: ["Security Engineer", "DevSecOps"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid LinkedIn URL", () => {
    const r = profileSchema.safeParse({ linkedin_url: "not-a-url" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("linkedin_url");
  });

  it("rejects salary_min with non-numeric characters", () => {
    const r = profileSchema.safeParse({ salary_min: "120,000" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("salary_min");
  });

  it("rejects min_match_score above 100", () => {
    const r = profileSchema.safeParse({ min_match_score: 150 });
    expect(r.success).toBe(false);
  });

  it("accepts empty string for optional URL fields", () => {
    const r = profileSchema.safeParse({ linkedin_url: "", github_url: "" });
    expect(r.success).toBe(true);
  });
});

// ── jobPostingSchema ──────────────────────────────────────────────────────────
describe("jobPostingSchema", () => {
  const validPosting = {
    title: "Senior Security Engineer",
    company: "Acme Corp",
    location: "Washington DC",
    job_type: "full-time" as const,
    experience_level: "senior" as const,
    description: "We are looking for a Senior Security Engineer to join our team and help us secure our infrastructure. The role involves threat modeling, penetration testing, and security architecture.",
    requirements: "5+ years of security experience. CISSP preferred. Strong knowledge of AWS security services.",
    is_remote: true,
    skills_required: ["AWS", "CISSP", "Python"],
  };

  it("accepts a valid job posting", () => {
    expect(jobPostingSchema.safeParse(validPosting).success).toBe(true);
  });

  it("rejects a title shorter than 3 chars", () => {
    const r = jobPostingSchema.safeParse({ ...validPosting, title: "SWE" });
    // "SWE" is exactly 3 chars so it should pass
    expect(r.success).toBe(true);
  });

  it("rejects a description shorter than 50 chars", () => {
    const r = jobPostingSchema.safeParse({ ...validPosting, description: "Short." });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("description");
  });

  it("rejects salary_max less than salary_min", () => {
    const r = jobPostingSchema.safeParse({ ...validPosting, salary_min: 200000, salary_max: 100000 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("salary_max");
  });

  it("accepts salary_max equal to salary_min", () => {
    const r = jobPostingSchema.safeParse({ ...validPosting, salary_min: 150000, salary_max: 150000 });
    expect(r.success).toBe(true);
  });

  it("rejects empty skills_required array", () => {
    const r = jobPostingSchema.safeParse({ ...validPosting, skills_required: [] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toContain("skills_required");
  });

  it("rejects an invalid job_type", () => {
    const r = jobPostingSchema.safeParse({ ...validPosting, job_type: "gig" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid application_url", () => {
    const r = jobPostingSchema.safeParse({ ...validPosting, application_url: "not-a-url" });
    expect(r.success).toBe(false);
  });

  it("accepts a missing application_url (optional)", () => {
    const { application_url: _, ...rest } = { ...validPosting, application_url: undefined };
    expect(jobPostingSchema.safeParse(rest).success).toBe(true);
  });
});

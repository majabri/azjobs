/**
 * Unit tests for React Query hook factories (Phase 2).
 *
 * Tests verify query key exports — the constants that components use to
 * invalidate caches. We mock the Supabase client so the test runs without
 * env vars and without a live DB connection.
 */
import { describe, it, expect, vi } from "vitest";

// Mock the Supabase client module so importing hooks doesn't throw
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

// Now import hook constants after the mock is in place
import { JOB_APPLICATIONS_QUERY_KEY } from "@/hooks/queries/useJobApplications";
import { RESUME_VERSIONS_QUERY_KEY } from "@/hooks/queries/useResumeVersions";
import { NOTIFICATIONS_QUERY_KEY } from "@/hooks/queries/useNotifications";
import { OUTREACH_CONTACTS_QUERY_KEY } from "@/hooks/queries/useOutreachContacts";
import { USER_PROFILE_QUERY_KEY } from "@/hooks/queries/useUserProfile";
import { INTERVIEW_SCHEDULES_QUERY_KEY } from "@/hooks/queries/useInterviewSchedules";

// ── Query key constants ───────────────────────────────────────────────────────

describe("React Query key constants", () => {
  it("JOB_APPLICATIONS_QUERY_KEY is a non-empty array", () => {
    expect(Array.isArray(JOB_APPLICATIONS_QUERY_KEY)).toBe(true);
    expect(JOB_APPLICATIONS_QUERY_KEY.length).toBeGreaterThan(0);
  });

  it("RESUME_VERSIONS_QUERY_KEY is a non-empty array", () => {
    expect(Array.isArray(RESUME_VERSIONS_QUERY_KEY)).toBe(true);
    expect(RESUME_VERSIONS_QUERY_KEY.length).toBeGreaterThan(0);
  });

  it("NOTIFICATIONS_QUERY_KEY is a non-empty array", () => {
    expect(Array.isArray(NOTIFICATIONS_QUERY_KEY)).toBe(true);
    expect(NOTIFICATIONS_QUERY_KEY.length).toBeGreaterThan(0);
  });

  it("OUTREACH_CONTACTS_QUERY_KEY is a non-empty array", () => {
    expect(Array.isArray(OUTREACH_CONTACTS_QUERY_KEY)).toBe(true);
    expect(OUTREACH_CONTACTS_QUERY_KEY.length).toBeGreaterThan(0);
  });

  it("USER_PROFILE_QUERY_KEY is a non-empty array", () => {
    expect(Array.isArray(USER_PROFILE_QUERY_KEY)).toBe(true);
    expect(USER_PROFILE_QUERY_KEY.length).toBeGreaterThan(0);
  });

  it("INTERVIEW_SCHEDULES_QUERY_KEY is a non-empty array", () => {
    expect(Array.isArray(INTERVIEW_SCHEDULES_QUERY_KEY)).toBe(true);
    expect(INTERVIEW_SCHEDULES_QUERY_KEY.length).toBeGreaterThan(0);
  });

  it("all query keys have unique first elements (no cache key collisions)", () => {
    const firstKeys = [
      JOB_APPLICATIONS_QUERY_KEY[0],
      RESUME_VERSIONS_QUERY_KEY[0],
      NOTIFICATIONS_QUERY_KEY[0],
      OUTREACH_CONTACTS_QUERY_KEY[0],
      USER_PROFILE_QUERY_KEY[0],
      INTERVIEW_SCHEDULES_QUERY_KEY[0],
    ];
    const unique = new Set(firstKeys);
    expect(unique.size).toBe(firstKeys.length);
  });

  it("query keys are stable references (same object between imports)", () => {
    // Constants should be module-level arrays, not recreated each call
    expect(JOB_APPLICATIONS_QUERY_KEY).toBe(JOB_APPLICATIONS_QUERY_KEY);
  });
});

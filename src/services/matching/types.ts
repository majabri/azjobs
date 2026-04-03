/**
 * Matching Service — Types
 * Data contracts for job-candidate matching and scoring.
 * No imports from other services.
 */

/**
 * Flags raised by the fake-job / trust detection engine.
 * Owned by the matching service; job service types must NOT reference this directly.
 */
export interface FakeJobFlag {
  type: "age" | "duplicate" | "missing_fields" | "scam_keywords" | "hidden_company" | "suspicious_url";
  severity: "warning" | "danger";
  label: string;
}

export interface ScoredJob {
  jobId: string;
  title: string;
  company: string;
  url: string;
  matchScore: number;
  responseProbability: number;
  decisionScore: number;
  effortEstimate: number;
  trustScore: number;
  trustLevel: "trusted" | "caution" | "risky";
  strategy: "apply_now" | "apply_fast" | "improve_first" | "skip";
  smartTag: string;
  flags: { type: string; label: string; severity: "low" | "medium" | "high" }[];
}

export interface MatchingProfile {
  skills: string[];
  careerLevel: string;
  historicalOutcomes?: {
    totalApplications: number;
    totalResponses: number;
    avgResponseRate: number;
    avgDaysToResponse: number;
  };
}

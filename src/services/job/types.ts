/**
 * Job Service — Types
 * Data contracts for the job search and analysis domain.
 * No imports from other services.
 */

export interface JobResult {
  id?: string;
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  url: string;
  matchReason: string;
  quality_score?: number;
  is_flagged?: boolean;
  flag_reasons?: string[];
  salary?: string;
  seniority?: string;
  is_remote?: boolean;
  source?: string;
  first_seen_at?: string;
  responseProbability?: number;
  smartTag?: string;
  decisionScore?: number;
  effortEstimate?: number;
  flags?: import("@/lib/job-search/jobQualityEngine").FakeJobFlag[];
  trustScore?: number;
  trustLevel?: "trusted" | "caution" | "risky";
  strategy?: "apply_now" | "apply_fast" | "improve_first" | "skip";
}

export interface JobSearchFilters {
  skills: string[];
  jobTypes: string[];
  location: string;
  query: string;
  careerLevel: string;
  targetTitles: string[];
  salaryMin?: string;
  salaryMax?: string;
  searchSource: "all" | "ai" | "database";
  minFitScore: number;
  showFlagged: boolean;
}

export interface ParsedJobDescription {
  requirementsText: string;
  benefitsText: string;
  companyText: string;
  fullText: string;
}

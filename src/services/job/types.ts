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

  // AI match fields (from user_job_matches via discover-jobs v6)
  fit_score?: number | null;
  matched_skills?: string[];
  skill_gaps?: string[];
  strengths?: string[];
  red_flags?: string[];
  match_summary?: string;
  effort_level?: "easy" | "moderate" | "hard";
  response_prob?: number | null;
  smart_tag?: string;
  is_saved?: boolean;
  is_applied?: boolean;

  // Local scoring fields (computed client-side when AI scores unavailable)
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
  search_mode?: "quality" | "balanced" | "volume";
  days_old?: number;
  offset?: number;
}

export interface ParsedJobDescription {
  requirementsText: string;
  benefitsText: string;
  companyText: string;
  fullText: string;
}

// discover-jobs v6 response
export interface DiscoverJobsResponse {
  jobs: JobResult[];
  total: number;
  searchTerm: string;
  matchingTriggered: boolean;
  source: string;
}

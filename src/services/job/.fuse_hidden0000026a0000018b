/**
 * Job Service — API layer.
 * Public interface for the job service. All consumers import from here.
 * No cross-service imports.
 */

export { searchJobs, searchDatabaseJobs, searchAIJobs, normalizeJobUrl, pollMatchScores, markJobInteraction } from "./service";
export type { JobResult, JobSearchFilters, ParsedJobDescription, DiscoverJobsResponse } from "./types";

// Parsing is owned by the job service — all parsing imports live here
export { parseJobSections, extractCompanySection, extractBenefits } from "./parser";
export type { ParsedJobSections, StructuredBenefit, BenefitCategory } from "./parser";

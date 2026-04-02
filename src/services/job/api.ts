/**
 * Job Service — API layer.
 * Public interface for the job service. All consumers import from here.
 * No cross-service imports.
 */

export { searchJobs, searchDatabaseJobs, searchAIJobs, normalizeJobUrl } from "./service";
export type { JobResult, JobSearchFilters, ParsedJobDescription } from "./types";

// Re-export parsing from lib/services (job-owned domain logic)
export { parseJobSections } from "@/lib/services/sectionParser";
export { extractCompanySection } from "@/lib/services/companyService";
export { extractBenefits } from "@/lib/services/benefitsService";

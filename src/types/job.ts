/**
 * Shared Job Types — canonical data contracts for the job domain.
 *
 * Import cross-service job types from here, NOT from @/services/job/api or
 * @/services/job/types directly.  This prevents service-to-service coupling:
 * any service that needs JobResult simply imports from @/types/job without
 * taking a dependency on the entire job service public API.
 *
 * Source of truth: src/services/job/types.ts (re-exported here).
 */

export type {
  JobResult,
  JobSearchFilters,
  ParsedJobDescription,
  DiscoverJobsResponse,
} from "@/services/job/types";

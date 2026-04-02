/**
 * Matching Service — API layer.
 * Public interface. All consumers import from here.
 */
export { scoreJobs, type EnrichedJob } from "./service";
export type { ScoredJob, MatchingProfile } from "./types";

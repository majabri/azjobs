/**
 * React Query hooks for iCareerOS data fetching.
 * All hooks use @tanstack/react-query and respect auth state via useAuthReady.
 *
 * Pattern:
 *   - useXxx()          → read (useQuery) — auto-refetches, caches, deduplicates
 *   - useCreateXxx()    → write mutation for creation
 *   - useUpdateXxx()    → write mutation for updates
 *   - useDeleteXxx()    → write mutation for deletion
 *
 * Query keys are exported as XXX_QUERY_KEY constants for manual invalidation.
 */

export * from "./useAnalysisHistory";
export * from "./useInterviewSchedules";
export * from "./useJobApplications";
export * from "./useJobPostings";
export * from "./useJobSeekerProfile";
export * from "./useNotifications";
export * from "./useOffers";
export * from "./useOutreachContacts";
export * from "./useResumeVersions";
export * from "./useUserProfile";

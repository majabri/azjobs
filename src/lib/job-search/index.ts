/**
 * Job Search Domain — Barrel export
 * 
 * All job search, quality scoring, save/ignore logic lives here.
 * No dependencies on analysis, career, or other feature domains.
 */

export { saveJobToApplications, type SaveJobInput } from "./saveJob";
export { getIgnoredJobs, ignoreJob, unignoreJob, isJobIgnored, isJobAlreadySaved, type IgnoredJob } from "./ignoredJobs";
export {
  detectFakeJobFlags, getTrustScore, calculateResponseProbability,
  getJobStrategy, STRATEGY_CONFIG, TRUST_LEVEL_CONFIG,
  type FakeJobFlag, type HistoricalOutcomes, type JobStrategy,
} from "./jobQualityEngine";

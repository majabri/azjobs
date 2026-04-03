/**
 * Shell Orchestrator — Central agent pipeline coordinator.
 *
 * This is the ONLY place where services are chained together.
 * Services MUST NOT call each other directly.
 * Only this orchestrator composes service calls.
 *
 * Flow: searchJobs → scoreJobs → optimizeResume → applyToJobs
 */

import { searchJobs } from "@/services/job/api";
import { scoreJobs } from "@/services/matching/api";
import { optimize } from "@/services/resume/api";
import { apply } from "@/services/application/api";
import type { JobSearchFilters } from "@/services/job/api";
import type { EnrichedJob } from "@/services/matching/api";

export interface OrchestratorResult {
  jobsFound: number;
  jobsScored: number;
  resumeOptimized: boolean;
  applicationsSubmitted: number;
  errors: string[];
}

/**
 * Run the full automated agent pipeline:
 * 1. Job service fetches jobs
 * 2. Matching service scores jobs (independently — failure does not block step 1 results)
 * 3. Resume service optimizes resume for top job descriptions
 * 4. Application service submits applications
 *
 * Each step is non-blocking: if one fails, the pipeline continues with the
 * data available from previous steps.
 */
// ─── Error message helper ─────────────────────────────────────────────────────
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function runAllAgents(filters: JobSearchFilters): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    jobsFound: 0,
    jobsScored: 0,
    resumeOptimized: false,
    applicationsSubmitted: 0,
    errors: [],
  };

  // ── Step 1: Job Service — fetch jobs only ──────────────────────────────────
  console.log("[Orchestrator] Step 1: searching jobs...");
  let jobs = await searchJobs(filters).then(r => r.jobs).catch(e => {
    console.error("[Orchestrator] searchJobs failed:", e);
    result.errors.push(`searchJobs: ${errMsg(e)}`);
    return [];
  });
  result.jobsFound = jobs.length;
  console.log(`[Orchestrator] Step 1 complete: ${jobs.length} jobs found`);

  if (jobs.length === 0) {
    console.warn("[Orchestrator] No jobs found — pipeline halted");
    return result;
  }

  // ── Step 2: Matching Service — score jobs independently ───────────────────
  console.log("[Orchestrator] Step 2: scoring jobs...");
  let scoredJobs: EnrichedJob[] = [];
  try {
    scoredJobs = scoreJobs({ jobs, skills: filters.skills });
    result.jobsScored = scoredJobs.length;
    console.log(`[Orchestrator] Step 2 complete: ${scoredJobs.length} jobs scored`);
  } catch (e) {
    console.error("[Orchestrator] scoreJobs failed (non-blocking):", e);
    result.errors.push(`scoreJobs: ${errMsg(e)}`);
    // Fallback: wrap unscored jobs with default EnrichedJob fields so pipeline continues
    scoredJobs = jobs.map(job => ({
      ...job,
      flags: [],
      trustScore: 50,
      trustLevel: "caution" as const,
      strategy: "apply_now" as const,
      responseProbability: 50,
      decisionScore: 50,
      effortEstimate: 50,
      smartTag: "Worth Applying",
    }));
    result.jobsScored = 0;
  }

  // ── Step 3: Resume Service — optimize for top job descriptions ────────────
  console.log("[Orchestrator] Step 3: optimizing resume...");
  const topJobs = scoredJobs.slice(0, 5);
  const jobDescriptions = topJobs.map(j => j.description).filter(Boolean);
  const optimizedResume = await optimize(jobDescriptions).catch(e => {
    console.error("[Orchestrator] optimize failed (non-blocking):", e);
    result.errors.push(`optimize: ${errMsg(e)}`);
    return null;
  });
  result.resumeOptimized = Boolean(optimizedResume);
  console.log(`[Orchestrator] Step 3 complete: resume optimized = ${result.resumeOptimized}`);

  // ── Step 4: Application Service — submit applications ─────────────────────
  console.log("[Orchestrator] Step 4: submitting applications...");
  const applyPayloads = topJobs.map(j => ({
    title: j.title,
    company: j.company,
    url: j.url,
    resumeText: optimizedResume,
  }));
  const submitted = await apply(applyPayloads).catch(e => {
    console.error("[Orchestrator] apply failed (non-blocking):", e);
    result.errors.push(`apply: ${errMsg(e)}`);
    return 0;
  });
  result.applicationsSubmitted = submitted;
  console.log(`[Orchestrator] Step 4 complete: ${submitted} applications submitted`);

  console.log("[Orchestrator] Pipeline complete:", result);
  return result;
}

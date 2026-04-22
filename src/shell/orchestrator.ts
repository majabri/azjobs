/**
 * Shell Orchestrator — Central agent pipeline coordinator.
 *
 * This is the ONLY place where services are chained together.
 * Services MUST NOT call each other directly.
 * Only this orchestrator composes service calls.
 *
 * Flow: searchJobs → scoreJobs → optimizeResume → applyToJobs
 *
 * Phase 2 addition: each step emits a structured event to platform_events
 * (fire-and-forget — events never block the pipeline).
 */

import { searchJobs } from "@/services/job/api";
import { scoreJobs } from "@/services/matching/api";
import { optimize } from "@/services/resume/api";
import { apply } from "@/services/application/api";
import type { JobSearchFilters } from "@/services/job/api";
import type { EnrichedJob } from "@/services/matching/api";
import type { HistoricalOutcomes } from "@/lib/job-search/jobQualityEngine";
import { logger } from "@/lib/logger";
import { publishEvent, publishFailureEvent } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function elapsed(start: number): number {
  return Math.round(Date.now() - start);
}

/**
 * Read a boolean feature flag from the feature_flags table.
 * Returns false on any error so the pipeline defaults to synchronous mode.
 */
async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return false;
    return (data as { enabled: boolean }).enabled === true;
  } catch {
    return false;
  }
}

// ─── runSearchOnly ────────────────────────────────────────────────────────────

export interface SearchOnlyResult {
  jobs: EnrichedJob[];
  /** True when the discover-jobs function triggered background AI matching. */
  matchingTriggered: boolean;
}

/**
 * Run steps 1 + 2 only: fetch jobs then score them.
 *
 * Use this in UI pages (e.g. JobSearch) instead of calling searchJobs /
 * scoreJobs directly so that pages do not cross the service boundary.
 * The orchestrator is the ONLY place where services are chained.
 *
 * Scoring failure is non-blocking: if scoreJobs throws, a fallback
 * EnrichedJob array is returned with default scores so the UI
 * can still display results.
 */
export async function runSearchOnly(
  filters: JobSearchFilters,
  historicalOutcomes?: HistoricalOutcomes,
  userId?: string,
): Promise<SearchOnlyResult> {
  publishEvent(
    "job.search.requested",
    { filters: filters as unknown as Record<string, unknown> },
    userId,
  );

  // ── Step 1 — fetch ─────────────────────────────────────────────────────────
  logger.info("[Orchestrator] runSearchOnly: searching jobs…");
  const t1 = Date.now();
  let matchingTriggered = false;

  const rawJobs = await searchJobs(filters)
    .then((r) => {
      matchingTriggered = r.matchingTriggered ?? false;
      publishEvent(
        "job.search.completed",
        {
          job_count: r.jobs.length,
          source: "search",
          matching_triggered: matchingTriggered,
          duration_ms: elapsed(t1),
        } as any,
        userId,
      );
      return r.jobs;
    })
    .catch((e) => {
      logger.error("[Orchestrator] runSearchOnly: searchJobs failed:", e);
      publishFailureEvent("searchJobs", e, elapsed(t1), userId);
      return [];
    });

  if (rawJobs.length === 0) {
    publishEvent(
      "pipeline.step.skipped",
      { step: "scoreJobs", reason: "no jobs found" },
      userId,
    );
    return { jobs: [], matchingTriggered };
  }

  // ── Step 2 — score (non-blocking) ──────────────────────────────────────────
  logger.info("[Orchestrator] runSearchOnly: scoring jobs…");
  const t2 = Date.now();
  try {
    const jobs = scoreJobs({
      jobs: rawJobs,
      skills: filters.skills,
      historicalOutcomes,
      salaryMin: filters.salaryMin,
      salaryMax: filters.salaryMax,
      remotePreferred: filters.jobTypes.includes("remote"),
    });
    publishEvent(
      "job.scored",
      {
        jobs_scored: jobs.length,
        top_score: Math.max(0, ...jobs.map((j) => j.decisionScore ?? 0)),
        duration_ms: elapsed(t2),
      },
      userId,
    );
    return { jobs, matchingTriggered };
  } catch (e) {
    logger.error(
      "[Orchestrator] runSearchOnly: scoreJobs failed (non-blocking):",
      e,
    );
    publishFailureEvent("scoreJobs", e, elapsed(t2), userId);
    const jobs: EnrichedJob[] = rawJobs.map((job) => ({
      ...job,
      flags: [],
      trustScore: 50,
      trustLevel: "caution" as const,
      strategy: "apply_now" as const,
      responseProbability: 50,
      decisionScore: job.quality_score || 50,
      effortEstimate: 50,
      smartTag: "Worth Applying",
    }));
    return { jobs, matchingTriggered };
  }
}

// ─── runAllAgents ─────────────────────────────────────────────────────────────

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
 * data available from previous steps.  Every step emits a structured event.
 */
export async function runAllAgents(
  filters: JobSearchFilters,
  userId?: string,
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    jobsFound: 0,
    jobsScored: 0,
    resumeOptimized: false,
    applicationsSubmitted: 0,
    errors: [],
  };

  // ── Async mode (Phase 3) ───────────────────────────────────────────────────
  // When the orchestration_mode_async feature flag is true, publish a
  // job.search.requested event and return immediately.  The event-processor
  // edge function picks up the event via a DB Webhook and dispatches work
  // to the appropriate backend service.
  const asyncMode = await getFeatureFlag("orchestration_mode_async");
  if (asyncMode) {
    logger.info(
      "[Orchestrator] async mode enabled — publishing trigger event and returning",
    );
    publishEvent(
      "job.search.requested",
      { filters: filters as unknown as Record<string, unknown> },
      userId,
    );
    return result; // results will be populated by the async pipeline
  }

  // ── Synchronous mode (default, flag = false) ───────────────────────────────
  publishEvent(
    "job.search.requested",
    { filters: filters as unknown as Record<string, unknown> },
    userId,
  );

  // ── Step 1: Job Service — fetch jobs only ──────────────────────────────────
  logger.info("[Orchestrator] Step 1: searching jobs...");
  const t1 = Date.now();
  const jobs = await searchJobs(filters)
    .then((r) => {
      publishEvent(
        "job.search.completed",
        {
          job_count: r.jobs.length,
          source: "search",
          matching_triggered: r.matchingTriggered ?? false,
          duration_ms: elapsed(t1),
        } as any,
        userId,
      );
      return r.jobs;
    })
    .catch((e) => {
      logger.error("[Orchestrator] searchJobs failed:", e);
      result.errors.push(`searchJobs: ${errMsg(e)}`);
      publishFailureEvent("searchJobs", e, elapsed(t1), userId);
      return [];
    });
  result.jobsFound = jobs.length;
  logger.info(`[Orchestrator] Step 1 complete: ${jobs.length} jobs found`);

  if (jobs.length === 0) {
    logger.warn("[Orchestrator] No jobs found — pipeline halted");
    publishEvent(
      "pipeline.step.skipped",
      { step: "scoreJobs", reason: "no jobs found" },
      userId,
    );
    return result;
  }

  // ── Step 2: Matching Service — score jobs independently ───────────────────
  logger.info("[Orchestrator] Step 2: scoring jobs...");
  const t2 = Date.now();
  let scoredJobs: EnrichedJob[] = [];
  try {
    scoredJobs = scoreJobs({ jobs, skills: filters.skills });
    result.jobsScored = scoredJobs.length;
    logger.info(
      `[Orchestrator] Step 2 complete: ${scoredJobs.length} jobs scored`,
    );
    publishEvent(
      "job.scored",
      {
        jobs_scored: scoredJobs.length,
        top_score: Math.max(0, ...scoredJobs.map((j) => j.decisionScore ?? 0)),
        duration_ms: elapsed(t2),
      },
      userId,
    );
  } catch (e) {
    logger.error("[Orchestrator] scoreJobs failed (non-blocking):", e);
    result.errors.push(`scoreJobs: ${errMsg(e)}`);
    publishFailureEvent("scoreJobs", e, elapsed(t2), userId);
    // Fallback: wrap unscored jobs so pipeline continues
    scoredJobs = jobs.map((job) => ({
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
  logger.info("[Orchestrator] Step 3: optimizing resume...");
  const t3 = Date.now();
  const topJobs = scoredJobs.slice(0, 5);
  const jobDescriptions = topJobs.map((j) => j.description).filter(Boolean);
  const optimizedResume = await optimize(jobDescriptions)
    .then((resume) => {
      publishEvent(
        "resume.optimized",
        {
          job_titles: topJobs.map((j) => j.title),
          duration_ms: elapsed(t3),
        },
        userId,
      );
      return resume;
    })
    .catch((e) => {
      logger.error("[Orchestrator] optimize failed (non-blocking):", e);
      result.errors.push(`optimize: ${errMsg(e)}`);
      publishFailureEvent("optimize", e, elapsed(t3), userId);
      return null;
    });
  result.resumeOptimized = Boolean(optimizedResume);
  logger.info(
    `[Orchestrator] Step 3 complete: resume optimized = ${result.resumeOptimized}`,
  );

  // ── Step 4: Application Service — submit applications ─────────────────────
  logger.info("[Orchestrator] Step 4: submitting applications...");
  const t4 = Date.now();
  const applyPayloads = topJobs.map((j) => ({
    title: j.title,
    company: j.company,
    url: j.url,
    resumeText: optimizedResume,
  }));
  const submitted = await apply(applyPayloads)
    .then((count) => {
      publishEvent(
        "application.submitted",
        {
          application_count: count,
          duration_ms: elapsed(t4),
        },
        userId,
      );
      return count;
    })
    .catch((e) => {
      logger.error("[Orchestrator] apply failed (non-blocking):", e);
      result.errors.push(`apply: ${errMsg(e)}`);
      publishFailureEvent("apply", e, elapsed(t4), userId);
      return 0;
    });
  result.applicationsSubmitted = submitted;
  logger.info(
    `[Orchestrator] Step 4 complete: ${submitted} applications submitted`,
  );

  logger.info("[Orchestrator] Pipeline complete:", result);
  return result;
}

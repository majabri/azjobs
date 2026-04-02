/**
 * Matching Service — Core scoring logic.
 * Scores jobs against user profiles. INDEPENDENT of job search.
 * Job search MUST work even if matching fails entirely.
 */

import {
  detectFakeJobFlags,
  getTrustScore,
  calculateResponseProbability as calcResponseProb,
  getJobStrategy,
  type FakeJobFlag,
  type HistoricalOutcomes,
} from "@/lib/job-search/jobQualityEngine";
import type { JobResult } from "@/services/job/types";

interface MatchingInput {
  jobs: JobResult[];
  skills: string[];
  historicalOutcomes?: HistoricalOutcomes;
}

export interface EnrichedJob extends JobResult {
  flags: FakeJobFlag[];
  trustScore: number;
  trustLevel: "trusted" | "caution" | "risky";
  strategy: "apply_now" | "apply_fast" | "improve_first" | "skip";
  responseProbability: number;
  decisionScore: number;
  effortEstimate: number;
  smartTag: string;
}

function calculateResponseProbability(job: JobResult, userSkills: string[]): number {
  let prob = 50;
  if (job.quality_score !== undefined) prob += (job.quality_score - 50) * 0.3;
  if (job.first_seen_at) {
    const days = (Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 3) prob += 15;
    else if (days < 7) prob += 8;
    else if (days > 30) prob -= 20;
    else if (days > 14) prob -= 10;
  }
  if (userSkills.length > 0 && job.description) {
    const desc = job.description.toLowerCase();
    const matched = userSkills.filter(s => desc.includes(s.toLowerCase())).length;
    prob += (matched / userSkills.length) * 20;
  }
  if (job.is_remote) prob -= 5;
  return Math.max(5, Math.min(95, Math.round(prob)));
}

function calculateDecisionScore(job: JobResult, prob: number, userSkills: string[]): { score: number; effort: number } {
  let effort = 50;
  if (userSkills.length > 0 && job.description) {
    const desc = job.description.toLowerCase();
    const matched = userSkills.filter(s => desc.includes(s.toLowerCase())).length;
    effort = Math.round((1 - matched / Math.max(userSkills.length, 1)) * 100);
  }
  const fitScore = job.quality_score || 50;
  const ease = 100 - effort;
  const score = Math.round(fitScore * 0.4 + prob * 0.3 + ease * 0.3);
  return { score: Math.max(5, Math.min(99, score)), effort };
}

function getSmartTag(job: JobResult & { responseProbability?: number; effortEstimate?: number }, prob: number): string {
  if (job.is_flagged) return "Low Confidence";
  if ((job.effortEstimate || 0) > 70 && prob < 40) return "Low ROI";
  if (prob >= 70) return "High Chance";
  if (prob >= 50 && job.first_seen_at) {
    const days = (Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 3) return "Apply Fast";
  }
  if (prob < 35) return "Improve Resume First";
  return "Worth Applying";
}

/**
 * Score and enrich jobs with matching data.
 * This is the ONLY public API for the matching service.
 * If this fails, job search results should still display (without scores).
 */
export function scoreJobs(input: MatchingInput): EnrichedJob[] {
  const { jobs, skills, historicalOutcomes } = input;
  const allTitles = jobs.map(j => j.title || "");

  return jobs.map(job => {
    const jobAge = job.first_seen_at
      ? Math.round((Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    const flags = detectFakeJobFlags({
      title: job.title, company: job.company, description: job.description,
      url: job.url, location: job.location, jobAge, allJobTitles: allTitles,
    });
    const { score: trustScore, level: trustLevel } = getTrustScore(flags);

    const combinedFlagged = job.is_flagged || flags.length > 0;
    const combinedFlagReasons = [...(job.flag_reasons || []), ...flags.map(f => f.label)];

    const matchScore = job.quality_score || 50;
    const descLower = (job.description || "").toLowerCase();
    const matched = skills.filter(s => descLower.includes(s.toLowerCase())).length;
    const skillMatchRatio = skills.length > 0 ? matched / skills.length : 0.5;
    const competitionLevel = job.is_remote ? "high" as const : "medium" as const;

    const prob = calcResponseProb({
      matchScore, jobAge: jobAge || 7, competitionLevel,
      trustScore, historicalOutcomes, skillMatchRatio, isRemote: job.is_remote,
    });

    const { score: decScore, effort } = calculateDecisionScore(job, prob, skills);
    const strategy = getJobStrategy(matchScore, prob, trustLevel, jobAge || 7);
    const smartTag = getSmartTag({ ...job, responseProbability: prob, effortEstimate: effort, is_flagged: combinedFlagged }, prob);

    return {
      ...job,
      responseProbability: prob,
      decisionScore: decScore,
      effortEstimate: effort,
      smartTag,
      flags,
      trustScore,
      trustLevel,
      strategy,
      is_flagged: combinedFlagged,
      flag_reasons: combinedFlagReasons,
    };
  });
}

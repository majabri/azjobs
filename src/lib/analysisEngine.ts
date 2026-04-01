/**
 * Analysis Engine — Thin orchestrator that composes isolated services.
 * 
 * ARCHITECTURE: Each service is independent and can be modified without affecting others.
 * - skillService: Skill extraction, keyword matching
 * - benefitsService: Benefit taxonomy & extraction
 * - companyService: Company section extraction
 * - careerService: Career level detection, job titles, profile extraction
 * - sectionParser: Job description section detection
 * - scoringService: Fit scoring, gap analysis, improvement plans
 * - types: Shared data contracts
 * 
 * This file is the ONLY composition point. Consumers import from here for backward compat.
 */

// ─── Re-export all types ─────────────────────────────────────────────────────
export type {
  SkillMatch,
  LearningResource,
  GapItem,
  BenefitCategory,
  StructuredBenefit,
  FitAnalysis,
  ExtractedProfile,
  CandidateAnalysis,
  ParsedJobSections,
} from "./services/types";

// ─── Re-export service functions for backward compatibility ──────────────────
export { extractKeywords, extractSkillsFromText, extractSkillsWithCategories, scoreOverlap } from "./services/skillService";
export { parseJobSections } from "./services/sectionParser";
export { extractBenefits } from "./services/benefitsService";
export { extractCompanySection } from "./services/companyService";
export { detectCareerLevel, extractJobTitles, extractProfileFromResume } from "./services/careerService";

// ─── Orchestrated Analysis ───────────────────────────────────────────────────
import type { FitAnalysis, CandidateAnalysis } from "./services/types";
import { extractKeywords, scoreOverlap } from "./services/skillService";
import { parseJobSections } from "./services/sectionParser";
import { extractBenefits } from "./services/benefitsService";
import { extractCompanySection } from "./services/companyService";
import { detectCareerLevel } from "./services/careerService";
import {
  buildSkillMatches,
  buildGaps,
  buildImprovementPlan,
  buildSummary,
  computeExperienceMatch,
  buildTopActions,
} from "./services/scoringService";

/**
 * Main FitCheck analysis — composes all services.
 * Each service is called independently; a bug in one won't crash others.
 */
export function analyzeJobFit(jobDescription: string, resumeText: string): FitAnalysis {
  // Step 1: Parse sections (isolated)
  const parsed = parseJobSections(jobDescription);

  // Step 2: Extract skills (isolated — only reads requirementsText)
  const jobKeywords = extractKeywords(parsed.requirementsText);
  const resumeKeywords = extractKeywords(resumeText);

  // Step 3: Extract benefits (isolated — reads benefitsText + fullText)
  let benefits;
  try {
    benefits = extractBenefits(jobDescription, parsed.benefitsText);
  } catch (e) {
    console.error("[BenefitsService] Error:", e);
    benefits = [];
  }

  // Step 4: Extract company info (isolated — reads fullText)
  let companySummary: string;
  try {
    companySummary = extractCompanySection(jobDescription);
  } catch (e) {
    console.error("[CompanyService] Error:", e);
    companySummary = "";
  }

  // Step 5: Score and match (isolated — uses skill data only)
  const overallScore = scoreOverlap(jobKeywords, resumeKeywords);
  const matchedSkills = buildSkillMatches(jobKeywords, resumeKeywords);
  const gaps = buildGaps(matchedSkills);
  const strengths = matchedSkills.filter(s => s.matched).slice(0, 4).map(s => s.skill);
  const improvementPlan = buildImprovementPlan(gaps);
  const summary = buildSummary(overallScore, gaps.length);

  // Step 6: Experience and keyword alignment (isolated)
  const matchedCount = matchedSkills.filter(s => s.matched).length;
  const totalSkills = matchedSkills.length;
  const keywordAlignment = totalSkills > 0 ? Math.round((matchedCount / totalSkills) * 100) : 50;
  const experienceMatch = computeExperienceMatch(jobDescription, resumeText);
  const interviewProbability = Math.min(95, Math.max(5,
    Math.round(overallScore * 0.4 + experienceMatch * 0.3 + keywordAlignment * 0.3)
  ));

  const jobLevel = detectCareerLevel(jobDescription);
  const topActions = buildTopActions(gaps, experienceMatch, keywordAlignment, jobLevel);

  return {
    overallScore, matchedSkills, gaps, strengths, improvementPlan, summary,
    interviewProbability, experienceMatch, keywordAlignment,
    topActions, benefits, companySummary,
  };
}

/**
 * Candidate analysis for hiring managers — composes skill service only.
 */
export function analyzeCandidates(
  jobDescription: string,
  candidates: { name: string; resumeText: string }[]
): CandidateAnalysis[] {
  const jobKeywords = extractKeywords(jobDescription);

  return candidates
    .map((c) => {
      const resumeKeywords = extractKeywords(c.resumeText);
      const score = scoreOverlap(jobKeywords, resumeKeywords);
      const matchedSkills = jobKeywords.filter(k => resumeKeywords.includes(k));
      const gaps = jobKeywords.filter(k => !resumeKeywords.includes(k));

      return {
        name: c.name,
        resumeText: c.resumeText,
        score,
        matchedSkills: matchedSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
        gaps: gaps.slice(0, 4).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
        recommendation: (score >= 70 ? "interview" : score >= 45 ? "maybe" : "pass") as "interview" | "maybe" | "pass",
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Shared types for the FitCheck analysis platform.
 * This is the data contract layer — all services depend on types, never on each other.
 */

export interface SkillMatch {
  skill: string;
  matched: boolean;
  confidence: number;
  context?: string;
  category?: string;
}

export interface LearningResource {
  title: string;
  type: "course" | "certification" | "project" | "book";
  platform: string;
  estimatedTime: string;
  url?: string;
}

export interface GapItem {
  area: string;
  severity: "critical" | "moderate" | "minor";
  action: string;
  resources: LearningResource[];
  estimatedWeeks: number;
}

export type BenefitCategory =
  | "salary" | "health_insurance" | "dental_insurance" | "vision_insurance"
  | "life_insurance" | "disability_insurance" | "flexible_hours" | "remote_work"
  | "learning_budget" | "tuition_reimbursement" | "paid_holidays" | "referral_bonus"
  | "retirement_401k" | "stock_options" | "parental_leave" | "wellness_program"
  | "commuter_benefits" | "relocation_assistance" | "employee_discount" | "pto"
  | "mental_health" | "childcare" | "gym_membership" | "bonus";

export interface StructuredBenefit {
  category: BenefitCategory;
  label: string;
  rawText?: string;
  metadata?: Record<string, string>;
}

export interface FitAnalysis {
  overallScore: number;
  matchedSkills: SkillMatch[];
  gaps: GapItem[];
  strengths: string[];
  improvementPlan: { week: string; action: string }[];
  summary: string;
  interviewProbability: number;
  experienceMatch: number;
  keywordAlignment: number;
  topActions: string[];
  benefits: StructuredBenefit[];
  companySummary: string;
}

export interface ExtractedProfile {
  skills: string[];
  skillCategories: Record<string, string[]>;
  careerLevel: string;
  jobTitles: string[];
  certifications: string[];
}

export interface CandidateAnalysis {
  name: string;
  resumeText: string;
  score: number;
  matchedSkills: string[];
  gaps: string[];
  recommendation: "interview" | "maybe" | "pass";
}

export interface ParsedJobSections {
  requirementsText: string;
  benefitsText: string;
  companyText: string;
  fullText: string;
}

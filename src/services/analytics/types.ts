/**
 * Analytics Service — Types
 */

export interface AnalysisRecord {
  id: string;
  job_title: string;
  company: string;
  overall_score: number;
  matched_skills: { skill: string; matched: boolean }[];
  gaps: { area: string; severity: string }[];
  strengths: string[];
  summary: string;
  created_at: string;
}

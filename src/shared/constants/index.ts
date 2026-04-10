/**
 * Shared Constants — Application-wide constants.
 * No feature-specific logic. Only values.
 */

export const APP_NAME = "iCareerOS";
export const APP_TAGLINE = "Intelligent Career Operating System";
export const STATUS_COLORS = {
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
  info: "text-primary",
} as const;

export const JOB_TYPE_OPTIONS = [
  "remote", "hybrid", "in-office", "full-time", "part-time", "contract", "short-term",
] as const;

export const CAREER_LEVELS = [
  "Entry-Level / Junior", "Mid-Level", "Senior", "Manager",
  "Director", "VP / Senior Leadership", "C-Level / Executive",
] as const;

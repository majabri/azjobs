/**
 * Job Quality & Trust Engine
 * Centralized logic for fake job detection, response probability, and trust scoring.
 */

// ── Fake Job Detection ──────────────────────────────────────────────

export interface FakeJobFlag {
  type: "age" | "duplicate" | "missing_fields" | "scam_keywords" | "hidden_company" | "suspicious_url";
  severity: "warning" | "danger";
  label: string;
}

interface FakeJobInput {
  title: string;
  company: string;
  description: string;
  url?: string;
  location?: string;
  jobAge?: number; // days
  allJobTitles?: string[]; // for duplicate detection
}

const SCAM_KEYWORDS = [
  "commission only", "unpaid", "send money", "wire transfer",
  "western union", "personal bank", "processing fee", "no experience needed",
  "unlimited earning", "be your own boss", "work from home guaranteed",
  "data entry clerk", "envelope stuffing", "mystery shopper",
];

const SUSPICIOUS_URL_PATTERNS = [
  "bit.ly", "tinyurl", "goo.gl", "t.co", "rebrand.ly",
  "forms.gle", "docs.google.com/forms", "surveymonkey",
];

export function detectFakeJobFlags(input: FakeJobInput): FakeJobFlag[] {
  const flags: FakeJobFlag[] = [];
  const desc = (input.description + " " + input.title).toLowerCase();

  // 1. Scam keyword detection
  for (const kw of SCAM_KEYWORDS) {
    if (desc.includes(kw)) {
      flags.push({ type: "scam_keywords", severity: "danger", label: `Scam indicator: "${kw}"` });
      break; // one is enough
    }
  }

  // 2. Hidden/missing company
  if (!input.company || /^(unknown|confidential|n\/a|tbd|hiring|company)$/i.test(input.company.trim())) {
    flags.push({ type: "hidden_company", severity: "warning", label: "Company name withheld" });
  }

  // 3. Missing required fields
  const missingFields: string[] = [];
  if (!input.description || input.description.trim().length < 50) missingFields.push("description");
  if (!input.location || input.location.trim().length < 2) missingFields.push("location");
  if (!input.title || input.title.trim().length < 3) missingFields.push("title");
  if (missingFields.length > 0) {
    flags.push({ type: "missing_fields", severity: "warning", label: `Missing: ${missingFields.join(", ")}` });
  }

  // 4. Job age (stale postings)
  if (input.jobAge !== undefined) {
    if (input.jobAge > 45) {
      flags.push({ type: "age", severity: "danger", label: `Posted ${input.jobAge}d ago — likely filled` });
    } else if (input.jobAge > 30) {
      flags.push({ type: "age", severity: "warning", label: `Posted ${input.jobAge}d ago — may be stale` });
    }
  }

  // 5. Duplicate detection (same title appears multiple times)
  if (input.allJobTitles) {
    const normalizedTitle = input.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const dupeCount = input.allJobTitles.filter(
      t => t.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedTitle
    ).length;
    if (dupeCount > 1) {
      flags.push({ type: "duplicate", severity: "warning", label: "Duplicate posting detected" });
    }
  }

  // 6. Suspicious URL
  if (input.url) {
    const urlLower = input.url.toLowerCase();
    for (const pattern of SUSPICIOUS_URL_PATTERNS) {
      if (urlLower.includes(pattern)) {
        flags.push({ type: "suspicious_url", severity: "danger", label: "Suspicious application link" });
        break;
      }
    }
  }

  return flags;
}

export function getTrustScore(flags: FakeJobFlag[]): { score: number; level: "trusted" | "caution" | "risky" } {
  let score = 100;
  for (const f of flags) {
    score -= f.severity === "danger" ? 30 : 15;
  }
  score = Math.max(0, Math.min(100, score));
  const level = score >= 70 ? "trusted" : score >= 40 ? "caution" : "risky";
  return { score, level };
}

// ── Response Probability Model ──────────────────────────────────────

export interface HistoricalOutcomes {
  totalApplications: number;
  totalResponses: number;
  avgResponseRate: number; // 0–100
  avgDaysToResponse: number;
}

interface ResponseProbInput {
  matchScore: number; // 0–100
  jobAge: number; // days
  competitionLevel: "low" | "medium" | "high";
  trustScore: number; // 0–100
  historicalOutcomes?: HistoricalOutcomes;
  skillMatchRatio?: number; // 0–1
  isRemote?: boolean;
}

export function calculateResponseProbability(input: ResponseProbInput): number {
  let prob = 0;

  // Base from match score (weight: 35%)
  prob += input.matchScore * 0.35;

  // Job freshness (weight: 25%)
  if (input.jobAge <= 2) prob += 25;
  else if (input.jobAge <= 5) prob += 20;
  else if (input.jobAge <= 10) prob += 12;
  else if (input.jobAge <= 21) prob += 5;
  else if (input.jobAge <= 30) prob += 0;
  else prob -= 10;

  // Competition adjustment (weight: 15%)
  if (input.competitionLevel === "low") prob += 15;
  else if (input.competitionLevel === "medium") prob += 7;
  else prob -= 5;

  // Trust factor (weight: 10%)
  prob += (input.trustScore / 100) * 10;

  // Historical outcomes adjustment (weight: 15%)
  if (input.historicalOutcomes && input.historicalOutcomes.totalApplications >= 3) {
    const histRate = input.historicalOutcomes.avgResponseRate;
    // Blend historical with predicted
    prob = prob * 0.7 + histRate * 0.3;
  }

  // Skill match bonus
  if (input.skillMatchRatio !== undefined) {
    prob += input.skillMatchRatio * 10;
  }

  // Remote competition penalty
  if (input.isRemote) prob -= 3;

  return Math.max(5, Math.min(95, Math.round(prob)));
}

// ── Strategy recommendation ─────────────────────────────────────────

export type JobStrategy = "apply_now" | "apply_fast" | "improve_first" | "skip";

export function getJobStrategy(
  matchScore: number,
  responseProbability: number,
  trustLevel: "trusted" | "caution" | "risky",
  jobAge: number
): JobStrategy {
  if (trustLevel === "risky") return "skip";
  if (matchScore >= 65 && responseProbability >= 40) {
    return jobAge <= 3 ? "apply_fast" : "apply_now";
  }
  if (matchScore >= 40) return "improve_first";
  return "skip";
}

export const STRATEGY_CONFIG = {
  apply_now: { label: "Apply Now", colorClass: "bg-success/15 text-success border-success/30" },
  apply_fast: { label: "Apply Fast!", colorClass: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400" },
  improve_first: { label: "Improve Resume First", colorClass: "bg-warning/15 text-warning border-warning/30" },
  skip: { label: "Low Priority", colorClass: "bg-muted text-muted-foreground border-border" },
} as const;

export const TRUST_LEVEL_CONFIG = {
  trusted: { label: "Trusted", colorClass: "text-success", icon: "shield-check" },
  caution: { label: "Caution", colorClass: "text-warning", icon: "shield-alert" },
  risky: { label: "Risky", colorClass: "text-destructive", icon: "shield-x" },
} as const;

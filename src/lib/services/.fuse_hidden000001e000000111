/**
 * Benefits Service — Isolated module for benefit extraction and classification.
 * No dependencies on other services. Only depends on shared types.
 */

import type { BenefitCategory, StructuredBenefit } from "./types";

// ─── Benefit Taxonomy ─────────────────────────────────────────────────────────

const BENEFIT_TAXONOMY: { category: BenefitCategory; label: string; keywords: RegExp }[] = [
  { category: "salary", label: "Competitive Salary", keywords: /\b(salary|compensation|pay\s*range|base\s*pay|annual\s*pay|competitive\s*pay)\b/i },
  { category: "health_insurance", label: "Health Insurance", keywords: /\b(health\s*insurance|medical\s*(coverage|insurance|plan)|healthcare|health\s*plan|medical\s*benefits)\b/i },
  { category: "dental_insurance", label: "Dental Insurance", keywords: /\b(dental\s*(insurance|coverage|plan|benefits))\b/i },
  { category: "vision_insurance", label: "Vision Insurance", keywords: /\b(vision\s*(insurance|coverage|plan|benefits))\b/i },
  { category: "life_insurance", label: "Life Insurance", keywords: /\b(life\s*(insurance|coverage))\b/i },
  { category: "disability_insurance", label: "Disability Insurance", keywords: /\b(disability\s*(insurance|coverage)|short[\s-]*term\s*disability|long[\s-]*term\s*disability|std\/ltd|std\b|ltd\b)/i },
  { category: "flexible_hours", label: "Flexible Hours", keywords: /\b(flex(ible)?\s*(hours|schedule|work)|flextime|work[\s-]*life\s*balance)\b/i },
  { category: "remote_work", label: "Remote Work", keywords: /\b(remote\s*(work|option|friendly|first)|work\s*from\s*home|hybrid\s*work|telecommut)/i },
  { category: "learning_budget", label: "Learning & Development", keywords: /\b(learning\s*(budget|stipend|allowance)|professional\s*development|training\s*(budget|program|allowance)|conference\s*(budget|attendance)|education\s*budget)\b/i },
  { category: "tuition_reimbursement", label: "Tuition Reimbursement", keywords: /\b(tuition\s*(reimbursement|assistance|repayment)|education\s*(reimbursement|assistance)|student\s*loan\s*(repayment|assistance))\b/i },
  { category: "paid_holidays", label: "Paid Holidays", keywords: /\b(paid\s*holidays?|company\s*holidays?|holiday\s*pay)\b/i },
  { category: "referral_bonus", label: "Referral Bonus", keywords: /\b(referral\s*(bonus|program)|employee\s*referral)\b/i },
  { category: "retirement_401k", label: "401(k) / Retirement", keywords: /\b(401\s*\(?k\)?|retirement\s*(plan|benefits|savings)|pension|rsp|rrsp|employer\s*match)\b/i },
  { category: "stock_options", label: "Stock Options / Equity", keywords: /\b(stock\s*(options|grants)|equity|espp|rsu|restricted\s*stock)\b/i },
  { category: "parental_leave", label: "Parental Leave", keywords: /\b(parental\s*leave|maternity\s*leave|paternity\s*leave|family\s*leave|paid\s*family)\b/i },
  { category: "wellness_program", label: "Wellness Program", keywords: /\b(wellness\s*(program|benefit|stipend|allowance)|employee\s*wellness|health\s*wellness)\b/i },
  { category: "commuter_benefits", label: "Commuter Benefits", keywords: /\b(commuter\s*(benefits|stipend|allowance)|transit\s*(benefit|pass|subsidy)|parking\s*(benefit|stipend))\b/i },
  { category: "relocation_assistance", label: "Relocation Assistance", keywords: /\b(relocation\s*(assistance|package|bonus|support)|moving\s*(assistance|expenses))\b/i },
  { category: "employee_discount", label: "Employee Discounts", keywords: /\b(employee\s*discount|staff\s*discount|product\s*discount)\b/i },
  { category: "pto", label: "Paid Time Off", keywords: /\b(paid\s*time\s*off|pto|vacation\s*(days?|time|policy)|unlimited\s*(pto|vacation)|generous\s*(pto|vacation)|sick\s*(leave|days?|time))\b/i },
  { category: "mental_health", label: "Mental Health Support", keywords: /\b(mental\s*health|eap|employee\s*assistance\s*program|counseling\s*(benefit|service)|therapy\s*(benefit|coverage))\b/i },
  { category: "childcare", label: "Childcare Support", keywords: /\b(childcare|child\s*care|daycare|dependent\s*care|backup\s*care)\b/i },
  { category: "gym_membership", label: "Gym / Fitness", keywords: /\b(gym\s*(membership|benefit|stipend|reimbursement)|fitness\s*(benefit|stipend|membership|reimbursement)|on[\s-]*site\s*gym)\b/i },
  { category: "bonus", label: "Performance Bonus", keywords: /\b(annual\s*bonus|performance\s*bonus|sign[\s-]*on\s*bonus|signing\s*bonus|bonus\s*program|incentive\s*(bonus|pay|compensation))\b/i },
];

// Lines that are clearly NOT benefits
const BENEFIT_EXCLUSION_PATTERNS = [
  /\b(must\s+have|required|minimum|at\s+least|experience\s+(with|in)|proficien|responsible\s+for|you\s+will|duties\s+include|qualifications?|requirements?)\b/i,
  /\b(manage|develop|design|implement|maintain|analyze|build|create|lead|drive|execute|oversee|coordinate|collaborate|evaluate|optimize|define|deliver|support|ensure|troubleshoot|monitor|configure|deploy|test|review|document|integrate|automate)\s+(a\s+|the\s+|with\s+|and\s+)?(team|project|system|strategy|program|solution|architecture|stakeholder|process|tool|platform|infrastructure|code|software|product|service|client|customer|data|report|security|compliance|risk|audit|policy|vendor|partner|budget)/i,
  /\b\d+\+?\s*years?\s+(of\s+)?experience\b/i,
  /\b(bachelor|master|phd|degree|diploma|certification\s+required)\b/i,
  /\b(strong\s+knowledge|deep\s+understanding|hands[\s-]on\s+experience|proven\s+(ability|track\s+record)|demonstrated\s+experience|expertise\s+in|knowledge\s+of|familiarity\s+with|ability\s+to)\b/i,
  /\b(python|java|javascript|typescript|react|angular|aws|azure|gcp|docker|kubernetes|sql|linux|terraform|jenkins|git|jira)\b/i,
  /\b(we\s+are\s+(a|an|the)|our\s+company|founded\s+in|headquartered|we\s+believe|our\s+team|join\s+our|our\s+mission|industry[\s-]leading|innovative\s+solutions)\b/i,
  /\b(apply\s+(now|here|today|online)|submit\s+(your|a)\s+(resume|application)|how\s+to\s+apply)\b/i,
  /\b(equal\s+opportunity|eeo|affirmative\s+action|without\s+regard\s+to|reasonable\s+accommodation)\b/i,
];

/**
 * Extract structured benefits from job text.
 * Uses strict section-bounded text first, falls back to keyword scanning.
 */
export function extractBenefits(fullJobText: string, benefitsSectionText: string): StructuredBenefit[] {
  const seen = new Set<BenefitCategory>();
  const results: StructuredBenefit[] = [];

  const scanLines = (text: string, maxItems: number) => {
    if (!text.trim()) return { matchedLines: 0, totalCandidateLines: 0 };
    const lines = text
      .split("\n")
      .map(l => l.trim().replace(/^[-•●▪*→➤►▸>]\s*/, ""))
      .filter(l => l.length > 3 && l.length < 200);

    let matchedLines = 0;
    let totalCandidateLines = 0;

    for (const line of lines) {
      if (results.length >= maxItems) break;
      if (BENEFIT_EXCLUSION_PATTERNS.some(p => p.test(line))) continue;
      totalCandidateLines++;

      for (const entry of BENEFIT_TAXONOMY) {
        if (seen.has(entry.category)) continue;
        if (entry.keywords.test(line)) {
          const metadata: Record<string, string> = {};
          const salaryMatch = line.match(/\$[\d,]+(?:k)?(?:\s*[-–—to]\s*\$[\d,]+(?:k)?)?(?:\s*\/\s*(?:year|yr|annually|month|hr|hour))?/i);
          if (salaryMatch) metadata.range = salaryMatch[0];

          seen.add(entry.category);
          results.push({
            category: entry.category,
            label: entry.label,
            rawText: line,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
          matchedLines++;
          break;
        }
      }
    }
    return { matchedLines, totalCandidateLines };
  };

  // 1. Primary: scan dedicated benefits section
  if (benefitsSectionText.trim()) {
    const stats = scanLines(benefitsSectionText, 24);
    if (stats.totalCandidateLines > 3 && stats.matchedLines / stats.totalCandidateLines < 0.15) {
      results.length = 0;
      seen.clear();
    }
  }

  // 2. Fallback: scan full text capped at 8
  if (results.length === 0) {
    scanLines(fullJobText, 8);
  }

  // 3. Look for salary info if not already found
  if (!seen.has("salary")) {
    const salaryLine = fullJobText.split("\n").find(l =>
      /\$[\d,]+(?:k)?(?:\s*[-–—to]\s*\$[\d,]+(?:k)?)/i.test(l) &&
      /\b(salary|compensation|pay|range|base|annual|total\s*comp)\b/i.test(l) &&
      !BENEFIT_EXCLUSION_PATTERNS.some(p => p.test(l))
    );
    if (salaryLine) {
      const salaryMatch = salaryLine.match(/\$[\d,]+(?:k)?(?:\s*[-–—to]\s*\$[\d,]+(?:k)?)?(?:\s*\/\s*(?:year|yr|annually))?/i);
      seen.add("salary");
      results.unshift({
        category: "salary",
        label: "Competitive Salary",
        rawText: salaryLine.trim(),
        metadata: salaryMatch ? { range: salaryMatch[0] } : undefined,
      });
    }
  }

  return results;
}

/**
 * Job Service — Parser
 * All job description parsing logic lives here.
 * Includes: About the Company extraction, Benefits extraction, Job description cleanup.
 * No imports from other services. No cross-service dependencies.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

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
  rawText: string;
  metadata?: Record<string, string>;
}

export interface ParsedJobSections {
  requirementsText: string;
  benefitsText: string;
  companyText: string;
  fullText: string;
}

// ─── Company Extraction ───────────────────────────────────────────────────────
// Headers: "about the company", "about us", "who we are", "company overview", "our company"
// Stop at: "responsibilities", "requirements", "benefits", "salary", "job description"
// If not found: use sentence-based fallback (max 120 words)
// Do NOT fallback to full job description
// Max output: 1200 characters

const MAX_COMPANY_TEXT_LENGTH = 1200;

const COMPANY_HEADERS = [
  "about the company", "about us", "who we are",
  "company overview", "our company", "company description",
  "about the organization", "our mission", "about the team",
];

const COMPANY_STOP_HEADERS = [
  "responsibilities", "requirements", "qualifications",
  "job description", "salary", "compensation", "benefits",
  "perks", "what you'll do", "role overview", "key responsibilities",
  "required qualifications", "preferred qualifications", "minimum qualifications",
  "what you'll bring", "who you are", "desired qualifications",
];

const COMPANY_EXCLUSION_PATTERNS = [
  /\b(must\s+have|years?\s+of\s+experience|required|proficien\w*)/i,
  /\b(responsible\s+for|you\s+will|duties\s+include)/i,
  /\b(apply\s+now|click\s+here|submit\s+your)/i,
  /\b(equal\s+opportunity|eeo|accommodation|disability)/i,
];

/**
 * Extract company section from job description.
 * Uses header-bounded extraction first. Falls back to signal-based sentence
 * extraction (max 120 words). Never returns full description.
 * Output capped at 1200 characters.
 */
export function extractCompanySection(fullText: string): string {
  const lower = fullText.toLowerCase();
  let startIndex = -1;
  let matchedHeaderLen = 0;

  for (const header of COMPANY_HEADERS) {
    const idx = lower.indexOf(header);
    if (idx !== -1 && (startIndex === -1 || idx < startIndex)) {
      startIndex = idx;
      matchedHeaderLen = header.length;
    }
  }

  if (startIndex !== -1) {
    let endIndex = fullText.length;
    const searchFrom = startIndex + matchedHeaderLen + 10;
    for (const stop of COMPANY_STOP_HEADERS) {
      const idx = lower.indexOf(stop, searchFrom);
      if (idx !== -1 && idx < endIndex) {
        let lineStart = idx;
        while (lineStart > 0 && fullText[lineStart - 1] !== "\n") lineStart--;
        if (lineStart < endIndex) endIndex = lineStart;
      }
    }

    let section = fullText.slice(startIndex, endIndex).trim();
    const firstNewline = section.indexOf("\n");
    if (firstNewline !== -1) section = section.slice(firstNewline + 1).trim();

    const cleanLines = section.split("\n").filter(line => {
      const t = line.trim();
      if (!t) return true;
      return !COMPANY_EXCLUSION_PATTERNS.some(p => p.test(t));
    });

    let result = cleanLines.join("\n").trim();
    if (result.length > MAX_COMPANY_TEXT_LENGTH) result = result.slice(0, MAX_COMPANY_TEXT_LENGTH);
    return result;
  }

  // Fallback: extract sentences with company signals (max 120 words, no full description)
  const COMPANY_SIGNALS = /\b(we\s+are|our\s+company|founded\s+in|headquartered|our\s+mission|we\s+build|we\s+provide|we\s+help|leading\s+provider|industry\s+leader|our\s+team|we\s+believe)\b/i;
  const sentences = fullText.split(/(?<=[.!?])\s+/);
  const compSentences = sentences
    .filter(s => COMPANY_SIGNALS.test(s) && s.length < 300)
    .filter(s => !COMPANY_EXCLUSION_PATTERNS.some(p => p.test(s)))
    .slice(0, 6);

  const words = compSentences.join(" ").trim().split(/\s+/).slice(0, 120);
  const fallback = words.join(" ").trim();
  if (fallback.length > MAX_COMPANY_TEXT_LENGTH) return fallback.slice(0, MAX_COMPANY_TEXT_LENGTH);
  return fallback;
}

// ─── Benefits Extraction ──────────────────────────────────────────────────────

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
  if (results.length === 0) scanLines(fullJobText, 8);

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

// ─── Section Parser ───────────────────────────────────────────────────────────

const REQUIREMENTS_HEADERS = [
  /\b(requirements?|qualifications?|desired\s+qualifications?|required\s+skills?|must[\s-]have|what\s+you.?ll?\s+need|what\s+we.?re?\s+looking\s+for|minimum\s+qualifications?|preferred\s+qualifications?|key\s+skills?|technical\s+skills?|core\s+competencies|essential\s+skills?|experience\s+required|you\s+should\s+have|you\s+bring|about\s+you|your\s+background|skills?\s+&?\s*experience|responsibilities|what\s+you.?ll?\s+do|duties|role\s+description|the\s+role|job\s+duties|key\s+responsibilities|accountabilities)\b/i,
];

const BENEFITS_HEADERS = [
  /\b(benefits?\s*(&|and)?\s*perks?|employee\s+benefits|what\s+we\s+offer|why\s+join\s+us|why\s+work\s+here|our\s+benefits|total\s+rewards|we\s+offer|package\s+includes|perks?\s*(&|and)?\s*benefits?)\b/i,
];

const COMPENSATION_ONLY_HEADER = /^\s*\**\s*compensation\s*:?\s*\**\s*$/i;

const NON_REQUIREMENTS_HEADERS = [
  /\b(benefits?|perks?|what\s+we\s+offer|why\s+join|why\s+work\s+here|about\s+us|about\s+the\s+company|company\s+overview|our\s+mission|our\s+culture|equal\s+opportunity|eeo|disclaimer|how\s+to\s+apply|application\s+process|legal|privacy|accommodation)\b/i,
];

const MAX_BENEFITS_TEXT_LENGTH = 1500;

/**
 * Parse a job description into isolated sections.
 * Returns structured sections that downstream consumers can use independently.
 */
export function parseJobSections(jobDescription: string): ParsedJobSections {
  const lines = jobDescription.split("\n");
  const sections: { header: string; lines: string[]; type: "req" | "benefit" | "company" | "other" }[] = [];
  let currentSection: typeof sections[0] = { header: "", lines: [], type: "other" };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { currentSection.lines.push(line); continue; }

    const isHeaderLike = (trimmed.length < 80 && (
      /^#{1,4}\s/.test(trimmed) ||
      /^[A-Z][A-Z\s&/]{3,}:?\s*$/.test(trimmed) ||
      /^\*\*[^*]{3,60}\*\*:?\s*$/.test(trimmed) ||
      (/:\s*$/.test(trimmed) && trimmed.length < 50 && !/\b(is|are|was|were|will|would|should|can|could|has|have|had)\b/i.test(trimmed))
    ));

    if (isHeaderLike) {
      if (currentSection.lines.length > 0 || currentSection.header) sections.push(currentSection);
      let sectionType: "req" | "benefit" | "company" | "other" = "other";
      if (REQUIREMENTS_HEADERS.some(r => r.test(trimmed))) sectionType = "req";
      else if (BENEFITS_HEADERS.some(r => r.test(trimmed)) || COMPENSATION_ONLY_HEADER.test(trimmed)) sectionType = "benefit";
      else if (/\b(about\s+(us|the\s+company)|company\s+overview|our\s+mission|who\s+we\s+are)\b/i.test(trimmed)) sectionType = "company";
      else if (NON_REQUIREMENTS_HEADERS.some(r => r.test(trimmed))) sectionType = "other";
      currentSection = { header: trimmed, lines: [], type: sectionType };
    } else {
      currentSection.lines.push(line);
    }
  }
  if (currentSection.lines.length > 0 || currentSection.header) sections.push(currentSection);

  const reqSections = sections.filter(s => s.type === "req");
  const benefitSections = sections.filter(s => s.type === "benefit");
  const companySections = sections.filter(s => s.type === "company");

  const requirementsText = reqSections.length > 0
    ? reqSections.map(s => s.lines.join("\n")).join("\n")
    : sections.filter(s => s.type !== "benefit" && s.type !== "company").map(s => s.lines.join("\n")).join("\n");

  let benefitsText = benefitSections.map(s => s.lines.join("\n")).join("\n").trim();
  if (benefitsText.length > MAX_BENEFITS_TEXT_LENGTH) benefitsText = benefitsText.slice(0, MAX_BENEFITS_TEXT_LENGTH);

  const companyText = companySections.map(s => s.lines.join("\n")).join("\n").trim();

  return { requirementsText, benefitsText, companyText, fullText: jobDescription };
}

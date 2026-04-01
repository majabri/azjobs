/**
 * Company Service — Isolated module for company information extraction.
 * No dependencies on other services. Only depends on shared types.
 */

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
  /\b(must\s+have|years?\s+of\s+experience|required|proficien)/i,
  /\b(responsible\s+for|you\s+will|duties\s+include)/i,
  /\b(apply\s+now|click\s+here|submit\s+your)/i,
  /\b(equal\s+opportunity|eeo|accommodation|disability)/i,
];

/**
 * Extract company section with strict boundaries.
 * Falls back to keyword-based sentence extraction if no header found.
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
    if (firstNewline !== -1) {
      section = section.slice(firstNewline + 1).trim();
    }

    const cleanLines = section.split("\n").filter(line => {
      const t = line.trim();
      if (!t) return true;
      return !COMPANY_EXCLUSION_PATTERNS.some(p => p.test(t));
    });

    let result = cleanLines.join("\n").trim();
    if (result.length > MAX_COMPANY_TEXT_LENGTH) {
      result = result.slice(0, MAX_COMPANY_TEXT_LENGTH);
    }
    return result;
  }

  // Fallback: extract sentences with company signals
  const COMPANY_SIGNALS = /\b(we\s+are|our\s+company|founded\s+in|headquartered|our\s+mission|we\s+build|we\s+provide|we\s+help|leading\s+provider|industry\s+leader|our\s+team|we\s+believe)\b/i;
  const sentences = fullText.split(/(?<=[.!?])\s+/);
  const compSentences = sentences
    .filter(s => COMPANY_SIGNALS.test(s) && s.length < 300)
    .filter(s => !COMPANY_EXCLUSION_PATTERNS.some(p => p.test(s)))
    .slice(0, 6);

  const fallback = compSentences.join(" ").trim();
  if (fallback.length > MAX_COMPANY_TEXT_LENGTH) {
    return fallback.slice(0, MAX_COMPANY_TEXT_LENGTH);
  }
  return fallback;
}

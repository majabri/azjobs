/**
 * Section Parser Service — Isolates job description section detection.
 * No dependencies on other services. Only depends on shared types.
 */

import type { ParsedJobSections } from "./types";

// ─── Section Header Patterns ─────────────────────────────────────────────────

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
 * Returns structured sections that downstream services can consume independently.
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
      if (currentSection.lines.length > 0 || currentSection.header) {
        sections.push(currentSection);
      }
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
  if (currentSection.lines.length > 0 || currentSection.header) {
    sections.push(currentSection);
  }

  const reqSections = sections.filter(s => s.type === "req");
  const benefitSections = sections.filter(s => s.type === "benefit");
  const companySections = sections.filter(s => s.type === "company");

  const requirementsText = reqSections.length > 0
    ? reqSections.map(s => s.lines.join("\n")).join("\n")
    : sections.filter(s => s.type !== "benefit" && s.type !== "company").map(s => s.lines.join("\n")).join("\n");

  let benefitsText = benefitSections.map(s => s.lines.join("\n")).join("\n").trim();
  if (benefitsText.length > MAX_BENEFITS_TEXT_LENGTH) {
    benefitsText = benefitsText.slice(0, MAX_BENEFITS_TEXT_LENGTH);
  }

  const companyText = companySections.map(s => s.lines.join("\n")).join("\n").trim();

  return { requirementsText, benefitsText, companyText, fullText: jobDescription };
}

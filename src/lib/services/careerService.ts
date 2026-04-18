/**
 * Career Service — Isolated module for career level detection and job title extraction.
 * No dependencies on other services. Only depends on shared types.
 */

import type { ExtractedProfile } from "./types";
import { extractSkillsWithCategories } from "./skillService";

// ─── Career Level Detection ──────────────────────────────────────────────────

const CAREER_LEVEL_PATTERNS: { level: string; patterns: RegExp[]; weight: number }[] = [
  {
    level: "C-Level / Executive",
    patterns: [
      /\b(chief|cto|cio|ciso|cfo|ceo|coo|cmo)\b/i,
      /\bchief\s+(technology|information|security|financial|executive|operating|marketing)\s+officer\b/i,
      /\bexecutive\s+(vice\s+president|director)\b/i,
      /\bevp\b/i,
    ],
    weight: 100,
  },
  {
    level: "VP / Senior Leadership",
    patterns: [
      /\b(vice\s+president|v\.?p\.?)\s+(of\s+)?\w/i,
      /\bvp\s+(of\s+)?\w/i,
      /\bsvp\b/i,
      /\bsenior\s+vice\s+president\b/i,
      /\bhead\s+of\b/i,
      /\bbiso\b/i,
      /\bbusiness\s+information\s+security\s+officer\b/i,
      /\bglobal\s+head\b/i,
      /\bregional\s+head\b/i,
    ],
    weight: 90,
  },
  {
    level: "Director",
    patterns: [/\bdirector\b/i, /\bsenior\s+director\b/i, /\bmanaging\s+director\b/i, /\bglobal\s+director\b/i],
    weight: 80,
  },
  {
    level: "Senior Manager / Principal",
    patterns: [
      /\bsenior\s+manager\b/i, /\bprincipal\b/i,
      /\bstaff\s+(engineer|architect|scientist)\b/i,
      /\bdistinguished\s+(engineer|architect)\b/i,
    ],
    weight: 70,
  },
  {
    level: "Manager",
    patterns: [/\bmanager\b/i, /\bteam\s+lead\b/i, /\blead\s+(engineer|developer|architect|analyst)\b/i],
    weight: 60,
  },
  {
    level: "Senior",
    patterns: [/\bsenior\b/i, /\bsr\.?\b/i, /\bsenior\s+(engineer|developer|analyst|consultant|architect|specialist)\b/i],
    weight: 50,
  },
  {
    level: "Mid-Level",
    patterns: [/\b(engineer|developer|analyst|consultant|specialist|coordinator|administrator)\b/i],
    weight: 30,
  },
  {
    level: "Entry-Level / Junior",
    patterns: [/\bjunior\b/i, /\bassociate\b/i, /\bentry[\s-]level\b/i, /\bintern\b/i],
    weight: 10,
  },
];

export function detectCareerLevel(text: string): string {
  let highestWeight = 0;
  let detectedLevel = "Mid-Level";

  for (const { level, patterns, weight } of CAREER_LEVEL_PATTERNS) {
    for (const p of patterns) {
      if (p.test(text)) {
        if (weight > highestWeight) {
          highestWeight = weight;
          detectedLevel = level;
        }
        break;
      }
    }
  }
  return detectedLevel;
}

// ─── Job Title Extraction ────────────────────────────────────────────────────

const ACRONYM_TITLES: { pattern: RegExp; expanded: string }[] = [
  { pattern: /\bbiso\b/i, expanded: "Business Information Security Officer" },
  { pattern: /\bciso\b/i, expanded: "Chief Information Security Officer" },
  { pattern: /\bcto\b/i, expanded: "Chief Technology Officer" },
  { pattern: /\bcio\b/i, expanded: "Chief Information Officer" },
  { pattern: /\bcso\b/i, expanded: "Chief Security Officer" },
  { pattern: /\bisso\b/i, expanded: "Information System Security Officer" },
  { pattern: /\bissm\b/i, expanded: "Information System Security Manager" },
  { pattern: /\bisse\b/i, expanded: "Information Systems Security Engineer" },
  { pattern: /\bissep\b/i, expanded: "Information Systems Security Engineering Professional" },
  { pattern: /\bissa\b/i, expanded: "Information Systems Security Architect" },
  { pattern: /\bdpo\b/i, expanded: "Data Protection Officer" },
  { pattern: /\bvciso\b/i, expanded: "Virtual Chief Information Security Officer" },
  { pattern: /\bsoc\s+analyst\b/i, expanded: "SOC Analyst" },
  { pattern: /\bsoc\s+manager\b/i, expanded: "SOC Manager" },
  { pattern: /\bsoc\s+lead\b/i, expanded: "SOC Lead" },
  { pattern: /\bsoc\s+engineer\b/i, expanded: "SOC Engineer" },
  { pattern: /\birt\s+lead\b/i, expanded: "Incident Response Team Lead" },
  { pattern: /\bcsirt\b/i, expanded: "Computer Security Incident Response Team" },
];

export function extractJobTitles(text: string): string[] {
  const titles = new Set<string>();

  for (const { pattern, expanded } of ACRONYM_TITLES) {
    if (pattern.test(text)) titles.add(expanded);
  }

  const compoundPatterns = [
    /\b(vice\s+president|vp)\s+(?:of\s+)?[\w\s,&/]+?(?=\n|\||–|—|\d{4}|$)/gim,
    /\bdirector\s+(?:of\s+)?[\w\s,&/]+?(?=\n|\||–|—|\d{4}|$)/gim,
    /\bhead\s+of\s+[\w\s,&/]+?(?=\n|\||–|—|\d{4}|$)/gim,
  ];
  for (const cp of compoundPatterns) {
    let m: RegExpExecArray | null;
    while ((m = cp.exec(text)) !== null) {
      const title = m[0].trim().replace(/[,|–—]+\s*$/, "").trim();
      if (title.length > 5 && title.length < 100) titles.add(title);
    }
  }

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length < 4 || line.length > 120) continue;
    const titleIndicators = [
      /vice\s+president/i, /v\.?p\.?\s/i, /\bvp\b/i, /director/i, /manager/i,
      /engineer/i, /architect/i, /analyst/i, /consultant/i, /specialist/i,
      /officer/i, /lead\b/i, /head\s+of/i, /principal/i, /chief/i,
      /coordinator/i, /administrator/i, /developer/i, /designer/i,
      /strategist/i, /scientist/i, /\bbiso\b/i,
    ];
    const isTitle = titleIndicators.some(p => p.test(line));
    const isBullet = /^[-•●▪]/.test(line) || line.length > 80;
    if (isTitle && !isBullet) {
      const title = line.replace(/^#+ /, "").replace(/[,|–—]\s*\d{4}.*$/, "").replace(/\s*\(.*?\)\s*$/, "").replace(/["']/g, "").trim();
      if (title.length > 4 && title.length < 100) titles.add(title);
    }
  }

  return Array.from(titles).slice(0, 10);
}

// ─── Profile Extraction ──────────────────────────────────────────────────────

export function extractProfileFromResume(resumeText: string): ExtractedProfile {
  const skillsWithCats = extractSkillsWithCategories(resumeText);
  const skills = skillsWithCats.map(s => s.skill);

  const skillCategories: Record<string, string[]> = {};
  for (const { skill, category } of skillsWithCats) {
    if (!skillCategories[category]) skillCategories[category] = [];
    skillCategories[category].push(skill);
  }

  const careerLevel = detectCareerLevel(resumeText);
  const jobTitles = extractJobTitles(resumeText);

  const certPatterns = [
    /cissp/i, /cism/i, /cisa/i, /ceh/i, /oscp/i, /pmp/i,
    /comptia\s+\w+/gi, /aws\s+certified/gi, /azure\s+certified/gi,
    /ccna/i, /ccnp/i, /itil/i, /csm/i, /togaf/i, /sabsa/i,
    /certified\s+[\w\s]+professional/gi,
    /certified\s+[\w\s]+specialist/gi,
    /certified\s+[\w\s]+manager/gi,
    /nstissi/i, /cnss/i,
  ];
  const certs = new Set<string>();
  for (const p of certPatterns) {
    const matches = resumeText.match(p);
    if (matches) matches.forEach(m => certs.add(m.trim()));
  }

  return { skills, skillCategories, careerLevel, jobTitles, certifications: Array.from(certs) };
}

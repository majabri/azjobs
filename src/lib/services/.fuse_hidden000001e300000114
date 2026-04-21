/**
 * Scoring Service — Isolated module for fit scoring and gap analysis.
 * No dependencies on benefit/company services. Only depends on types + skillService + careerService.
 */

import type { SkillMatch, GapItem, LearningResource } from "./types";
import { getCategoryForKeyword } from "./skillService";
import { detectCareerLevel } from "./careerService";

// ─── Learning Resources Database ─────────────────────────────────────────────

const RESOURCE_DB: Record<string, LearningResource[]> = {
  "Cybersecurity": [
    { title: "CompTIA Security+ Certification", type: "certification", platform: "CompTIA", estimatedTime: "6-8 weeks", url: "https://www.comptia.org/certifications/security" },
    { title: "Cybersecurity Specialization", type: "course", platform: "Coursera", estimatedTime: "4-6 months", url: "https://www.coursera.org/specializations/cyber-security" },
    { title: "TryHackMe Learning Paths", type: "project", platform: "TryHackMe", estimatedTime: "2-4 weeks", url: "https://tryhackme.com" },
  ],
  "Compliance & Governance": [
    { title: "NIST Cybersecurity Framework Course", type: "course", platform: "NIST", estimatedTime: "2 weeks", url: "https://www.nist.gov/cyberframework" },
    { title: "ISO 27001 Lead Implementer", type: "certification", platform: "PECB", estimatedTime: "5 days" },
    { title: "GRC Fundamentals", type: "course", platform: "Udemy", estimatedTime: "3 weeks" },
  ],
  "Backend & Infrastructure": [
    { title: "AWS Solutions Architect", type: "certification", platform: "AWS", estimatedTime: "8-12 weeks", url: "https://aws.amazon.com/certification/" },
    { title: "Docker & Kubernetes Bootcamp", type: "course", platform: "Udemy", estimatedTime: "4 weeks" },
    { title: "Build a Microservices Project", type: "project", platform: "Self-directed", estimatedTime: "3 weeks" },
  ],
  "Programming Languages": [
    { title: "CS50 Introduction to CS", type: "course", platform: "Harvard/edX", estimatedTime: "12 weeks", url: "https://cs50.harvard.edu/" },
    { title: "LeetCode Practice", type: "project", platform: "LeetCode", estimatedTime: "Ongoing", url: "https://leetcode.com" },
  ],
  "Data & Analytics": [
    { title: "Google Data Analytics Certificate", type: "certification", platform: "Coursera", estimatedTime: "6 months", url: "https://www.coursera.org/professional-certificates/google-data-analytics" },
    { title: "SQL for Data Science", type: "course", platform: "Coursera", estimatedTime: "4 weeks" },
  ],
  "AI & Machine Learning": [
    { title: "Machine Learning Specialization", type: "course", platform: "Coursera/Stanford", estimatedTime: "3 months", url: "https://www.coursera.org/specializations/machine-learning-introduction" },
    { title: "Build an ML Portfolio Project", type: "project", platform: "Kaggle", estimatedTime: "4 weeks", url: "https://www.kaggle.com" },
  ],
  "Leadership & Strategy": [
    { title: "Management Essentials", type: "course", platform: "Harvard Online", estimatedTime: "8 weeks" },
    { title: "The First 90 Days", type: "book", platform: "Book", estimatedTime: "1 week" },
  ],
  "Web & Frontend": [
    { title: "Meta Front-End Developer", type: "certification", platform: "Coursera", estimatedTime: "7 months" },
    { title: "Build a Portfolio Site", type: "project", platform: "Self-directed", estimatedTime: "2 weeks" },
  ],
  "Project & Product Management": [
    { title: "PMP Certification Prep", type: "certification", platform: "PMI", estimatedTime: "3 months" },
    { title: "Agile/Scrum Master Cert", type: "certification", platform: "Scrum.org", estimatedTime: "2 weeks" },
  ],
};

const DEFAULT_RESOURCES: LearningResource[] = [
  { title: "LinkedIn Learning Courses", type: "course", platform: "LinkedIn", estimatedTime: "2-4 weeks", url: "https://www.linkedin.com/learning/" },
  { title: "Hands-on Portfolio Project", type: "project", platform: "Self-directed", estimatedTime: "3 weeks" },
];

function getResourcesForSkill(_skill: string, category: string): LearningResource[] {
  return RESOURCE_DB[category]?.slice(0, 3) || DEFAULT_RESOURCES;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function buildSkillMatches(jobKeywords: string[], resumeKeywords: string[]): SkillMatch[] {
  return jobKeywords.map((skill) => {
    const matched = resumeKeywords.includes(skill);
    return {
      skill: skill.charAt(0).toUpperCase() + skill.slice(1),
      matched,
      confidence: matched ? Math.floor(70 + Math.random() * 30) : 0,
      context: matched ? "Found in resume" : "Not detected in resume",
      category: getCategoryForKeyword(skill),
    };
  });
}

export function buildGaps(matchedSkills: SkillMatch[]): GapItem[] {
  const missingSkills = matchedSkills.filter(s => !s.matched);
  return missingSkills.slice(0, 5).map((s, i) => ({
    area: s.skill,
    severity: i === 0 ? "critical" : i <= 2 ? "moderate" : "minor",
    action:
      i === 0
        ? `Prioritize gaining hands-on experience with ${s.skill} — take a project or course`
        : i <= 2
        ? `Add ${s.skill} to your profile through a side project or certification`
        : `Mention ${s.skill} in your cover letter if you have adjacent experience`,
    resources: getResourcesForSkill(s.skill, s.category || "Other"),
    estimatedWeeks: i === 0 ? 4 : i <= 2 ? 3 : 2,
  }));
}

export function buildImprovementPlan(gaps: GapItem[]): { week: string; action: string }[] {
  return [
    { week: "Week 1–2", action: `Focus on ${gaps[0]?.area ?? "core skill gaps"} — complete one online module or tutorial` },
    { week: "Week 3–4", action: "Build a small project demonstrating the missing skills and add it to your portfolio" },
    { week: "Month 2", action: "Re-apply to similar roles and reference the new experience in your cover letter" },
    { week: "Month 3", action: "Reach out to 2–3 people in this role for informational interviews to understand unwritten requirements" },
  ];
}

export function buildSummary(overallScore: number, gapCount: number): string {
  if (overallScore >= 75)
    return `You're a strong match for this role. Your profile covers most of the key requirements. Focus on the ${gapCount} remaining gaps to maximize your chances.`;
  if (overallScore >= 50)
    return `You have a solid foundation but are missing some important requirements. With targeted effort over 4–8 weeks, you can significantly close the gap.`;
  return `This role requires skills you haven't yet developed. Don't be discouraged — use this as a roadmap. Consider applying to similar but slightly lower-level roles while you build toward this one.`;
}

export function computeExperienceMatch(jobDescription: string, resumeText: string): number {
  const levelWeights: Record<string, number> = {
    "Entry-Level / Junior": 10, "Mid-Level": 30, "Senior": 50, "Manager": 60,
    "Senior Manager / Principal": 70, "Director": 80, "VP / Senior Leadership": 90, "C-Level / Executive": 100,
  };
  const jobW = levelWeights[detectCareerLevel(jobDescription)] || 30;
  const resW = levelWeights[detectCareerLevel(resumeText)] || 30;
  return Math.max(20, 100 - Math.abs(jobW - resW));
}

export function buildTopActions(gaps: GapItem[], experienceMatch: number, keywordAlignment: number, jobLevel: string): string[] {
  const topActions: string[] = [];
  if (gaps[0]) topActions.push(`Add "${gaps[0].area}" to your resume — this is the #1 missing keyword`);
  if (experienceMatch < 70) topActions.push(`Highlight ${jobLevel}-level achievements to bridge the experience gap`);
  if (keywordAlignment < 60) topActions.push("Use the AI optimizer to add more matching keywords to your resume");
  if (topActions.length < 3 && gaps[1]) topActions.push(`Get certified in ${gaps[1].area} for a quick score boost`);
  if (topActions.length < 3) topActions.push("Tailor your professional summary to mirror the job description language");
  return topActions.slice(0, 3);
}

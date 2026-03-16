// Simulated analysis engine (POC — no AI backend needed)
// Parses text and produces structured fit analysis

export interface SkillMatch {
  skill: string;
  matched: boolean;
  confidence: number; // 0–100
  context?: string;
}

export interface GapItem {
  area: string;
  severity: "critical" | "moderate" | "minor";
  action: string;
}

export interface FitAnalysis {
  overallScore: number;
  matchedSkills: SkillMatch[];
  gaps: GapItem[];
  strengths: string[];
  improvementPlan: { week: string; action: string }[];
  summary: string;
}

const SKILL_KEYWORDS = [
  "python", "javascript", "typescript", "react", "node", "sql", "aws", "azure", "gcp",
  "machine learning", "data analysis", "project management", "agile", "scrum", "leadership",
  "communication", "excel", "tableau", "power bi", "java", "c++", "docker", "kubernetes",
  "marketing", "sales", "customer success", "product management", "ux", "design", "figma",
  "finance", "accounting", "operations", "strategy", "analytics", "research", "writing",
  "public speaking", "negotiation", "teamwork", "problem solving", "critical thinking",
  "api", "rest", "graphql", "testing", "ci/cd", "devops", "security", "networking",
  "healthcare", "legal", "compliance", "procurement", "supply chain", "logistics",
];

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_KEYWORDS.filter((k) => lower.includes(k));
}

export function extractSkillsFromText(text: string): string[] {
  return extractKeywords(text).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

function scoreOverlap(jobKeywords: string[], resumeKeywords: string[]): number {
  if (jobKeywords.length === 0) return 65;
  const matched = jobKeywords.filter((k) => resumeKeywords.includes(k)).length;
  return Math.round(Math.min(98, (matched / jobKeywords.length) * 100));
}

export function analyzeJobFit(jobDescription: string, resumeText: string): FitAnalysis {
  const jobKeywords = extractKeywords(jobDescription);
  const resumeKeywords = extractKeywords(resumeText);

  const overallScore = scoreOverlap(jobKeywords, resumeKeywords);

  const matchedSkills: SkillMatch[] = jobKeywords.map((skill) => {
    const matched = resumeKeywords.includes(skill);
    return {
      skill: skill.charAt(0).toUpperCase() + skill.slice(1),
      matched,
      confidence: matched ? Math.floor(70 + Math.random() * 30) : 0,
      context: matched ? "Found in resume" : "Not detected in resume",
    };
  });

  const missingSkills = matchedSkills.filter((s) => !s.matched);
  const gaps: GapItem[] = missingSkills.slice(0, 5).map((s, i) => ({
    area: s.skill,
    severity: i === 0 ? "critical" : i <= 2 ? "moderate" : "minor",
    action:
      i === 0
        ? `Prioritize gaining hands-on experience with ${s.skill} — take a project or course`
        : i <= 2
        ? `Add ${s.skill} to your profile through a side project or certification`
        : `Mention ${s.skill} in your cover letter if you have adjacent experience`,
  }));

  const strengths = matchedSkills
    .filter((s) => s.matched)
    .slice(0, 4)
    .map((s) => s.skill);

  const improvementPlan = [
    { week: "Week 1–2", action: `Focus on ${gaps[0]?.area ?? "core skill gaps"} — complete one online module or tutorial` },
    { week: "Week 3–4", action: "Build a small project demonstrating the missing skills and add it to your portfolio" },
    { week: "Month 2", action: "Re-apply to similar roles and reference the new experience in your cover letter" },
    { week: "Month 3", action: "Reach out to 2–3 people in this role for informational interviews to understand unwritten requirements" },
  ];

  const summary =
    overallScore >= 75
      ? `You're a strong match for this role. Your profile covers most of the key requirements. Focus on the ${gaps.length} remaining gaps to maximize your chances.`
      : overallScore >= 50
      ? `You have a solid foundation but are missing some important requirements. With targeted effort over 4–8 weeks, you can significantly close the gap.`
      : `This role requires skills you haven't yet developed. Don't be discouraged — use this as a roadmap. Consider applying to similar but slightly lower-level roles while you build toward this one.`;

  return { overallScore, matchedSkills, gaps, strengths, improvementPlan, summary };
}

export interface CandidateAnalysis {
  name: string;
  resumeText: string;
  score: number;
  matchedSkills: string[];
  gaps: string[];
  recommendation: "interview" | "maybe" | "pass";
}

export function analyzeCandidates(
  jobDescription: string,
  candidates: { name: string; resumeText: string }[]
): CandidateAnalysis[] {
  const jobKeywords = extractKeywords(jobDescription);

  return candidates
    .map((c) => {
      const resumeKeywords = extractKeywords(c.resumeText);
      const score = scoreOverlap(jobKeywords, resumeKeywords);
      const matchedSkills = jobKeywords.filter((k) => resumeKeywords.includes(k));
      const gaps = jobKeywords.filter((k) => !resumeKeywords.includes(k));

      return {
        name: c.name,
        resumeText: c.resumeText,
        score,
        matchedSkills: matchedSkills.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
        gaps: gaps.slice(0, 4).map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
        recommendation: (score >= 70 ? "interview" : score >= 45 ? "maybe" : "pass") as
          | "interview"
          | "maybe"
          | "pass",
      };
    })
    .sort((a, b) => b.score - a.score);
}

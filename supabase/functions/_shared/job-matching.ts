/**
 * Shared job discovery + scoring utilities
 * Used by: run-job-agent, discover-jobs
 */

// ── Domain signal words — must appear in a phrase for it to be kept ───────────
export const DOMAIN_SIGNALS = new Set([
  "security","cyber","cybersecurity","ciso","privacy","compliance","risk","governance",
  "architect","engineering","infrastructure","cloud","devops","data","analytics","ai","ml",
  "product","marketing","finance","legal","operations","procurement","hr","talent","recruiting",
  "sales","design","ux","research","audit","fraud","identity","access","network","systems",
  "nursing","clinical","medical","healthcare","pharma","accounting","controller","treasury",
]);

const TITLE_STOP = new Set([
  "of","and","the","in","for","at","a","an","to","with","by","i","ii","iii","iv",
  "sr","jr","lead","staff","principal","associate",
]);

/**
 * Extract 2-3 word key phrases from a long job title so that "Business
 * Information Security Officer" → ["Information Security","Security Officer"].
 * Filters to phrases containing at least one DOMAIN_SIGNALS word.
 */
export function extractTitleKeyPhrases(title: string): string[] {
  const words = title.replace(/[,&()\./]/g, " ").split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !TITLE_STOP.has(w.toLowerCase()));

  const phrases: string[] = [];
  for (let i = 0; i < words.length; i++) {
    // 2-word phrase
    if (i + 1 < words.length) {
      const p = `${words[i]} ${words[i + 1]}`;
      const lower = p.toLowerCase();
      if ([words[i], words[i + 1]].some(w => DOMAIN_SIGNALS.has(w.toLowerCase()))) {
        phrases.push(p);
      }
    }
    // 3-word phrase
    if (i + 2 < words.length) {
      const p = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if ([words[i], words[i + 1], words[i + 2]].some(w => DOMAIN_SIGNALS.has(w.toLowerCase()))) {
        phrases.push(p);
      }
    }
  }
  return [...new Set(phrases)];
}

// Career-level fallback titles — used when profile has no target_job_titles
export const CAREER_LEVEL_TITLES: Record<string, string[]> = {
  "Entry-Level / Junior": [
    "junior software engineer","entry level analyst","associate engineer",
    "junior developer","entry level coordinator",
  ],
  "Mid-Level": [
    "software engineer","data analyst","product manager",
    "business analyst","marketing manager",
  ],
  "Senior": [
    "senior software engineer","senior engineer","senior analyst",
    "senior manager","senior consultant",
  ],
  "Manager": [
    "engineering manager","product manager","team lead",
    "operations manager","marketing manager",
  ],
  "Director": [
    "director of engineering","director of operations","director of product",
    "director of marketing","director of finance",
  ],
  "VP / Senior Leadership": [
    "VP of Engineering","VP of Product","VP of Operations",
    "VP of Marketing","Vice President",
  ],
  "C-Level / Executive": [
    "CTO","CEO","COO","CISO","Chief Technology Officer",
    "Chief Operating Officer",
  ],
};

/**
 * Derive the list of search titles for a profile.
 * Uses target_job_titles when present; falls back to career-level defaults.
 */
export function resolveTargetTitles(
  targetJobTitles: string[],
  careerLevel: string,
): string[] {
  if (targetJobTitles.length > 0) return targetJobTitles;
  return CAREER_LEVEL_TITLES[careerLevel] ?? ["software engineer","data analyst","product manager"];
}

/**
 * Heuristic match score for a scraped job against a user profile.
 * Returns 0–90 (leaves 10 pts headroom for Claude-based scoring later).
 *
 * Scoring:
 *   +60  — job title contains at least one target title phrase
 *   +5   — each skill found in description (up to 6 skills = +30)
 *   Max  — 90
 */
export function scoreJobHeuristic(
  jobTitle: string,
  jobDescription: string,
  targetTitles: string[],
  skills: string[],
): { score: number; titleMatch: boolean; matchedSkills: string[] } {
  let score = 0;
  const titleLower = (jobTitle || "").toLowerCase();
  const descLower  = (jobDescription || "").toLowerCase();

  // Title match
  const titleMatch = targetTitles.some(t => titleLower.includes(t.toLowerCase()));
  if (titleMatch) score += 60;

  // Skill match
  const matchedSkills: string[] = [];
  for (const skill of skills.slice(0, 10)) {
    if (skill.length >= 2 && descLower.includes(skill.toLowerCase())) {
      matchedSkills.push(skill);
      score += 5;
      if (matchedSkills.length >= 6) break;
    }
  }

  return { score: Math.min(90, score), titleMatch, matchedSkills };
}

/**
 * Compute a short stable hash of the profile fields that affect job matching.
 * Used to detect whether a re-run is needed after profile edits.
 */
export async function profileHash(profile: {
  skills?: string[];
  target_job_titles?: string[];
  career_level?: string;
  location?: string;
  preferred_job_types?: string[];
  salary_min?: number | null;
  salary_max?: number | null;
}): Promise<string> {
  const fields = {
    skills:              (profile.skills ?? []).slice().sort(),
    target_job_titles:   (profile.target_job_titles ?? []).slice().sort(),
    career_level:        profile.career_level ?? "",
    location:            profile.location ?? "",
    preferred_job_types: (profile.preferred_job_types ?? []).slice().sort(),
    salary_min:          profile.salary_min ?? 0,
    salary_max:          profile.salary_max ?? 0,
  };
  const text = JSON.stringify(fields);
  const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

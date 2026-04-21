/**
 * match-jobs — AI Job Matching Agent (Supabase Edge Function, Deno)
 *
 * Scores unmatched job postings against a user's Career Profile using Claude.
 * Results are stored in `user_job_matches` and immediately available to the
 * discover-jobs function for enriched search results.
 *
 * How it works:
 *  1. Load user's Career Profile (skills, titles, experience, location prefs)
 *  2. Find unscored jobs from job_postings (new since last run)
 *  3. Clean each job description with job-parser (strips benefits/EEO noise)
 *  4. Batch 10 jobs per Claude call (cost-efficient)
 *  5. Parse Claude's JSON → upsert to user_job_matches
 *  6. Return top N matches sorted by fit_score
 *
 * Called by:
 *  - discover-jobs (on-demand, triggered when user searches)
 *  - job-alerts (scheduled, runs nightly for alert delivery)
 *  - Direct API calls for background pre-scoring
 *
 * POST body:
 *  {
 *    userId?: string        — score for this user (defaults to authenticated user)
 *    limit?: number         — max jobs to score per call (default 50, max 200)
 *    forceRescore?: boolean — re-score even if already matched
 *    jobIds?: string[]      — score specific jobs only
 *  }
 *
 * Response:
 *  { scored: number, topMatches: MatchResult[], skipped: number }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { cleanJobText } from "../_shared/job-parser.ts";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const BATCH_SIZE = 10;          // jobs per Claude call
const MAX_JOB_CHARS = 2_000;    // trim job descriptions to keep prompts focused
const MAX_JOBS_PER_RUN = 200;   // cap to prevent runaway costs

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  userId: string;
  fullName: string;
  skills: string[];
  certifications: string[];
  targetTitles: string[];
  careerLevel: string;
  location: string;
  isRemote: boolean;
  salaryMin: number;
  salaryMax: number;
  summary: string;
  experienceYears: number;
}

interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  job_type: string;
}

interface MatchResult {
  job_id: string;
  fit_score: number;
  matched_skills: string[];
  skill_gaps: string[];
  strengths: string[];
  red_flags: string[];
  match_summary: string;
  effort_level: "easy" | "moderate" | "hard";
  response_prob: number;
  smart_tag: string;
}

// ---------------------------------------------------------------------------
// Profile loader
// ---------------------------------------------------------------------------

async function loadUserProfile(supabase: any, userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("job_seeker_profiles")
    .select(`
      user_id, full_name, skills, certifications, target_job_titles,
      career_level, location, preferred_job_types, salary_min, salary_max,
      summary, work_experience, automation_mode
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  // Estimate experience years from work_experience jsonb
  let experienceYears = 0;
  if (Array.isArray(data.work_experience)) {
    experienceYears = data.work_experience.reduce((acc: number, job: any) => {
      const start = job.start_year ?? job.startYear ?? 0;
      const end = job.end_year ?? job.endYear ?? new Date().getFullYear();
      return acc + Math.max(0, end - start);
    }, 0);
  }

  const isRemote = (data.preferred_job_types ?? []).some((t: string) =>
    /remote/i.test(t)
  );

  return {
    userId: data.user_id,
    fullName: data.full_name ?? "",
    skills: data.skills ?? [],
    certifications: data.certifications ?? [],
    targetTitles: data.target_job_titles ?? [],
    careerLevel: data.career_level ?? "mid",
    location: data.location ?? "",
    isRemote,
    salaryMin: data.salary_min ?? 0,
    salaryMax: data.salary_max ?? 0,
    summary: data.summary ?? "",
    experienceYears,
  };
}

// ---------------------------------------------------------------------------
// Unmatched job fetcher
// ---------------------------------------------------------------------------

async function fetchUnmatchedJobs(
  supabase: any,
  userId: string,
  limit: number,
  jobIds?: string[],
  forceRescore = false
): Promise<JobPosting[]> {
  let query = supabase
    .from("job_postings")
    .select("id, title, company, location, is_remote, description, salary_min, salary_max, job_type")
    .eq("status", "active")
    .order("date_posted", { ascending: false })
    .limit(limit);

  if (jobIds?.length) {
    query = query.in("id", jobIds);
  } else if (!forceRescore) {
    // Exclude already-scored jobs for this user
    const { data: existing } = await supabase
      .from("user_job_matches")
      .select("job_id")
      .eq("user_id", userId)
      .eq("is_ignored", false);

    const existingIds = (existing ?? []).map((r: any) => r.job_id);
    if (existingIds.length > 0) {
      query = query.not("id", "in", `(${existingIds.join(",")})`);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[match-jobs] fetchUnmatchedJobs error:", error);
    return [];
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Claude scoring prompt
// ---------------------------------------------------------------------------

function buildMatchingPrompt(profile: UserProfile, jobs: JobPosting[]): string {
  const profileSummary = `
CANDIDATE PROFILE:
Name: ${profile.fullName}
Career Level: ${profile.careerLevel}
Years of Experience: ~${profile.experienceYears}
Target Titles: ${profile.targetTitles.join(", ") || "Not specified"}
Skills: ${profile.skills.join(", ") || "Not specified"}
Certifications: ${profile.certifications.join(", ") || "None"}
Location: ${profile.location || "Not specified"} ${profile.isRemote ? "(Open to remote)" : ""}
Salary Expectation: ${profile.salaryMin ? `$${profile.salaryMin.toLocaleString()}` : "Not specified"} - ${profile.salaryMax ? `$${profile.salaryMax.toLocaleString()}` : "Not specified"}
Summary: ${profile.summary || "Not provided"}
`.trim();

  const jobsText = jobs
    .map((job, i) => {
      const cleanDesc = cleanJobText(job.description ?? "", job.title).slice(0, MAX_JOB_CHARS);
      const salary = job.salary_min
        ? `$${job.salary_min.toLocaleString()}${job.salary_max ? ` - $${job.salary_max.toLocaleString()}` : "+"}`
        : "Not listed";
      return `JOB ${i + 1} [ID: ${job.id}]:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}${job.is_remote ? " (Remote)" : ""}
Type: ${job.job_type}
Salary: ${salary}
Description:
${cleanDesc}`;
    })
    .join("\n\n---\n\n");

  return `${profileSummary}

You are an expert career coach and recruiter. Analyze each job below against the candidate profile and score the fit.

${jobsText}

For EACH job, return a JSON object in this exact array format. Be honest and calibrated — most jobs should score 40-75, true excellent matches 76-90, stretch goals 91-100.

Return ONLY valid JSON array, no markdown, no explanation:
[
  {
    "job_id": "exact UUID from [ID: ...]",
    "fit_score": 0-100,
    "matched_skills": ["skill1", "skill2"],
    "skill_gaps": ["missing_skill1", "missing_skill2"],
    "strengths": ["one strength", "another strength"],
    "red_flags": ["concern if any"],
    "match_summary": "One sentence explaining why this is or isn't a good fit.",
    "effort_level": "easy|moderate|hard",
    "response_prob": 0-100,
    "smart_tag": "hot_match|good_fit|stretch|reach|low_roi|apply_fast"
  }
]

Rules:
- fit_score: skills overlap (40%), title/level match (25%), location/remote (15%), salary (10%), growth potential (10%)
- matched_skills: only skills from the candidate's profile that appear in the job requirements
- skill_gaps: key requirements the candidate clearly lacks
- effort_level: easy=strong match/apply now, moderate=worth tailoring resume, hard=significant gaps
- response_prob: probability employer responds (based on fit + company tier + job competitiveness)
- smart_tag: hot_match(90+), good_fit(75-89), stretch(60-74), reach(40-59), low_roi(strong match but poor comp/growth), apply_fast(time-sensitive or limited applicants)`;
}

// ---------------------------------------------------------------------------
// Claude API caller
// ---------------------------------------------------------------------------

async function scoreWithClaude(
  apiKey: string,
  prompt: string
): Promise<MatchResult[]> {
  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",  // Fastest + cheapest for batch scoring
      max_tokens: 4_000,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "[]";

  // Claude sometimes wraps JSON in markdown fences — strip them
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("[match-jobs] Failed to parse Claude response:", text.slice(0, 500));
    return [];
  }
}

// ---------------------------------------------------------------------------
// DB writer
// ---------------------------------------------------------------------------

async function saveMatches(
  supabase: any,
  userId: string,
  matches: MatchResult[]
): Promise<number> {
  if (matches.length === 0) return 0;

  const rows = matches.map((m) => ({
    user_id: userId,
    job_id: m.job_id,
    fit_score: Math.max(0, Math.min(100, m.fit_score ?? 0)),
    matched_skills: m.matched_skills ?? [],
    skill_gaps: m.skill_gaps ?? [],
    strengths: m.strengths ?? [],
    red_flags: m.red_flags ?? [],
    match_summary: m.match_summary ?? "",
    effort_level: ["easy", "moderate", "hard"].includes(m.effort_level) ? m.effort_level : "moderate",
    response_prob: Math.max(0, Math.min(100, m.response_prob ?? 50)),
    smart_tag: m.smart_tag ?? "good_fit",
    scored_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("user_job_matches")
    .upsert(rows, { onConflict: "user_id,job_id" });

  if (error) {
    console.error("[match-jobs] saveMatches error:", error);
    return 0;
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res({ success: false, error: "Missing authorization header" }, 401);
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data, error: authError } = await (supabaseAnon.auth as any).getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !data?.claims) return res({ success: false, error: "Invalid or expired token" }, 401);
    const authenticatedUserId: string = data.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Rate limit ────────────────────────────────────────────────────────────
    if (!checkRateLimit(`match-jobs:${authenticatedUserId}`, 5, 60_000)) {
      return res({ success: false, error: "Too many match requests – please wait a moment." }, 429);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const userId: string = body.userId ?? authenticatedUserId;
    const limit = Math.min(body.limit ?? 50, MAX_JOBS_PER_RUN);
    const forceRescore: boolean = body.forceRescore ?? false;
    const jobIds: string[] | undefined = body.jobIds;

    // ── Load profile ──────────────────────────────────────────────────────────
    const profile = await loadUserProfile(supabaseAdmin, userId);
    if (!profile) {
      return res({ success: false, error: "Career profile not found. Please complete your profile first." }, 404);
    }
    if (profile.skills.length === 0 && profile.targetTitles.length === 0) {
      return res({ success: false, error: "Please add skills or target job titles to your profile before running matching." }, 400);
    }

    // ── Fetch unscored jobs ────────────────────────────────────────────────────
    const jobs = await fetchUnmatchedJobs(supabaseAdmin, userId, limit, jobIds, forceRescore);
    if (jobs.length === 0) {
      return res({ success: true, scored: 0, topMatches: [], skipped: 0, message: "All recent jobs already matched. Check back later for new postings." });
    }

    // ── Claude API key ─────────────────────────────────────────────────────────
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return res({ success: false, error: "AI matching not configured. Please set ANTHROPIC_API_KEY." }, 500);
    }

    // ── Batch scoring ──────────────────────────────────────────────────────────
    let totalScored = 0;
    const allMatches: MatchResult[] = [];

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);
      console.log(`[match-jobs] Scoring batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} jobs) for user ${userId}`);

      try {
        const prompt = buildMatchingPrompt(profile, batch);
        const matches = await scoreWithClaude(apiKey, prompt);

        // Validate: only accept results where job_id matches a job in the batch
        const validJobIds = new Set(batch.map((j) => j.id));
        const validMatches = matches.filter((m) => m.job_id && validJobIds.has(m.job_id));

        const saved = await saveMatches(supabaseAdmin, userId, validMatches);
        totalScored += saved;
        allMatches.push(...validMatches);
      } catch (batchError) {
        console.error(`[match-jobs] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
        // Continue with next batch — partial results are better than none
      }
    }

    // ── Return top matches ────────────────────────────────────────────────────
    const topMatches = allMatches
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 20)
      .map((m) => ({
        jobId: m.job_id,
        fitScore: m.fit_score,
        matchSummary: m.match_summary,
        smartTag: m.smart_tag,
        matchedSkills: m.matched_skills,
        skillGaps: m.skill_gaps,
      }));

    console.log(`[match-jobs] Complete: scored ${totalScored}/${jobs.length} jobs for user ${userId}`);

    return res({
      success: true,
      scored: totalScored,
      skipped: jobs.length - totalScored,
      topMatches,
    });

  } catch (error) {
    console.error("[match-jobs] Unhandled error:", error);
    return res({ success: false, error: error instanceof Error ? error.message : "Matching failed" }, 500);
  }
});

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

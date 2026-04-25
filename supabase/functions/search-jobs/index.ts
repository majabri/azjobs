import { corsHeaders } from "../_shared/cors.ts";
// supabase/functions/search-jobs/index.ts
// iCareerOS Job Search — v6
// Four-mode search: handles every combination of criteria + profile completeness.
// Reads from: job_postings (primary) + discovered_jobs (Discovery Agent results)
//
// Modes:
//   A — targeted_scored    : user gave search terms AND has a profile → results + fit scores
//   B — targeted_unscored  : user gave search terms, no profile → results, nudge to complete profile
//   C — profile_discovery  : no search terms, profile exists → discovery results from agent or soft match
//   D — pure_discovery     : no search terms, no profile → diverse recent jobs
//
// Diagnostic-confirmed facts (2026-04-20):
//   - Profile table: job_seeker_profiles (remote_only boolean, location text, skills ARRAY, career_level, target_job_titles)
//   - user_job_matches does NOT exist — inline scoring only
//   - expires_at is a GENERATED column on job_postings (scraped_at + 7 days)

import { createClient } from "npm:@supabase/supabase-js@2";

interface SearchRequest {
  searchTerm?: string;
  location?: string;
  isRemote?: boolean;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  careerLevel?: string;
  postedWithinDays?: number; // default 30
  limit?: number;
  offset?: number;
  // Legacy aliases (from existing callers — preserve compat)
  query?: string;
  skills?: string[];
  targetTitles?: string[];
  days_old?: number;
}

interface SearchResult {
  jobs: JobResult[];
  total: number;
  mode:
    | "targeted_scored"
    | "targeted_unscored"
    | "profile_discovery"
    | "pure_discovery";
  profileComplete: boolean;
  nudge?: string;
  source: string;
}

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  job_url: string;
  source: string;
  posted_at: string;
  fit_score: number | null;
  skill_match_pct: number | null;
  match_reasons: string[];
  skill_gaps: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // --- Parse Request (support both old and new field names) ---
    const body: SearchRequest =
      req.method === "POST"
        ? await req.json().catch(() => ({}))
        : Object.fromEntries(new URL(req.url).searchParams);

    // Normalize: support legacy field names from existing callers
    const searchTerm = body.searchTerm?.trim() || body.query?.trim() || "";
    const daysOld = body.postedWithinDays || body.days_old || 30;
    const limit = Math.min(Number(body.limit) || 50, 100);
    const offset = Number(body.offset) || 0;

    const hasCriteria = !!(
      searchTerm ||
      body.location?.trim() ||
      body.isRemote !== undefined ||
      body.jobType ||
      body.salaryMin ||
      body.careerLevel ||
      (body.skills?.length ?? 0) > 0 ||
      (body.targetTitles?.length ?? 0) > 0
    );

    // --- Load User Profile (gracefully — never throws if missing) ---
    // remote_only is boolean; location is a text field
    const { data: profile } = await supabaseService
      .from("job_seeker_profiles")
      .select(
        "skills, career_level, location, remote_only, preferred_job_types, target_job_titles, summary",
      )
      .eq("user_id", user.id)
      .maybeSingle(); // CRITICAL: maybeSingle — never throws for new users

    const hasProfile = !!(
      profile &&
      ((Array.isArray(profile.skills) && profile.skills.length > 0) ||
        profile.career_level ||
        (Array.isArray(profile.target_job_titles) &&
          profile.target_job_titles.length > 0))
    );

    // --- Four-Mode Decision Tree ---
    let result: SearchResult;

    if (hasCriteria && hasProfile) {
      result = await targetedScoredSearch(
        supabaseService,
        user.id,
        body,
        profile,
        searchTerm,
        daysOld,
        limit,
        offset,
      );
    } else if (hasCriteria && !hasProfile) {
      result = await targetedUnscoredSearch(
        supabaseService,
        body,
        searchTerm,
        daysOld,
        limit,
        offset,
      );
    } else if (!hasCriteria && hasProfile) {
      result = await profileDiscovery(
        supabaseService,
        user.id,
        profile,
        limit,
        offset,
      );
    } else {
      result = await pureDiscovery(supabaseService, limit, offset);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[search-jobs] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// ─── Shared Query Builder (reads job_postings) ────────────────────────────────
async function queryJobPostings(
  supabase: any,
  params: {
    searchTerm?: string;
    location?: string;
    isRemote?: boolean;
    jobType?: string;
    salaryMin?: number;
    careerLevel?: string;
    daysOld?: number;
    skills?: string[];
    targetTitles?: string[];
  },
  limit: number,
  offset: number,
): Promise<any[]> {
  let query = supabase
    .from("job_postings")
    .select(
      "id, external_id, title, company, location, is_remote, job_type, salary_min, salary_max, salary_currency, description, job_url, source, date_posted, scraped_at",
    );

  // Build search term from all criteria
  const terms: string[] = [];
  if (params.searchTerm) terms.push(params.searchTerm);
  if (params.targetTitles?.length)
    terms.push(...params.targetTitles.slice(0, 3));
  if (params.skills?.length && !terms.length)
    terms.push(...params.skills.slice(0, 3));

  if (terms.length > 0) {
    const t = encodeURIComponent(terms[0]); // Use first term for ilike
    query = query.or(
      `title.ilike.%${t}%,description.ilike.%${t}%,company.ilike.%${t}%`,
    );
  }

  if (params.location?.trim()) {
    const loc = params.location.trim();
    query = query.or(`location.ilike.%${loc}%,is_remote.eq.true`);
  }

  if (params.isRemote === true) query = query.eq("is_remote", true);
  if (params.jobType) query = query.eq("job_type", params.jobType);
  if (params.salaryMin) query = query.gte("salary_max", params.salaryMin);

  const cutoff = new Date(
    Date.now() - (params.daysOld ?? 30) * 24 * 60 * 60 * 1000,
  ).toISOString();
  query = query
    .gt("expires_at", new Date().toISOString()) // Only non-expired jobs
    .gte("scraped_at", cutoff)
    .order("scraped_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    console.error("[queryJobPostings] Error:", error);
    return [];
  }
  return data || [];
}

// ─── Mode A: Targeted + Scored ────────────────────────────────────────────────
async function targetedScoredSearch(
  supabase: any,
  userId: string,
  body: SearchRequest,
  profile: any,
  searchTerm: string,
  daysOld: number,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  const jobs = await queryJobPostings(
    supabase,
    { ...body, searchTerm, daysOld },
    limit,
    offset,
  );
  const scored = jobs.map((job) =>
    normalizeJob(job, { fit_score: calculateInlineScore(job, profile) }),
  );
  return {
    jobs: scored,
    total: scored.length,
    mode: "targeted_scored",
    profileComplete: true,
    source: "icareeros-v6",
  };
}

// ─── Mode B: Targeted + Unscored ──────────────────────────────────────────────
async function targetedUnscoredSearch(
  supabase: any,
  body: SearchRequest,
  searchTerm: string,
  daysOld: number,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  const jobs = await queryJobPostings(
    supabase,
    { ...body, searchTerm, daysOld },
    limit,
    offset,
  );
  return {
    jobs: jobs.map((j) => normalizeJob(j, null)),
    total: jobs.length,
    mode: "targeted_unscored",
    profileComplete: false,
    nudge: "Complete your Career Profile to see your fit score for each job.",
    source: "icareeros-v6",
  };
}

// ─── Mode C: Profile Discovery ────────────────────────────────────────────────
async function profileDiscovery(
  supabase: any,
  userId: string,
  profile: any,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  // Try discovered_jobs first (Discovery Agent results, already scored for this user)
  const { data: discovered } = await supabase
    .from("discovered_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("relevance_score", { ascending: false })
    .limit(limit);

  if (discovered && discovered.length >= 10) {
    // Enough Discovery Agent results — use them
    return {
      jobs: discovered.map((j: any) => ({
        id: j.job_id || j.id,
        title: j.title || "",
        company: j.company || "",
        location: j.location || "",
        is_remote: j.is_remote || false,
        job_type: j.employment_type || "",
        salary_min: j.salary_min || null,
        salary_max: j.salary_max || null,
        description: j.description || "",
        job_url: j.source_url || "",
        source: j.source_board || "discovery",
        posted_at: j.posted_at || "",
        fit_score: j.relevance_score || null,
        skill_match_pct: null,
        match_reasons: j.match_reasons || [],
        skill_gaps: j.skill_gaps || [],
      })),
      total: discovered.length,
      mode: "profile_discovery",
      profileComplete: true,
      nudge:
        "Showing opportunities matched to your profile. Add search terms to narrow results.",
      source: "icareeros-v6",
    };
  }

  // Fall back to job_postings with soft criteria from profile
  // Use remote_only boolean (not location string) to determine remote preference
  const softParams = {
    isRemote: profile.remote_only === true ? true : undefined,
    careerLevel: profile.career_level || undefined,
    daysOld: 30,
  };
  const jobs = await queryJobPostings(supabase, softParams, limit * 2, 0);
  const diversified = diversifyResults(jobs, limit);
  const scored = diversified.map((job) =>
    normalizeJob(job, { fit_score: calculateInlineScore(job, profile) }),
  );
  return {
    jobs: scored,
    total: scored.length,
    mode: "profile_discovery",
    profileComplete: true,
    nudge:
      "Showing opportunities matched to your profile. Add search terms to narrow results.",
    source: "icareeros-v6",
  };
}

// ─── Mode D: Pure Discovery ───────────────────────────────────────────────────
async function pureDiscovery(
  supabase: any,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  const { data: rawJobs } = await supabase
    .from("job_postings")
    .select(
      "id, external_id, title, company, location, is_remote, job_type, salary_min, salary_max, salary_currency, description, job_url, source, date_posted, scraped_at",
    )
    .gt("expires_at", new Date().toISOString())
    .gte(
      "scraped_at",
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    )
    .order("scraped_at", { ascending: false })
    .limit(limit * 4);

  const diversified = diversifyResults(rawJobs || [], limit);
  return {
    jobs: diversified.map((j) => normalizeJob(j, null)),
    total: diversified.length,
    mode: "pure_discovery",
    profileComplete: false,
    nudge:
      "Showing a variety of open roles. Complete your profile to see jobs matched to your skills.",
    source: "icareeros-v6",
  };
}

// ─── Inline Fit Scoring (no external table dependency) ────────────────────────
// NOTE: user_job_matches does NOT exist in production — always use inline scoring.
function calculateInlineScore(job: any, profile: any): number | null {
  if (!profile) return null;
  let score = 50;

  // Remote preference (uses remote_only boolean from job_seeker_profiles)
  if (profile.remote_only === true && job.is_remote) score += 15;
  else if (profile.remote_only === true && !job.is_remote) score -= 10;

  // Skill overlap
  if (Array.isArray(profile.skills) && profile.skills.length > 0) {
    const descLower = (job.description || "").toLowerCase();
    const titleLower = (job.title || "").toLowerCase();
    const matchingSkills = profile.skills.filter(
      (s: string) =>
        descLower.includes(s.toLowerCase()) ||
        titleLower.includes(s.toLowerCase()),
    );
    const matchPct = matchingSkills.length / profile.skills.length;
    score += Math.round(matchPct * 20); // up to +20 for full skill match
  }

  // Title alignment
  if (
    Array.isArray(profile.target_job_titles) &&
    profile.target_job_titles.length > 0
  ) {
    const titleLower = (job.title || "").toLowerCase();
    const titleMatch = profile.target_job_titles.some(
      (t: string) =>
        titleLower.includes(t.toLowerCase()) ||
        t.toLowerCase().includes(titleLower.split(" ")[0]),
    );
    if (titleMatch) score += 10;
  }

  // Recency boost
  if (job.scraped_at) {
    const daysOld =
      (Date.now() - new Date(job.scraped_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 3) score += 10;
    else if (daysOld < 7) score += 5;
    else if (daysOld > 21) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeJob(j: any, match: any): JobResult {
  return {
    id: j.id,
    title: j.title || "",
    company: j.company || "",
    location: j.location || "",
    is_remote: j.is_remote || false,
    job_type: j.job_type || "",
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    description: (j.description || "").slice(0, 2000),
    job_url: j.job_url || "",
    source: j.source || "db",
    posted_at: j.date_posted || j.scraped_at || "",
    fit_score: match?.fit_score ?? null,
    skill_match_pct: match?.skill_match_pct ?? null,
    match_reasons: match?.match_reasons || [],
    skill_gaps: match?.skill_gaps || [],
  };
}

function diversifyResults(jobs: any[], targetCount: number): any[] {
  if (jobs.length <= targetCount) return jobs;
  const buckets = new Map<string, any[]>();
  const maxPerSource = Math.ceil(targetCount / 3);
  for (const job of jobs) {
    const src = job.source || "unknown";
    if (!buckets.has(src)) buckets.set(src, []);
    const b = buckets.get(src)!;
    if (b.length < maxPerSource) b.push(job);
  }
  const result: any[] = [];
  const arrays = Array.from(buckets.values());
  let i = 0;
  while (result.length < targetCount) {
    const b = arrays[i % arrays.length];
    if (b?.length > 0) result.push(b.shift());
    i++;
    if (arrays.every((a) => a.length === 0)) break;
  }
  return result;
}

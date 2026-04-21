/**
 * Job Service — Core search logic.
 *
 * v6: Calls discover-jobs edge function (passes userId for AI enrichment)
 * instead of querying scraped_jobs view directly.
 *
 * The edge function returns AI fit scores, skill gaps, smart tags, and
 * triggers background match-jobs when unscored jobs exist.
 */

import { supabase } from "@/integrations/supabase/client";
import type { JobResult, JobSearchFilters, DiscoverJobsResponse } from "./types";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// URL normalization (unchanged)
// ---------------------------------------------------------------------------

export function normalizeJobUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  const urlPattern = /^(https?):\/\//i;
  let url = rawUrl.replace(/^\s+|\s+$/g, '').replace(/['"\[\]()\{\}]/g, '');
  if (!urlPattern.test(url)) url = 'https://' + url;
  url = url.replace(/[\s\.,;!?]+$/g, '');
  const markdownPattern = /.*?\((.*?)\)/;
  const match = url.match(markdownPattern);
  if (match) url = match[1];
  const redirectParams = ['url', 'u', 'redirect', 'redirect_url', 'redirectUri', 'target', 'dest', 'destination', 'continue', 'next', 'r', 'link', 'q'];
  for (let i = 0; i < 3; i++) {
    try {
      const urlObj = new URL(url);
      redirectParams.forEach(param => {
        if (urlObj.searchParams.has(param)) { url = urlObj.searchParams.get(param) || url; }
      });
    } catch { break; }
  }
  const trackingParams = /([&?](utm_[^=]*|gclid|fbclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|igshid|si|spm)=[^&]*)/g;
  url = url.replace(trackingParams, '');
  const cleanUrl = url.split('#')[0];
  try {
    const finalUrl = new URL(cleanUrl);
    if (!finalUrl.hostname || finalUrl.hostname.includes('placeholder')) return '';
    return finalUrl.toString();
  } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Career level → seniority map (for local fallback scoring)
// ---------------------------------------------------------------------------

const CAREER_LEVEL_TO_SENIORITY: Record<string, string[]> = {
  "Entry-Level / Junior": ["entry", "junior", "intern"],
  "Mid-Level":            ["mid", "intermediate"],
  "Senior":               ["senior"],
  "Manager":              ["manager", "lead"],
  "Director":             ["director"],
  "VP / Senior Leadership": ["vp", "vice president"],
  "C-Level / Executive":  ["c-level", "executive", "chief"],
};

const JOB_TYPE_MAP: Record<string, string[]> = {
  "full-time":  ["full-time", "fulltime", "full_time"],
  "part-time":  ["part-time", "parttime", "part_time"],
  "contract":   ["contract", "contractor", "freelance"],
  "short-term": ["temporary", "temp", "short-term"],
};

// ---------------------------------------------------------------------------
// Main entry: searchJobs
// Calls discover-jobs v6 edge function — returns AI-enriched results
// ---------------------------------------------------------------------------

export async function searchJobs(
  filters: JobSearchFilters
): Promise<{ jobs: JobResult[]; citations: string[]; matchingTriggered: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;

  try {
    // Pass targetTitles and skills as separate arrays so the edge function
    // can build proper per-term OR filters instead of one giant ilike string.
    // searchTerm is just the free-text query (if any).
    const payload: Record<string, unknown> = {
      searchTerm: filters.query || "",           // free-text only, not titles
      targetTitles: filters.targetTitles,        // matched against job title field
      skills: filters.skills.slice(0, 10),       // matched as full phrases in description
      userId,
      location: filters.location || undefined,
      isRemote: filters.jobTypes.includes("remote") || undefined,
      jobType: buildJobTypeFilter(filters.jobTypes),
      minFitScore: filters.minFitScore > 0 ? filters.minFitScore : undefined,
      daysOld: filters.days_old || 30,           // default 30 days (scraper data may be a few weeks old)
      limit: filters.search_mode === "volume" ? 200 : 100,
      offset: filters.offset ?? 0,
      triggerMatch: !!userId,
    };

    const { data, error } = await supabase.functions.invoke<DiscoverJobsResponse>("discover-jobs", {
      body: payload,
    });

    if (error || !data) {
      logger.warn("[searchJobs] Edge function failed, falling back to DB:", error?.message);
      const dbJobs = await searchDatabaseJobsFallback(filters);
      return { jobs: dbJobs, citations: [], matchingTriggered: false };
    }

    const jobs: JobResult[] = (data.jobs ?? []).map((row: any) => ({
      id: row.id,
      title: row.title || "Job Opportunity",
      company: row.company || "Company",
      location: row.location || "Remote",
      type: row.job_type || "full-time",
      description: row.description || "",
      url: normalizeJobUrl(row.job_url) || normalizeJobUrl(row.apply_url) || "",
      matchReason: row.match_summary || "Database match",
      quality_score: row.quality_score ?? 50,
      is_flagged: row.is_flagged ?? false,
      flag_reasons: row.flag_reasons ?? [],
      salary: formatSalary(row.salary_min, row.salary_max, row.salary_currency),
      seniority: row.seniority,
      is_remote: row.is_remote,
      source: row.source || "database",
      first_seen_at: row.scraped_at || row.date_posted,
      // AI match fields
      fit_score: row.fit_score ?? null,
      matched_skills: row.matched_skills ?? [],
      skill_gaps: row.skill_gaps ?? [],
      strengths: row.strengths ?? [],
      red_flags: row.red_flags ?? [],
      match_summary: row.match_summary ?? "",
      effort_level: row.effort_level,
      response_prob: row.response_prob ?? null,
      smart_tag: row.smart_tag ?? null,
      is_saved: row.is_saved ?? false,
      is_applied: row.is_applied ?? false,
    }));

    return { jobs, citations: [], matchingTriggered: data.matchingTriggered ?? false };

  } catch (e) {
    logger.error("[searchJobs] Exception:", e);
    const dbJobs = await searchDatabaseJobsFallback(filters);
    return { jobs: dbJobs, citations: [], matchingTriggered: false };
  }
}

// ---------------------------------------------------------------------------
// Poll for updated AI scores after matchingTriggered
// Call this ~5s after search when matchingTriggered=true to get scores
// ---------------------------------------------------------------------------

export async function pollMatchScores(jobIds: string[]): Promise<Map<string, Partial<JobResult>>> {
  if (!jobIds.length) return new Map();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Map();

  const { data, error } = await supabase
    .from("user_job_matches")
    .select("job_id, fit_score, matched_skills, skill_gaps, strengths, red_flags, match_summary, effort_level, response_prob, smart_tag")
    .eq("user_id", session.user.id)
    .in("job_id", jobIds);

  if (error || !data) return new Map();

  return new Map(data.map((m: any) => [m.job_id, {
    fit_score: m.fit_score,
    matched_skills: m.matched_skills ?? [],
    skill_gaps: m.skill_gaps ?? [],
    strengths: m.strengths ?? [],
    red_flags: m.red_flags ?? [],
    match_summary: m.match_summary ?? "",
    effort_level: m.effort_level,
    response_prob: m.response_prob,
    smart_tag: m.smart_tag,
  }]));
}

// ---------------------------------------------------------------------------
// Mark job interaction — writes to job_interactions table (RLS, user-scoped).
// action must match the table check constraint: viewed|saved|applied|dismissed|shared
// jobId may be a UUID (from job_postings) or any external text id.
// ---------------------------------------------------------------------------

const ACTION_MAP: Record<string, string> = {
  seen:    "viewed",
  ignored: "dismissed",
  saved:   "saved",
  applied: "applied",
};

export async function markJobInteraction(
  jobId: string,
  action: "seen" | "saved" | "ignored" | "applied" | "viewed" | "dismissed" | "shared"
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !jobId) return;

  const mappedAction = ACTION_MAP[action] ?? action;
  const validActions = ["viewed", "saved", "applied", "dismissed", "shared"];
  if (!validActions.includes(mappedAction)) return;

  // Try to determine if jobId looks like a UUID (job_postings.id) or an external string id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = uuidRegex.test(jobId);

  await (supabase as any).from("job_interactions").insert({
    user_id:         session.user.id,
    job_id:          isUuid ? jobId : null,
    external_job_id: !isUuid ? jobId : null,
    action:          mappedAction,
    metadata:        {},
  }).catch(() => {}); // non-fatal — interaction tracking must never break the UI
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildJobTypeFilter(jobTypes: string[]): string | undefined {
  const structural = jobTypes.filter(t => !["remote", "hybrid", "in-office"].includes(t));
  if (!structural.length) return undefined;
  // Map to DB job_type values
  const mapped = structural.flatMap(t => JOB_TYPE_MAP[t] ?? [t]);
  return mapped[0]; // discover-jobs only accepts single value; primary type
}

function formatSalary(min: number | null, max: number | null, currency = "USD"): string | undefined {
  if (!min && !max) return undefined;
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return undefined;
}

// ---------------------------------------------------------------------------
// Fallback: direct DB query (used when edge function fails)
// ---------------------------------------------------------------------------

export async function searchDatabaseJobsFallback(filters: JobSearchFilters): Promise<JobResult[]> {
  try {
    const limit = filters.search_mode === "volume" ? 800 : 200;

    // Reserved words that break PostgREST's OR filter parser
    const POSTGREST_RESERVED = new Set(["and","or","not","in","is","null","true","false","eq","neq","gt","gte","lt","lte","like","ilike","cs","cd","sl","sr","nxr","nxl","adj","ov","fts","plfts","phfts","wfts"]);

    const COLS = "id, title, company, location, job_type, description, job_url, quality_score, is_flagged, flag_reasons, salary, market_rate, seniority, is_remote, source, first_seen_at";

    // Helper: apply shared non-text filters to a query builder
    const applyCommonFilters = (q: ReturnType<typeof supabase.from>) => {
      if (filters.location && !/^\s*remote\s*$/i.test(filters.location))
        q = (q as any).ilike("location", `%${filters.location}%`);
      if (filters.jobTypes.includes("remote")) q = (q as any).eq("is_remote", true);
      const structuredTypes = filters.jobTypes
        .filter(t => !["remote","hybrid","in-office"].includes(t))
        .flatMap(t => JOB_TYPE_MAP[t] ?? [t]);
      if (structuredTypes.length > 0)
        q = (q as any).or(structuredTypes.map(t => `job_type.ilike.%${t}%`).join(","));
      const salaryMin = filters.salaryMin ? parseInt(filters.salaryMin.replace(/\D/g,""), 10) : null;
      const salaryMax = filters.salaryMax ? parseInt(filters.salaryMax.replace(/\D/g,""), 10) : null;
      if (salaryMin && !isNaN(salaryMin)) q = (q as any).gte("market_rate", salaryMin);
      if (salaryMax && !isNaN(salaryMax)) q = (q as any).lte("market_rate", salaryMax);
      // Default to 30 days if not specified (scraper data may be a few weeks old)
      const daysOld = filters.days_old || 30;
      const cutoff = new Date(Date.now() - daysOld * 86400000).toISOString();
      q = (q as any).gte("first_seen_at", cutoff);
      if (!filters.showFlagged) q = (q as any).eq("is_flagged", false);
      return q;
    };

    const toResult = (row: any, matchReason: string): JobResult => ({
      id: row.id,
      title: row.title || "Job Opportunity",
      company: row.company || "Company",
      location: row.location || "Remote",
      type: row.job_type || "full-time",
      description: row.description || "",
      url: normalizeJobUrl(row.job_url) || "",
      matchReason,
      quality_score: row.quality_score ?? 50,
      is_flagged: row.is_flagged ?? false,
      flag_reasons: row.flag_reasons ?? [],
      salary: row.salary,
      seniority: row.seniority,
      is_remote: row.is_remote,
      source: row.source || "database",
      first_seen_at: row.first_seen_at,
    });

    // ── PASS 1: Title matches (strongest signal — jobs whose title matches the
    //           user's target job titles go to the top regardless of skill overlap) ──
    const titleOrParts = filters.targetTitles
      .map(t => t.replace(/[,&()]/g, " ").replace(/%/g, "").replace(/_/g, " ").trim())
      .filter(s => s.length >= 3)
      .map(safe => `title.ilike.%${safe}%`);

    // Also add user-typed query to title pass
    if (filters.query) {
      const qKws = [...new Set(
        filters.query.split(/[\s,&]+/)
          .map(s => s.replace(/[%_()\[\]]/g, "").trim())
          .filter(s => s.length >= 4 && !POSTGREST_RESERVED.has(s.toLowerCase()))
      )];
      qKws.slice(0, 4).forEach(kw => titleOrParts.push(`title.ilike.%${kw}%`));
    }

    let titleJobs: any[] = [];
    if (titleOrParts.length > 0) {
      let q = applyCommonFilters(
        supabase.from("scraped_jobs").select(COLS).order("quality_score", { ascending: false }).limit(limit)
      );
      q = (q as any).or(titleOrParts.slice(0, 20).join(","));
      const { data, error } = await (q as any);
      if (error) logger.error("[searchDatabaseJobsFallback] title pass error:", error.message);
      titleJobs = data || [];
    }

    const titleJobIds = new Set(titleJobs.map((j: any) => j.id));

    // ── PASS 2: Skill / description matches (secondary signal — jobs whose
    //           description mentions the user's required skills, excluding any
    //           already returned by the title pass) ──
    const NOISE_WORDS = new Set([
      "and","the","for","with","that","from","business","process","management",
      "digital","strategy","operations","development","services","enterprise",
      "information","improvement","regulatory","service","change","employee",
      "cloud","customer","product","data","team","people","work","support",
    ]);

    const skillPhrases = filters.skills
      .map(s => s.replace(/[%_()\[\]]/g, "").replace(/[,&]/g, " ").replace(/\s+/g, " ").trim())
      .filter(s => s.length >= 5);

    // Full-phrase description matches only — no single-word title extraction from skill phrases
    // (splitting "Risk Management and Incident Response" into words like "Incident" / "Response"
    //  would match unrelated jobs; rely on targetTitles for title-level matching)
    const descOrParts: string[] = skillPhrases.slice(0, 8).map(p => `description.ilike.%${p}%`);

    // Also include free-text query in description pass
    if (filters.query) {
      const qKws = [...new Set(
        filters.query.split(/[\s,&]+/)
          .map(s => s.replace(/[%_()\[\]]/g, "").trim())
          .filter(s => s.length >= 4 && !POSTGREST_RESERVED.has(s.toLowerCase()))
      )];
      qKws.slice(0, 4).forEach(kw => descOrParts.push(`description.ilike.%${kw}%`));
    }

    let skillJobs: any[] = [];
    if (descOrParts.length > 0) {
      let q = applyCommonFilters(
        supabase.from("scraped_jobs").select(COLS).order("quality_score", { ascending: false }).limit(limit)
      );
      q = (q as any).or(descOrParts.slice(0, 20).join(","));
      const { data, error } = await (q as any);
      if (error) logger.error("[searchDatabaseJobsFallback] skill pass error:", error.message);
      // Exclude jobs already returned by the title pass
      skillJobs = (data || []).filter((j: any) => !titleJobIds.has(j.id));
    }

    // ── Combine: title matches first, skill matches second.
    //    matchReason carries the title text so client-side scoring
    //    rewards matches that align with profile keywords. ──
    const combined = [
      ...titleJobs.map((row: any) => toResult(row, `${row.title} ${row.description || ""}`)),
      ...skillJobs.map((row: any) => toResult(row, `${row.title} ${row.description || ""}`)),
    ];

    return combined.slice(0, limit);
  } catch (e) {
    logger.error("[searchDatabaseJobsFallback] Exception:", e);
    return [];
  }
}

// Keep backward-compat export
export { searchJobs as searchDatabaseJobs };

export async function searchAIJobs(): Promise<{ jobs: JobResult[]; citations: string[] }> {
  return { jobs: [], citations: [] };
}

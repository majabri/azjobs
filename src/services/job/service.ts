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
    // Build search term from titles + skills + query
    const searchTermParts = [
      ...filters.targetTitles,
      ...(filters.query ? [filters.query] : []),
      // Include top 3 skills as keyword search
      ...filters.skills.slice(0, 3),
    ].filter(Boolean);

    const searchTerm = searchTermParts.join(" ") || "software engineer";

    const payload: Record<string, unknown> = {
      searchTerm,
      userId,
      location: filters.location || undefined,
      isRemote: filters.jobTypes.includes("remote") || undefined,
      jobType: buildJobTypeFilter(filters.jobTypes),
      minFitScore: filters.minFitScore > 0 ? filters.minFitScore : undefined,
      hoursOld: filters.days_old ? filters.days_old * 24 : 48,
      limit: filters.search_mode === "volume" ? 200 : 100,
      offset: filters.offset ?? 0,
      triggerMatch: !!userId,
    };

    const { data, error } = await supabase.functions.invoke<DiscoverJobsResponse>("discover-jobs", {
      body: payload,
    });

    if (error || !data) {
      console.warn("[searchJobs] Edge function failed, falling back to DB:", error?.message);
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
    console.error("[searchJobs] Exception:", e);
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
// Mark job interaction (seen / saved / ignored / applied)
// ---------------------------------------------------------------------------

export async function markJobInteraction(jobId: string, action: "seen" | "saved" | "ignored" | "applied"): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.rpc("mark_job_interaction", {
    p_user_id: session.user.id,
    p_job_id: jobId,
    p_action: action,
  }).catch(() => {}); // non-fatal
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
    const limit  = filters.search_mode === "volume" ? 800 : 200;
    const offset = filters.offset ?? 0;

    let query = supabase
      .from("scraped_jobs")
      .select("id, title, company, location, job_type, description, job_url, quality_score, is_flagged, flag_reasons, salary, market_rate, seniority, is_remote, source, first_seen_at")
      .order("quality_score", { ascending: false })
      .range(offset, offset + limit - 1);

    const orParts: string[] = [];
    for (const t of filters.targetTitles) {
      const escaped = t.replace(/%/g, "\\%").replace(/_/g, "\\_");
      orParts.push(`title.ilike.%${escaped}%`);
    }
    const keywords = [filters.query, ...filters.skills]
      .flatMap(s => (s || "").split(/[\s,]+/))
      .map(s => s.replace(/[%_]/g, "").trim())
      .filter(s => s.length >= 3);
    const uniqueKeywords = [...new Set(keywords)];
    for (const kw of uniqueKeywords.slice(0, 10)) {
      orParts.push(`title.ilike.%${kw}%`);
      if (kw.length >= 4) orParts.push(`description.ilike.%${kw}%`);
    }
    if (orParts.length > 0) query = query.or(orParts.join(","));
    if (filters.location && !/^\s*remote\s*$/i.test(filters.location)) query = query.ilike("location", `%${filters.location}%`);
    if (filters.jobTypes.includes("remote")) query = query.eq("is_remote", true);
    const structuredTypes = filters.jobTypes.filter(t => !["remote","hybrid","in-office"].includes(t)).flatMap(t => JOB_TYPE_MAP[t] ?? [t]);
    if (structuredTypes.length > 0) query = query.or(structuredTypes.map(t => `job_type.ilike.%${t}%`).join(","));
    if (filters.careerLevel) {
      const levels = filters.careerLevel.split(",").map(s => s.trim()).filter(Boolean);
      const seniorityValues = levels.flatMap(l => CAREER_LEVEL_TO_SENIORITY[l] ?? []);
      if (seniorityValues.length > 0) query = query.or(seniorityValues.map(s => `seniority.ilike.%${s}%`).join(","));
    }
    const salaryMinNum = filters.salaryMin ? parseInt(filters.salaryMin.replace(/\D/g, ""), 10) : null;
    const salaryMaxNum = filters.salaryMax ? parseInt(filters.salaryMax.replace(/\D/g, ""), 10) : null;
    if (salaryMinNum && !isNaN(salaryMinNum)) query = query.gte("market_rate", salaryMinNum);
    if (salaryMaxNum && !isNaN(salaryMaxNum)) query = query.lte("market_rate", salaryMaxNum);
    const daysOld = filters.days_old ?? 0;
    if (daysOld > 0) {
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("first_seen_at", cutoff);
    }
    if (!filters.showFlagged) query = query.eq("is_flagged", false);

    const { data, error } = await query;
    if (error) { console.error("[searchDatabaseJobsFallback] Error:", error.message); return []; }

    return (data || []).map((row: any) => ({
      id: row.id, title: row.title || "Job Opportunity", company: row.company || "Company",
      location: row.location || "Remote", type: row.job_type || "full-time",
      description: row.description || "", url: normalizeJobUrl(row.job_url) || "",
      matchReason: "Database match", quality_score: row.quality_score ?? 50,
      is_flagged: row.is_flagged ?? false, flag_reasons: row.flag_reasons ?? [],
      salary: row.salary, seniority: row.seniority, is_remote: row.is_remote,
      source: row.source || "database", first_seen_at: row.first_seen_at,
    }));
  } catch (e) {
    console.error("[searchDatabaseJobsFallback] Exception:", e);
    return [];
  }
}

// Keep backward-compat export
export { searchJobs as searchDatabaseJobs };

export async function searchAIJobs(): Promise<{ jobs: JobResult[]; citations: string[] }> {
  return { jobs: [], citations: [] };
}

/**
 * Job Service — Core business logic for job search and parsing.
 * Isolated from all other services. Owns job search, parsing, URL validation.
 * Communicates with matching service ONLY through the orchestrator.
 */

import { supabase } from "@/integrations/supabase/client";
import type { JobResult, JobSearchFilters } from "./types";

// ─── URL Validation (owned by job service) ──────────────────────────────────

const GENERIC_JOB_PATH_SEGMENTS = new Set([
  "careers", "career", "jobs", "job", "job-search", "open-positions",
  "positions", "vacancies", "opportunities", "join-us", "work-with-us", "employment",
]);

const LISTING_TAIL_SEGMENTS = new Set([
  "search", "results", "all", "openings", "index", "list",
]);

const NON_JOB_PAGE_SEGMENTS = new Set([
  "about", "company", "team", "culture", "people", "mission", "values", "home", "contact",
]);

export function normalizeJobUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  let value = rawUrl.trim();
  if (!value) return "";
  const markdownUrl = value.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownUrl?.[1]) value = markdownUrl[1];
  const plainHttpUrl = value.match(/https?:\/\/[^\s<>'"\])]+/i);
  if (plainHttpUrl?.[0]) value = plainHttpUrl[0];
  value = value.replace(/[),.;]+$/g, "").trim();
  if (!value) return "";
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    if (!host || host.includes("example.com") || host.includes("placeholder")) return "";
    return parsed.toString();
  } catch { return ""; }
}

export function isGenericJobListingUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").map(p => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return true;
    const allGeneric = parts.every(p => GENERIC_JOB_PATH_SEGMENTS.has(p) || LISTING_TAIL_SEGMENTS.has(p));
    if (allGeneric) return true;
    if (parts.length === 1 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0])) return true;
    if (parts.length === 2 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0]) && LISTING_TAIL_SEGMENTS.has(parts[1])) return true;
    const last = parts[parts.length - 1];
    if (GENERIC_JOB_PATH_SEGMENTS.has(last) || LISTING_TAIL_SEGMENTS.has(last)) return true;
    const qp = url.searchParams;
    if (["q", "query", "keywords", "search", "location", "department", "team"].some(key => qp.has(key)) && parts.length <= 2) return true;
    return false;
  } catch { return true; }
}

export function isLikelyDirectJobPostingUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").map(p => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return false;
    const last = parts[parts.length - 1];
    if (NON_JOB_PAGE_SEGMENTS.has(last)) return false;
    const hasJobWordInPath = parts.some(p => /job|jobs|position|opening|opportunit|career/.test(p));
    const hasNumericId = parts.some(p => /\d{4,}/.test(p));
    const hasLongSlug = parts.some(p => p.includes("-") && p.length >= 16);
    const hasKnownJobQuery = ["gh_jid", "job", "jobid", "jk", "lever-source", "oid"].some(k => url.searchParams.has(k));
    if (parts.length === 1 && !hasNumericId && !hasLongSlug && !hasKnownJobQuery) return false;
    return hasJobWordInPath || hasNumericId || hasLongSlug || hasKnownJobQuery;
  } catch { return false; }
}

export function hasSubstantiveJobDescription(description?: string | null): boolean {
  if (!description) return false;
  const text = description.trim();
  if (text.length < 140) return false;
  if (text.split(/\s+/).length < 24) return false;
  return true;
}

function sanitizeTitleForFilter(title: string): string {
  return title.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Database Search (owned by job service) ─────────────────────────────────

export async function searchDatabaseJobs(filters: JobSearchFilters): Promise<JobResult[]> {
  let query = supabase.from("scraped_jobs").select("*");

  if (filters.targetTitles.length > 0) {
    const safeTitles = filters.targetTitles.map(sanitizeTitleForFilter).filter(Boolean).slice(0, 10);
    if (safeTitles.length === 1) {
      query = query.ilike("title", `%${safeTitles[0]}%`);
    } else if (safeTitles.length > 1) {
      const titleFilter = safeTitles.map(t => `title.ilike.%${t}%`).join(",");
      query = query.or(titleFilter);
    }
  }

  if (filters.location) {
    if (/remote/i.test(filters.location)) {
      query = query.eq("is_remote", true);
    } else {
      query = query.ilike("location", `%${filters.location}%`);
    }
  }

  if (filters.jobTypes.length > 0) {
    if (filters.jobTypes.includes("remote")) query = query.eq("is_remote", true);
    const nonRemoteTypes = filters.jobTypes.filter(t => t !== "remote" && t !== "hybrid" && t !== "in-office");
    if (nonRemoteTypes.length > 0) query = query.in("job_type", nonRemoteTypes);
  }

  query = query.order("created_at", { ascending: false }).limit(500);
  const { data, error } = await query;
  if (error) { console.error("[JobService] DB search error:", error); return []; }

  return (data || [])
    .map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location || (job.is_remote ? "Remote" : "Not specified"),
      type: job.job_type || "full-time",
      description: job.description || "",
      url: normalizeJobUrl(job.job_url),
      matchReason: `Source: ${job.source}${job.seniority ? ` • ${job.seniority} level` : ""}`,
      quality_score: job.quality_score,
      is_flagged: job.is_flagged,
      flag_reasons: job.flag_reasons || [],
      salary: job.salary,
      seniority: job.seniority,
      is_remote: job.is_remote,
      source: job.source,
      first_seen_at: job.first_seen_at,
    }))
    .filter(job => Boolean(job.url) && !isGenericJobListingUrl(job.url) && isLikelyDirectJobPostingUrl(job.url) && hasSubstantiveJobDescription(job.description));
}

// ─── AI Search (async queue with polling) ──────────────────────────────────

async function pollForResults(jobId: string, token: string, maxAttempts = 30): Promise<{ jobs: JobResult[]; citations: string[] }> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`;
  for (let i = 0; i < maxAttempts; i++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ job_id: jobId }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (resp.status === 500 && err.error) throw new Error(err.error);
      throw new Error("Search failed");
    }
    const data = await resp.json();
    if (data.status === "processing") {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    // Completed — data contains { jobs, citations }
    const normalizedJobs = ((data.jobs || []) as JobResult[])
      .map(job => ({ ...job, url: normalizeJobUrl(job.url) }))
      .filter(job => Boolean(job.url));
    return { jobs: normalizedJobs, citations: data.citations || [] };
  }
  return { jobs: [], citations: [] };
}

export async function searchAIJobs(filters: JobSearchFilters): Promise<{ jobs: JobResult[]; citations: string[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { jobs: [], citations: [] };

  // Step 1: Enqueue the search
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        skills: filters.skills, jobTypes: filters.jobTypes, location: filters.location,
        query: filters.query, careerLevel: filters.careerLevel, targetTitles: filters.targetTitles, limit: 50,
      }),
    }
  );
  if (!resp.ok) return { jobs: [], citations: [] };
  const data = await resp.json();

  // If response already has jobs (sync fallback), return them
  if (data.jobs) {
    const normalizedJobs = ((data.jobs || []) as JobResult[])
      .map(job => ({ ...job, url: normalizeJobUrl(job.url) }))
      .filter(job => Boolean(job.url));
    return { jobs: normalizedJobs, citations: data.citations || [] };
  }

  // Step 2: Poll for results
  if (data.job_id) {
    return pollForResults(data.job_id, token);
  }

  return { jobs: [], citations: [] };
}

// ─── Combined Search (orchestrates DB + AI, no matching dependency) ─────────

export async function searchJobs(filters: JobSearchFilters): Promise<{ jobs: JobResult[]; citations: string[] }> {
  let allJobs: JobResult[] = [];
  let allCitations: string[] = [];

  try {
    if (filters.searchSource === "all" || filters.searchSource === "database") {
      const dbJobs = await searchDatabaseJobs(filters);
      allJobs = allJobs.concat(dbJobs);
    }
  } catch (e) {
    console.error("[JobService] Database search failed (non-blocking):", e);
  }

  try {
    if (filters.searchSource === "all" || filters.searchSource === "ai") {
      const aiResult = await searchAIJobs(filters);
      allJobs = allJobs.concat(aiResult.jobs);
      allCitations = aiResult.citations;
    }
  } catch (e) {
    console.error("[JobService] AI search failed (non-blocking):", e);
  }

  // Deduplicate by URL
  allJobs = allJobs.filter(job => Boolean(job.url));
  const uniqueByUrl = new Map<string, JobResult>();
  for (const job of allJobs) {
    if (!uniqueByUrl.has(job.url)) uniqueByUrl.set(job.url, job);
  }

  return { jobs: Array.from(uniqueByUrl.values()), citations: allCitations };
}

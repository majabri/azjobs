/**
 * Job Service — Core business logic for job search and parsing.
 * Isolated from all other services. Owns job search, parsing, URL validation.
 * 
 * RESILIENCE PRINCIPLES:
 * 1. Token refresh before every edge function call
 * 2. Retry with exponential backoff on transient failures
 * 3. Graceful fallback: DB search works even if AI search fails
 * 4. Timeout protection on all async operations
 * 5. Never throws — always returns a result (possibly empty)
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

// ─── Resilience Helpers ─────────────────────────────────────────────────────

/** Get a fresh access token, refreshing the session if needed */
async function getFreshToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    
    // Check if token expires within 60 seconds
    const expiresAt = session.expires_at ?? 0;
    const nowSecs = Math.floor(Date.now() / 1000);
    if (expiresAt - nowSecs < 60) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        console.warn("[JobService] Token refresh failed, using existing token");
        return session.access_token;
      }
      return refreshed.session.access_token;
    }
    return session.access_token;
  } catch (e) {
    console.error("[JobService] getFreshToken error:", e);
    return null;
  }
}

/** Fetch with retry and timeout */
async function resilientFetch(
  url: string,
  options: RequestInit,
  config: { retries?: number; timeoutMs?: number; label?: string } = {}
): Promise<Response> {
  const { retries = 2, timeoutMs = 30000, label = "fetch" } = config;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      
      // Don't retry on auth errors or client errors (except 429)
      if (resp.status === 401 || resp.status === 403) return resp;
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) return resp;
      
      // Retry on server errors and rate limits
      if (resp.status >= 500 || resp.status === 429) {
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          console.warn(`[JobService] ${label} attempt ${attempt + 1} got ${resp.status}, retrying in ${delay}ms`);
          await resp.text(); // consume body
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return resp;
      }
      
      return resp;
    } catch (e: any) {
      lastError = e;
      if (e.name === "AbortError") {
        console.warn(`[JobService] ${label} attempt ${attempt + 1} timed out after ${timeoutMs}ms`);
      } else {
        console.warn(`[JobService] ${label} attempt ${attempt + 1} failed:`, e.message);
      }
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError || new Error(`${label} failed after ${retries + 1} attempts`);
}

// ─── Database Search (owned by job service) ─────────────────────────────────

export async function searchDatabaseJobs(filters: JobSearchFilters): Promise<JobResult[]> {
  try {
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

    query = query.order("created_at", { ascending: false }).limit(800);
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
  } catch (e) {
    console.error("[JobService] searchDatabaseJobs unexpected error:", e);
    return [];
  }
}

// ─── AI Search (async queue with polling + token refresh) ──────────────────

async function pollForResults(jobId: string, maxAttempts = 25): Promise<{ jobs: JobResult[]; citations: string[] }> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`;
  
  for (let i = 0; i < maxAttempts; i++) {
    // Get a fresh token for EVERY poll to prevent 401 during long polling
    const token = await getFreshToken();
    if (!token) {
      console.error("[JobService] No auth token available for polling");
      return { jobs: [], citations: [] };
    }

    try {
      const resp = await resilientFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: jobId }),
      }, { retries: 1, timeoutMs: 15000, label: `poll-${i}` });

      if (resp.status === 401) {
        // Force a full session refresh and retry once
        console.warn("[JobService] Poll got 401, forcing session refresh");
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          console.error("[JobService] Session refresh failed:", refreshErr);
          return { jobs: [], citations: [] };
        }
        // Don't count this as an attempt, just continue to next iteration
        continue;
      }

      if (!resp.ok) {
        const errBody = await resp.text();
        console.warn(`[JobService] Poll ${i} status ${resp.status}:`, errBody);
        if (resp.status >= 500) {
          // Server error — wait and retry
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        return { jobs: [], citations: [] };
      }

      const data = await resp.json();
      
      if (data.status === "processing") {
        const delay = i < 5 ? 2000 : i < 15 ? 3000 : 5000; // Progressive backoff
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Completed — normalize results
      const normalizedJobs = ((data.jobs || []) as JobResult[])
        .map(job => ({ ...job, url: normalizeJobUrl(job.url) }))
        .filter(job => Boolean(job.url));
      return { jobs: normalizedJobs, citations: data.citations || [] };
      
    } catch (e) {
      console.warn(`[JobService] Poll ${i} error:`, e);
      if (i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
    }
  }

  console.warn("[JobService] Polling timed out after", maxAttempts, "attempts");
  return { jobs: [], citations: [] };
}

export async function searchAIJobs(filters: JobSearchFilters): Promise<{ jobs: JobResult[]; citations: string[] }> {
  const token = await getFreshToken();
  if (!token) {
    console.warn("[JobService] No auth token — skipping AI search");
    return { jobs: [], citations: [] };
  }

  try {
    // Step 1: Enqueue the search with retry
    const resp = await resilientFetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          skills: filters.skills, jobTypes: filters.jobTypes, location: filters.location,
          query: filters.query, careerLevel: filters.careerLevel, targetTitles: filters.targetTitles, limit: 50,
          search_mode: filters.search_mode || "balanced",
        }),
      },
      { retries: 2, timeoutMs: 20000, label: "enqueue-search" }
    );

    if (resp.status === 401) {
      // Try refreshing and retrying once
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) return { jobs: [], citations: [] };
      
      const retryResp = await resilientFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${refreshed.session.access_token}` },
          body: JSON.stringify({
            skills: filters.skills, jobTypes: filters.jobTypes, location: filters.location,
            query: filters.query, careerLevel: filters.careerLevel, targetTitles: filters.targetTitles, limit: 50,
          }),
        },
        { retries: 1, timeoutMs: 20000, label: "enqueue-search-retry" }
      );
      
      if (!retryResp.ok) return { jobs: [], citations: [] };
      const retryData = await retryResp.json();
      if (retryData.jobs) {
        return {
          jobs: ((retryData.jobs || []) as JobResult[]).map(job => ({ ...job, url: normalizeJobUrl(job.url) })).filter(job => Boolean(job.url)),
          citations: retryData.citations || [],
        };
      }
      if (retryData.job_id) return pollForResults(retryData.job_id);
      return { jobs: [], citations: [] };
    }

    if (!resp.ok) {
      console.warn("[JobService] AI search enqueue failed with status:", resp.status);
      return { jobs: [], citations: [] };
    }
    
    const data = await resp.json();

    // If response already has jobs (sync fallback), return them
    if (data.jobs) {
      const normalizedJobs = ((data.jobs || []) as JobResult[])
        .map(job => ({ ...job, url: normalizeJobUrl(job.url) }))
        .filter(job => Boolean(job.url));
      return { jobs: normalizedJobs, citations: data.citations || [] };
    }

    // Step 2: Poll for results with token refresh
    if (data.job_id) {
      return pollForResults(data.job_id);
    }

    return { jobs: [], citations: [] };
  } catch (e) {
    console.error("[JobService] searchAIJobs error:", e);
    return { jobs: [], citations: [] };
  }
}

// ─── Combined Search (orchestrates DB + AI, never throws) ─────────────────

export async function searchJobs(filters: JobSearchFilters): Promise<{ jobs: JobResult[]; citations: string[] }> {
  let allJobs: JobResult[] = [];
  let allCitations: string[] = [];

  // Run DB and AI searches in parallel for speed, each independently fault-tolerant
  const promises: Promise<void>[] = [];

  if (filters.searchSource === "all" || filters.searchSource === "database") {
    promises.push(
      searchDatabaseJobs(filters)
        .then(dbJobs => { allJobs = allJobs.concat(dbJobs); })
        .catch(e => { console.error("[JobService] Database search failed (non-blocking):", e); })
    );
  }

  if (filters.searchSource === "all" || filters.searchSource === "ai") {
    promises.push(
      searchAIJobs(filters)
        .then(aiResult => {
          allJobs = allJobs.concat(aiResult.jobs);
          allCitations = aiResult.citations;
        })
        .catch(e => { console.error("[JobService] AI search failed (non-blocking):", e); })
    );
  }

  await Promise.all(promises);

  // Deduplicate by URL
  allJobs = allJobs.filter(job => Boolean(job.url));
  const uniqueByUrl = new Map<string, JobResult>();
  for (const job of allJobs) {
    if (!uniqueByUrl.has(job.url)) uniqueByUrl.set(job.url, job);
  }

  return { jobs: Array.from(uniqueByUrl.values()), citations: allCitations };
}
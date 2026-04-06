/**
 * Job Service — Core search logic.
 * Handles job search via edge function (async polling) and direct DB queries.
 * No cross-service imports.
 */

import { supabase } from "@/integrations/supabase/client";
import type { JobResult, JobSearchFilters } from "./types";

// ── URL normalization (kept from original) ─────────────────────────────

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
        if (urlObj.searchParams.has(param)) {
          url = urlObj.searchParams.get(param) || url;
          urlObj.searchParams.delete(param);
        }
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

// ── Fresh token helper ─────────────────────────────────────────────────

async function getFreshToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  } catch {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
}

// ── Resilient fetch with retries ───────────────────────────────────────

async function resilientFetch(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (resp.status === 401 && attempt < maxRetries) {
        const newToken = await getFreshToken();
        if (newToken) {
          const headers = new Headers(options.headers);
          headers.set("Authorization", `Bearer ${newToken}`);
          options = { ...options, headers };
        }
        continue;
      }
      if (resp.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return resp;
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

// ── Edge function URL builder ──────────────────────────────────────────

function getEdgeFunctionUrl(name: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/${name}`;
}

// ── Search Jobs (main entry — async polling) ───────────────────────────

export async function searchJobs(
  filters: JobSearchFilters
): Promise<{ jobs: JobResult[]; citations: string[] }> {
  const source = filters.searchSource || "all";

  // Parallel: DB search always runs; AI search only when source allows
  const dbPromise = (source === "all" || source === "database")
    ? searchDatabaseJobs(filters)
    : Promise.resolve([]);

  const aiPromise = (source === "all" || source === "ai")
    ? searchAIJobs(filters).catch(e => {
        console.error("[searchJobs] AI search failed (continuing with DB):", e);
        return { jobs: [] as JobResult[], citations: [] as string[] };
      })
    : Promise.resolve({ jobs: [] as JobResult[], citations: [] as string[] });

  const [dbJobs, aiResult] = await Promise.all([dbPromise, aiPromise]);
  const aiJobs = aiResult.jobs || [];
  const citations = aiResult.citations || [];

  // Merge & deduplicate by URL + title + company
  const seen = new Set<string>();
  const merged: JobResult[] = [];

  for (const job of [...aiJobs, ...dbJobs]) {
    const key = `${(job.url || "").toLowerCase()}|${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(job);
  }

  return { jobs: merged, citations };
}

// ── Database-only search ───────────────────────────────────────────────

export async function searchDatabaseJobs(
  filters: JobSearchFilters
): Promise<JobResult[]> {
  try {
    let query = supabase
      .from("scraped_jobs")
      .select("id, title, company, location, job_type, description, job_url, quality_score, is_flagged, flag_reasons, salary, seniority, is_remote, source, first_seen_at")
      .order("quality_score", { ascending: false })
      .limit(filters.search_mode === "volume" ? 800 : 200);

    // Apply text search if we have query/titles/skills
    const searchTerms = [
      filters.query,
      ...filters.targetTitles,
      ...filters.skills,
    ].filter(Boolean).join(" ");

    if (searchTerms.trim()) {
      query = query.or(
        `title.ilike.%${searchTerms.split(" ")[0]}%,description.ilike.%${searchTerms.split(" ")[0]}%`
      );
    }

    if (filters.location && !/remote/i.test(filters.location)) {
      query = query.ilike("location", `%${filters.location}%`);
    }

    if (!filters.showFlagged) {
      query = query.eq("is_flagged", false);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[searchDatabaseJobs] Error:", error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title || "Job Opportunity",
      company: row.company || "Company",
      location: row.location || "Remote",
      type: row.job_type || "full-time",
      description: row.description || "",
      url: normalizeJobUrl(row.job_url) || "",
      matchReason: "Database match",
      quality_score: row.quality_score ?? 50,
      is_flagged: row.is_flagged ?? false,
      flag_reasons: row.flag_reasons ?? [],
      salary: row.salary,
      seniority: row.seniority,
      is_remote: row.is_remote,
      source: row.source || "database",
      first_seen_at: row.first_seen_at,
    }));
  } catch (e) {
    console.error("[searchDatabaseJobs] Exception:", e);
    return [];
  }
}

// ── AI search via edge function (async polling pattern) ────────────────

export async function searchAIJobs(
  filters: JobSearchFilters
): Promise<{ jobs: JobResult[]; citations: string[] }> {
  const token = await getFreshToken();
  if (!token) {
    console.warn("[searchAIJobs] No auth token, skipping AI search");
    return { jobs: [], citations: [] };
  }

  const url = getEdgeFunctionUrl("search-jobs");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  const body = JSON.stringify({
    skills: filters.skills,
    jobTypes: filters.jobTypes,
    location: filters.location,
    query: filters.query,
    careerLevel: filters.careerLevel,
    targetTitles: filters.targetTitles,
    search_mode: filters.search_mode || "balanced",
    limit: filters.search_mode === "volume" ? 200 : 50,
  });

  // Step 1: Submit search job
  const submitResp = await resilientFetch(url, { method: "POST", headers, body });
  if (!submitResp.ok) {
    const text = await submitResp.text().catch(() => "");
    console.error("[searchAIJobs] Submit failed:", submitResp.status, text);
    return { jobs: [], citations: [] };
  }

  const submitData = await submitResp.json();

  // If the response is immediate (no polling needed)
  if (submitData.jobs) {
    return {
      jobs: normalizeAIJobs(submitData.jobs),
      citations: submitData.citations || [],
    };
  }

  // Step 2: Poll for results
  const jobId = submitData.job_id;
  if (!jobId) {
    console.warn("[searchAIJobs] No job_id returned");
    return { jobs: [], citations: [] };
  }

  const maxPolls = 15;
  const pollInterval = 2000;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, pollInterval));

    // Refresh token before each poll to avoid 401
    const freshToken = await getFreshToken();
    if (freshToken) headers["Authorization"] = `Bearer ${freshToken}`;

    const pollResp = await resilientFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ job_id: jobId }),
    });

    if (!pollResp.ok) continue;

    const pollData = await pollResp.json();

    if (pollData.status === "completed" && pollData.jobs) {
      return {
        jobs: normalizeAIJobs(pollData.jobs),
        citations: pollData.citations || [],
      };
    }

    if (pollData.status === "failed") {
      console.error("[searchAIJobs] Job failed:", pollData.error);
      return { jobs: [], citations: [] };
    }

    // Still processing — continue polling
  }

  console.warn("[searchAIJobs] Polling timed out for job", jobId);
  return { jobs: [], citations: [] };
}

// ── Normalize AI response jobs ─────────────────────────────────────────

function normalizeAIJobs(raw: any[]): JobResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      title: item.title || "Job Opportunity",
      company: item.company || "Company",
      location: item.location || "Remote",
      type: item.type || item.job_type || "full-time",
      description: item.description || "",
      url: normalizeJobUrl(item.url || item.job_url) || "",
      matchReason: item.matchReason || "AI match",
      quality_score: item.qualityScore ?? item.quality_score ?? 50,
      is_flagged: item.is_flagged ?? false,
      flag_reasons: item.flag_reasons ?? [],
      salary: item.salary,
      seniority: item.seniority,
      is_remote: item.is_remote ?? /remote/i.test(item.location || ""),
      source: "ai",
      first_seen_at: item.first_seen_at,
    }))
    .filter((j: JobResult) => j.url && j.title !== "Job Opportunity");
}

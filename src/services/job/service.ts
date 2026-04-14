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

// NOTE: Only used by AI search (currently disabled). Keep for future re-enablement.
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

// NOTE: Only used by AI search (currently disabled). Keep for future re-enablement.
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
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

// ── Edge function URL builder ──────────────────────────────────────────

function getEdgeFunctionUrl(name: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/${name}`;
}

// ── Search Jobs (main entry — database-only mode) ────────────────────────

// Main entry: database-only search — zero external cost
export async function searchJobs(
  filters: JobSearchFilters
): Promise<{ jobs: JobResult[]; citations: string[] }> {
  const dbJobs = await searchDatabaseJobs(filters);
  return { jobs: dbJobs, citations: [] };
}

// ── Database-only search ───────────────────────────────────────────────

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

export async function searchDatabaseJobs(
  filters: JobSearchFilters
): Promise<JobResult[]> {
  try {
    const limit  = filters.search_mode === "volume" ? 800 : 200;
    const offset = filters.offset ?? 0;

    let query = supabase
      .from("scraped_jobs")
      .select("id, title, company, location, job_type, description, job_url, quality_score, is_flagged, flag_reasons, salary, market_rate, seniority, is_remote, source, first_seen_at")
      .order("quality_score", { ascending: false })
      .range(offset, offset + limit - 1);

    // ── Text search ────────────────────────────────────────────────────
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

    // ── Location filter ────────────────────────────────────────────────
    if (filters.location && !/^\s*remote\s*$/i.test(filters.location)) {
      query = query.ilike("location", `%${filters.location}%`);
    }

    // ── Remote filter ──────────────────────────────────────────────────
    if (filters.jobTypes.includes("remote")) query = query.eq("is_remote", true);

    // ── Structured job type filter ─────────────────────────────────────
    const structuredTypes = filters.jobTypes
      .filter(t => !["remote", "hybrid", "in-office"].includes(t))
      .flatMap(t => JOB_TYPE_MAP[t] ?? [t]);
    if (structuredTypes.length > 0) {
      query = query.or(structuredTypes.map(t => `job_type.ilike.%${t}%`).join(","));
    }

    // ── Seniority / career level filter ───────────────────────────────
    if (filters.careerLevel) {
      const levels = filters.careerLevel.split(",").map(s => s.trim()).filter(Boolean);
      const seniorityValues = levels.flatMap(l => CAREER_LEVEL_TO_SENIORITY[l] ?? []);
      if (seniorityValues.length > 0) {
        query = query.or(seniorityValues.map(s => `seniority.ilike.%${s}%`).join(","));
      }
    }

    // ── Salary filter (uses market_rate numeric column) ────────────────
    const salaryMinNum = filters.salaryMin ? parseInt(filters.salaryMin.replace(/\D/g, ""), 10) : null;
    const salaryMaxNum = filters.salaryMax ? parseInt(filters.salaryMax.replace(/\D/g, ""), 10) : null;
    if (salaryMinNum && !isNaN(salaryMinNum)) query = query.gte("market_rate", salaryMinNum);
    if (salaryMaxNum && !isNaN(salaryMaxNum)) query = query.lte("market_rate", salaryMaxNum);

    // ── Freshness filter ───────────────────────────────────────────────
    const daysOld = filters.days_old ?? 0;
    if (daysOld > 0) {
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("first_seen_at", cutoff);
    }

    // ── Flagged filter ─────────────────────────────────────────────────
    if (!filters.showFlagged) query = query.eq("is_flagged", false);

    const { data, error } = await query;
    if (error) { console.error("[searchDatabaseJobs] Error:", error.message); return []; }

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

// ── AI search (disabled in database-only mode) ─────────────────────────

// AI search via edge function — DISABLED (database-only mode, zero cost)
export async function searchAIJobs(
  filters: JobSearchFilters
): Promise<{ jobs: JobResult[]; citations: string[] }> {
  console.info("[searchAIJobs] Skipped — database-only mode active. AI search disabled to operate at zero cost.");
  return { jobs: [], citations: [] };
}

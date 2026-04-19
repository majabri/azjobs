/**
 * _shared/job-search.ts — Core job-search logic shared across edge functions.
 *
 * Consumers:
 *   - supabase/functions/search-jobs/index.ts   (HTTP endpoint for the frontend)
 *   - supabase/functions/agent-orchestrator/index.ts  (discovery agent)
 *
 * Why this exists:
 *   agent-orchestrator previously called the search-jobs *edge function* over
 *   HTTP (function-to-function coupling).  Extracting the query logic here
 *   lets both functions share the same DB query without an extra HTTP hop.
 */

// ─── Env ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobSearchParams {
  /** Free-text query or "title1 OR title2" expression */
  query?: string;
  skills?: string[];
  jobTypes?: string[];
  location?: string;
  targetTitles?: string[];
  limit?: number;
  search_mode?: "quality" | "balanced" | "volume";
}

export interface NormalizedJob {
  id?: string;
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  url: string;
  source: "db";
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  date_posted?: string;
  is_remote?: boolean;
  fit_score?: number | null;
  skill_gaps?: string[];
  match_reasons?: string[];
}

export interface JobSearchResult {
  jobs: NormalizedJob[];
  total: number;
  query: string;
}

// ─── Internal PostgREST helper ────────────────────────────────────────────────

async function pgGet(table: string, qs: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`pgGet ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Core search function ─────────────────────────────────────────────────────

/**
 * Query job_postings in the database and return normalised results.
 *
 * This is the canonical implementation shared by the `search-jobs` HTTP
 * endpoint and the `agent-orchestrator` discovery agent.  Neither caller
 * should duplicate this logic independently.
 */
export async function searchJobPostings(params: JobSearchParams): Promise<JobSearchResult> {
  const { query, skills, jobTypes, location, targetTitles, limit = 50 } = params;

  // ── Build search term ──────────────────────────────────────────────────────
  const terms: string[] = [];
  if (query?.trim()) terms.push(query.trim());
  if (targetTitles?.length) terms.push(...targetTitles.slice(0, 3));
  if (skills?.length && !terms.length) terms.push(...skills.slice(0, 3));

  const searchTerm = terms.join(" OR ") || "software engineer";
  const encodedTerm = encodeURIComponent(searchTerm.split(" OR ")[0]);

  // ── PostgREST filter list ──────────────────────────────────────────────────
  const select = [
    "id", "external_id", "title", "company", "location", "is_remote",
    "job_type", "salary_min", "salary_max", "salary_currency",
    "description", "job_url", "source", "date_posted", "scraped_at",
  ].join(",");

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const filters: string[] = [
    `select=${select}`,
    `or=(title.ilike.*${encodedTerm}*,company.ilike.*${encodedTerm}*,description.ilike.*${encodedTerm}*)`,
    `scraped_at=gte.${cutoff}`,
    `order=scraped_at.desc`,
    `limit=${Math.min(limit, 100)}`,
  ];

  if (location) filters.push(`location=ilike.*${encodeURIComponent(location)}*`);
  if (jobTypes?.length === 1) filters.push(`job_type=eq.${encodeURIComponent(jobTypes[0])}`);

  const rawJobs = await pgGet("job_postings", filters.join("&"));

  // ── Normalise ──────────────────────────────────────────────────────────────
  const jobs: NormalizedJob[] = (rawJobs ?? []).map((j: any) => ({
    id: j.id,
    title: j.title || "",
    company: j.company || "",
    location: j.location || "",
    type: j.job_type || "",
    description: (j.description || "").slice(0, 2000),
    url: j.job_url || "",
    source: "db" as const,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    salary_currency: j.salary_currency,
    date_posted: j.date_posted,
    is_remote: j.is_remote,
  }));

  return { jobs, total: jobs.length, query: searchTerm };
}

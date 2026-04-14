/**
 * SEARCH-JOBS EDGE FUNCTION — CURRENTLY DISABLED
 *
 * This edge function is not called in database-only mode.
 * Job search operates via direct Supabase queries from the client.
 *
 * To re-enable AI search:
 * 1. Set feature flag 'ai_search' to true in feature_flags table
 * 2. Set FIRECRAWL_API_KEY in Supabase secrets
 * 3. Restore the dual-source logic in src/services/job/service.ts searchJobs()
 * 4. Deploy this function: supabase functions deploy search-jobs
 */

// iCareerOS v5 â search-jobs Edge Function
// Zero-dependency: uses Deno.serve + inline PostgREST client.
// Replaces the old 707-line Firecrawl-based search with direct job_postings queries.
// Called by agent-orchestrator discovery agent + frontend JobSearch page.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

function svcHeaders(prefer = "return=representation"): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

async function pgGet(table: string, qs: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
  });
  if (!res.ok) throw new Error(`pgGet ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function pgPost(table: string, body: any, prefer = "return=minimal"): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...svcHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pgPost ${table}: ${res.status}`);
  if (prefer === "return=minimal") return null;
  return res.json();
}

async function getUser(authHeader: string): Promise<{ id: string } | null> {
  if (!authHeader) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.id ? u : null;
}

// âââ Types âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
type SearchRequest = {
  query?: string;
  skills?: string[];
  jobTypes?: string[];
  location?: string;
  careerLevel?: string;
  targetTitles?: string[];
  limit?: number;
  search_mode?: "quality" | "balanced" | "volume";
  job_id?: string;
};

type NormalizedJob = {
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
};

// âââ Handler âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const user = await getUser(authHeader);

    const body: SearchRequest = await req.json().catch(() => ({}));
    const { query, skills, jobTypes, location, targetTitles, limit = 50, job_id } = body;

    // ââ Single job lookup by ID ââââââââââââââââââââââââââââââââââââââââ
    if (job_id) {
      const jobs = await pgGet("job_postings", `select=*&id=eq.${job_id}&limit=1`);
      if (!jobs?.length) {
        return new Response(JSON.stringify({ jobs: [], total: 0 }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j = jobs[0];
      const normalized: NormalizedJob = {
        title: j.title || "",
        company: j.company || "",
        location: j.location || "",
        type: j.job_type || "",
        description: j.description || "",
        url: j.job_url || "",
        source: "db",
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        salary_currency: j.salary_currency,
        date_posted: j.date_posted,
        is_remote: j.is_remote,
      };
      return new Response(JSON.stringify({ jobs: [normalized], total: 1 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ââ Build search term ââââââââââââââââââââââââââââââââââââââââââââââ
    const terms: string[] = [];
    if (query?.trim()) terms.push(query.trim());
    if (targetTitles?.length) terms.push(...targetTitles.slice(0, 3));
    if (skills?.length && !terms.length) terms.push(...skills.slice(0, 3));

    const searchTerm = terms.join(" OR ") || "software engineer";
    const encodedTerm = encodeURIComponent(searchTerm.split(" OR ")[0]); // Use first term for ilike

    // ââ Build PostgREST filters ââââââââââââââââââââââââââââââââââââââââ
    const select = [
      "id", "external_id", "title", "company", "location", "is_remote",
      "job_type", "salary_min", "salary_max", "salary_currency",
      "description", "job_url", "source", "date_posted", "scraped_at",
    ].join(",");

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

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

    // ââ Normalize results âââââââââââââââââââââââââââââââââââââââââââââââ
    let jobs: NormalizedJob[] = (rawJobs ?? []).map((j: any) => ({
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

    // ââ Enrich with fit scores if user is authenticated ââââââââââââââââ
    if (user?.id && jobs.length > 0) {
      try {
        const jobIds = rawJobs.map((j: any) => j.id);
        const matches = await pgGet(
          "user_job_matches",
          `select=job_posting_id,fit_score,skill_gaps,match_reasons&user_id=eq.${user.id}&job_posting_id=in.(${jobIds.join(",")})`,
        );
        if (matches?.length) {
          const matchMap = Object.fromEntries(matches.map((m: any) => [m.job_posting_id, m]));
          jobs = jobs.map((job, i) => ({
            ...job,
            fit_score: matchMap[rawJobs[i]?.id]?.fit_score ?? null,
            skill_gaps: matchMap[rawJobs[i]?.id]?.skill_gaps ?? [],
            match_reasons: matchMap[rawJobs[i]?.id]?.match_reasons ?? [],
          }));
          // Sort by fit score (highest first, nulls last)
          jobs.sort((a, b) => {
            if (a.fit_score === null && b.fit_score === null) return 0;
            if (a.fit_score === null) return 1;
            if (b.fit_score === null) return -1;
            return (b.fit_score ?? 0) - (a.fit_score ?? 0);
          });
        }
      } catch { /* user_job_matches may not exist yet */ }
    }

    // ââ Log search for analytics (non-blocking) ââââââââââââââââââââââââ
    if (user?.id) {
      pgPost("search_queries", {
        user_id: user.id,
        search_term: searchTerm,
        location: location || null,
        result_count: jobs.length,
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        jobs,
        total: jobs.length,
        query: searchTerm,
        source: "icareeros-v5",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("search-jobs error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

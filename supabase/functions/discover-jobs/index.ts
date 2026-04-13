// iCareerOS v5 — discover-jobs Edge Function
// Zero-dependency: uses inline PostgREST client (no npm/jsr/esm imports).
// Queries the pre-populated job_postings table and enriches with cached fit scores.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Inline PostgREST helper ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function pgrest(
  table: string,
  query: string,
  opts: { method?: string; body?: string; prefer?: string } = {},
): Promise<any> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
    },
    ...(opts.body ? { body: opts.body } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostgREST ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      searchTerm,
      location,
      isRemote,
      jobType,
      salaryMin,
      minFitScore,
      hoursOld = 48,
      limit = 50,
      offset = 0,
      userId,
    } = await req.json();

    if (!searchTerm?.trim()) {
      return new Response(
        JSON.stringify({ error: "searchTerm is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log this search for dynamic scraper config (non-blocking)
    if (userId) {
      pgrest(
        "search_queries",
        "",
        {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            search_term: searchTerm.trim(),
            location: location || null,
            is_remote: isRemote || null,
          }),
          prefer: "return=minimal",
        },
      ).catch(() => {}); // fire-and-forget
    }

    const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
    const term = searchTerm.trim();

    // Build PostgREST query filters
    const select = [
      "id", "external_id", "title", "company", "location", "is_remote",
      "job_type", "salary_min", "salary_max", "salary_currency",
      "description", "job_url", "source", "date_posted", "scraped_at",
    ].join(",");

    const filters: string[] = [
      `select=${select}`,
      `or=(title.ilike.*${encodeURIComponent(term)}*,company.ilike.*${encodeURIComponent(term)}*,description.ilike.*${encodeURIComponent(term)}*)`,
      `scraped_at=gte.${cutoff}`,
      `order=scraped_at.desc`,
      `offset=${offset}`,
      `limit=${limit}`,
    ];

    if (location)  filters.push(`location=ilike.*${encodeURIComponent(location)}*`);
    if (isRemote)  filters.push(`is_remote=eq.true`);
    if (jobType)   filters.push(`job_type=eq.${encodeURIComponent(jobType)}`);
    if (salaryMin) filters.push(`salary_min=gte.${salaryMin}`);

    const jobs: any[] = await pgrest("job_postings", filters.join("&"));

    // Enrich with cached fit scores if userId provided
    let jobsWithScores = jobs ?? [];
    if (userId && jobsWithScores.length > 0) {
      const jobIds = jobsWithScores.map((j: any) => j.id);
      try {
        const matches: any[] = await pgrest(
          "user_job_matches",
          `select=job_posting_id,fit_score,skill_gaps,match_reasons&user_id=eq.${userId}&job_posting_id=in.(${jobIds.join(",")})`,
        );

        if (matches?.length) {
          const matchMap = Object.fromEntries(
            matches.map((m: any) => [m.job_posting_id, m]),
          );
          jobsWithScores = jobsWithScores.map((job: any) => ({
            ...job,
            fit_score: matchMap[job.id]?.fit_score ?? null,
            skill_gaps: matchMap[job.id]?.skill_gaps ?? [],
            match_reasons: matchMap[job.id]?.match_reasons ?? [],
          }));

          if (minFitScore && minFitScore > 0) {
            jobsWithScores = jobsWithScores.filter(
              (j: any) => j.fit_score === null || j.fit_score >= minFitScore,
            );
          }

          jobsWithScores.sort((a: any, b: any) => {
            if (a.fit_score === null && b.fit_score === null) return 0;
            if (a.fit_score === null) return 1;
            if (b.fit_score === null) return -1;
            return b.fit_score - a.fit_score;
          });
        }
      } catch {
        // user_job_matches table may not exist yet — skip enrichment
      }
    }

    return new Response(
      JSON.stringify({
        jobs: jobsWithScores,
        total: jobsWithScores.length,
        searchTerm,
        source: "icareeros-native-v5",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("discover-jobs error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

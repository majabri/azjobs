/**
 * discover-jobs — Job Search + AI Match Enrichment (Supabase Edge Function, Deno)
 *
 * Queries job_postings with filters and enriches results with AI fit scores
 * from user_job_matches. If the user has unscored jobs, triggers background
 * matching (fire-and-forget) so the next search returns enriched results.
 *
 * Zero-dependency: uses inline PostgREST fetch (no npm/jsr imports).
 * This keeps cold-start time minimal.
 *
 * POST body:
 *  {
 *    searchTerm: string,       required — keywords to search
 *    userId?: string,          — enrich with AI fit scores for this user
 *    location?: string,
 *    isRemote?: boolean,
 *    jobType?: string,         — 'fulltime' | 'parttime' | 'contract' | 'internship'
 *    salaryMin?: number,
 *    minFitScore?: number,     — filter out jobs below this score (0-100)
 *    hoursOld?: number,        — max age in hours (default 48)
 *    limit?: number,           — max results (default 50)
 *    offset?: number,          — pagination (default 0)
 *    triggerMatch?: boolean,   — fire background match-jobs if unscored jobs exist
 *  }
 *
 * Response:
 *  {
 *    jobs: JobResult[],
 *    total: number,
 *    searchTerm: string,
 *    matchingTriggered: boolean,
 *    source: "icareeros-native-v6"
 *  }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

// ---------------------------------------------------------------------------
// Inline PostgREST helper (zero deps)
// ---------------------------------------------------------------------------

async function pgrest(
  table: string,
  query: string,
  opts: { method?: string; body?: string; prefer?: string } = {}
): Promise<any> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer ?? "return=representation",
    },
    ...(opts.body ? { body: opts.body } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostgREST ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function verifyToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Background match trigger (fire-and-forget)
// ---------------------------------------------------------------------------

function triggerBackgroundMatch(authToken: string, userId: string): void {
  const url = `${SUPABASE_URL}/functions/v1/match-jobs`;
  fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, limit: 50 }),
  }).catch((e) => console.warn("[discover-jobs] Background match trigger failed:", e));
  // fire-and-forget — response ignored
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    let authenticatedUserId: string | null = null;
    if (token) {
      authenticatedUserId = await verifyToken(token);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const {
      searchTerm,
      userId: requestedUserId,
      location,
      isRemote,
      jobType,
      salaryMin,
      minFitScore,
      hoursOld = 48,
      limit = 50,
      offset = 0,
      triggerMatch = true,
    } = await req.json();

    if (!searchTerm?.trim()) {
      return jsonRes({ error: "searchTerm is required" }, 400);
    }

    // Use authenticated userId, fall back to requested (for service-role calls)
    const userId = authenticatedUserId ?? requestedUserId ?? null;
    const term = searchTerm.trim();
    const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();

    // ── Log search (fire-and-forget) ──────────────────────────────────────────
    if (userId) {
      pgrest("search_queries", "", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          search_term: term,
          location: location ?? null,
          is_remote: isRemote ?? null,
        }),
        prefer: "return=minimal",
      }).catch(() => {});
    }

    // ── Query job_postings ────────────────────────────────────────────────────
    const selectCols = [
      "id", "external_id", "title", "company", "location", "is_remote",
      "job_type", "salary_min", "salary_max", "salary_currency",
      "description", "job_url", "apply_url", "source", "date_posted", "scraped_at",
    ].join(",");

    const filters: string[] = [
      `select=${selectCols}`,
      `scraped_at=gte.${cutoff}`,
      `or=(title.ilike.*${encodeURIComponent(term)}*,company.ilike.*${encodeURIComponent(term)}*,description.ilike.*${encodeURIComponent(term)}*)`,
      `order=scraped_at.desc`,
      `offset=${offset}`,
      `limit=${Math.min(limit, 200)}`,
    ];

    if (location && location.toLowerCase() !== "remote") {
      filters.push(`location=ilike.*${encodeURIComponent(location)}*`);
    }
    if (isRemote) filters.push(`is_remote=eq.true`);
    if (jobType)  filters.push(`job_type=eq.${encodeURIComponent(jobType)}`);
    if (salaryMin) filters.push(`salary_min=gte.${salaryMin}`);

    const jobs: any[] = (await pgrest("job_postings", filters.join("&"))) ?? [];

    // ── Enrich with AI fit scores ─────────────────────────────────────────────
    let jobsWithScores = jobs;
    let matchingTriggered = false;

    if (userId && jobsWithScores.length > 0) {
      const jobIds = jobsWithScores.map((j: any) => j.id);

      try {
        // Fetch cached matches for these specific jobs
        const matches: any[] = await pgrest(
          "user_job_matches",
          `select=job_id,fit_score,matched_skills,skill_gaps,strengths,red_flags,match_summary,effort_level,response_prob,smart_tag,is_saved,is_ignored,is_applied` +
          `&user_id=eq.${userId}` +
          `&job_id=in.(${jobIds.join(",")})` +
          `&is_ignored=eq.false`
        );

        if (matches?.length) {
          const matchMap = new Map(matches.map((m: any) => [m.job_id, m]));

          jobsWithScores = jobsWithScores
            .filter((j: any) => {
              const m = matchMap.get(j.id);
              return !m?.is_ignored; // hide ignored jobs
            })
            .map((job: any) => {
              const m = matchMap.get(job.id);
              return m ? {
                ...job,
                fit_score: m.fit_score,
                matched_skills: m.matched_skills ?? [],
                skill_gaps: m.skill_gaps ?? [],
                strengths: m.strengths ?? [],
                red_flags: m.red_flags ?? [],
                match_summary: m.match_summary ?? "",
                effort_level: m.effort_level,
                response_prob: m.response_prob,
                smart_tag: m.smart_tag,
                is_saved: m.is_saved ?? false,
                is_applied: m.is_applied ?? false,
              } : { ...job, fit_score: null };
            });

          // Apply minFitScore filter (only to jobs that have been scored)
          if (minFitScore && minFitScore > 0) {
            jobsWithScores = jobsWithScores.filter(
              (j: any) => j.fit_score === null || j.fit_score >= minFitScore
            );
          }

          // Sort: scored jobs first (by score desc), then unscored
          jobsWithScores.sort((a: any, b: any) => {
            if (a.fit_score === null && b.fit_score === null) return 0;
            if (a.fit_score === null) return 1;
            if (b.fit_score === null) return -1;
            return b.fit_score - a.fit_score;
          });
        }

        // Trigger background matching if there are unscored jobs
        const scoredIds = new Set(matches?.map((m: any) => m.job_id) ?? []);
        const unscoredCount = jobIds.filter((id: string) => !scoredIds.has(id)).length;

        if (triggerMatch && unscoredCount > 0 && token) {
          triggerBackgroundMatch(token, userId);
          matchingTriggered = true;
          console.log(`[discover-jobs] Triggered background match for ${unscoredCount} unscored jobs (user ${userId})`);
        }

      } catch (enrichErr) {
        // user_job_matches may not exist yet — skip enrichment gracefully
        console.warn("[discover-jobs] Enrichment skipped:", enrichErr instanceof Error ? enrichErr.message : enrichErr);

        // Still trigger matching so the table gets populated
        if (triggerMatch && token) {
          triggerBackgroundMatch(token, userId);
          matchingTriggered = true;
        }
      }
    }

    return jsonRes({
      jobs: jobsWithScores,
      total: jobsWithScores.length,
      searchTerm: term,
      matchingTriggered,
      source: "icareeros-native-v6",
    });

  } catch (err) {
    console.error("[discover-jobs] Error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

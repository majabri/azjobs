/**
 * discover-jobs — Job Search + AI Match Enrichment (Supabase Edge Function, Deno)
 *
 * Queries scraped_jobs view with multi-term OR filters and enriches results
 * with AI fit scores from user_job_matches.
 *
 * POST body:
 *  {
 *    searchTerm?: string,       — free-text keyword (optional when targetTitles provided)
 *    targetTitles?: string[],   — user's target job titles (matched against job title)
 *    skills?: string[],         — user's skills (matched as full phrases against description)
 *    userId?: string,
 *    location?: string,
 *    isRemote?: boolean,
 *    jobType?: string,
 *    salaryMin?: number,
 *    minFitScore?: number,
 *    daysOld?: number,          — max age in days (default 7)
 *    limit?: number,            — max results (default 50)
 *    offset?: number,
 *    triggerMatch?: boolean,
 *  }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

// Words that are too generic to be useful as search terms
const NOISE = new Set([
  "and","the","for","with","that","from","this","have","will","your",
  "our","their","team","work","role","level","years","experience",
  "business","process","operations","services","enterprise","solutions",
  "digital","strategy","development","information","improvement",
  "regulatory","service","change","employee","cloud","customer","product",
  "data","people","support","using","strong","ability","skills",
]);

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
}

// ---------------------------------------------------------------------------
// Build multi-term PostgREST OR filter
// Returns null if no valid terms found
// ---------------------------------------------------------------------------

function buildOrFilter(terms: string[]): string | null {
  const parts = terms
    .map(t => t.replace(/[%*]/g, "").trim())
    .filter(t => t.length >= 3);
  if (!parts.length) return null;
  // PostgREST ilike uses * as wildcard in URL params
  return `or=(${parts.map(t => `title.ilike.*${encodeURIComponent(t)}*`).join(",")})`;
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
    const body = await req.json();
    const {
      searchTerm = "",
      targetTitles = [],
      skills = [],
      userId: requestedUserId,
      location,
      isRemote,
      jobType,
      salaryMin,
      minFitScore,
      daysOld = 30,         // default: 30 days (scraper may not run daily; show all recent jobs)
      hoursOld,             // legacy: if provided, takes precedence
      limit = 50,
      offset = 0,
      triggerMatch = true,
    } = body;

    const userId = authenticatedUserId ?? requestedUserId ?? null;

    // Resolve time window: prefer daysOld, but accept legacy hoursOld
    const effectiveDays = hoursOld ? Math.ceil(hoursOld / 24) : (daysOld || 30);
    const cutoff = new Date(Date.now() - effectiveDays * 86400000).toISOString();

    // ── Log search (fire-and-forget) ──────────────────────────────────────────
    const logTerm = targetTitles[0] || searchTerm || "";
    if (userId && logTerm) {
      pgrest("search_queries", "", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          search_term: logTerm,
          location: location ?? null,
          is_remote: isRemote ?? null,
        }),
        prefer: "return=minimal",
      }).catch(() => {});
    }

    // ── scraped_jobs column list ──────────────────────────────────────────────
    // Uses the scraped_jobs view (reads from job_postings table).
    // NOTE: date_posted is NOT exposed by the view — use first_seen_at instead.
    const selectCols = [
      "id", "title", "company", "location", "is_remote",
      "job_type", "salary", "description", "job_url",
      "source", "first_seen_at", "quality_score",
      "is_flagged", "flag_reasons", "seniority",
    ].join(",");

    // ── Build two-pass search (title-first, then description) ─────────────────

    // Extract key 2-3 word phrases from a long title for broader matching.
    // e.g. "Business Information Security Officer" → ["Information Security", "Security Officer"]
    // Only keeps phrases that contain at least one domain-signal word, so generic terms
    // like "Vice President" alone don't flood results with off-domain VP roles.
    const DOMAIN_SIGNALS = new Set([
      "security","cyber","cybersecurity","ciso","privacy","compliance","risk","governance",
      "architect","engineering","infrastructure","cloud","devops","data","analytics","ai","ml",
      "product","marketing","finance","legal","operations","procurement","hr","talent","recruiting",
      "sales","design","ux","research","audit","fraud","identity","access","network","systems",
    ]);
    function extractTitleKeyPhrases(title: string): string[] {
      const TITLE_STOP = new Set(["of","and","the","in","for","at","a","an","to","with","by","i","ii","iii","iv"]);
      const words = title.replace(/[,&()\./]/g, " ").split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 2 && !TITLE_STOP.has(w.toLowerCase()));
      const phrases: string[] = [];
      for (let i = 0; i < words.length - 1; i++) {
        const p2 = `${words[i]} ${words[i+1]}`;
        // Only add if at least one word is a domain signal
        const p2Words = [words[i].toLowerCase(), words[i+1].toLowerCase()];
        const hasSignal = p2Words.some(w => DOMAIN_SIGNALS.has(w));
        if (p2.length >= 8 && hasSignal && !NOISE.has(words[i].toLowerCase())) phrases.push(p2);
        if (i < words.length - 2) {
          const p3 = `${words[i]} ${words[i+1]} ${words[i+2]}`;
          const p3Words = [words[i].toLowerCase(), words[i+1].toLowerCase(), words[i+2].toLowerCase()];
          if (p3.length >= 10 && p3Words.some(w => DOMAIN_SIGNALS.has(w))) phrases.push(p3);
        }
      }
      return phrases;
    }

    // PASS 1: Title matches from user's target titles + extracted key phrases
    const titleTerms: string[] = [
      ...targetTitles.map((t: string) =>
        t.replace(/[,&()]/g, " ").replace(/[%*]/g, "").replace(/\s+/g, " ").trim()
      ).filter((t: string) => t.length >= 3),
    ];

    // Also add key phrase extractions from long titles — so "Business Information Security Officer"
    // also triggers searches for "Information Security", "Security Architect", etc.
    const titleKeyPhrases = targetTitles.flatMap((t: string) => extractTitleKeyPhrases(t));
    // Deduplicate and add (cap at 15 extra terms to avoid huge OR clauses)
    const seenTerms = new Set(titleTerms.map((t: string) => t.toLowerCase()));
    for (const phrase of titleKeyPhrases) {
      if (!seenTerms.has(phrase.toLowerCase())) {
        titleTerms.push(phrase);
        seenTerms.add(phrase.toLowerCase());
      }
      if (titleTerms.length >= 30) break;
    }

    // Add meaningful words from the free-text searchTerm to title pass
    if (searchTerm && searchTerm.trim()) {
      const queryWords = searchTerm.split(/\s+/)
        .map((w: string) => w.replace(/[^a-zA-Z0-9\-]/g, "").trim())
        .filter((w: string) => w.length >= 4 && !NOISE.has(w.toLowerCase()));
      titleTerms.push(...queryWords.slice(0, 4));
    }

    // PASS 2: Skill phrases matched in description
    const skillPhrases = skills
      .map((s: string) => s.replace(/[%*()\[\]]/g, "").replace(/[,&]/g, " ").replace(/\s+/g, " ").trim())
      .filter((s: string) => s.length >= 5);

    let pass1Jobs: any[] = [];
    let pass2Jobs: any[] = [];

    const baseParams = [
      `select=${selectCols}`,
      `first_seen_at=gte.${cutoff}`,       // correct column for scraped_jobs
      `order=quality_score.desc`,
      `offset=${offset}`,
      `limit=${Math.min(limit, 200)}`,
    ];
    if (location && !/^\s*remote\s*$/i.test(location)) {
      baseParams.push(`location=ilike.*${encodeURIComponent(location)}*`);
    }
    if (isRemote) baseParams.push(`is_remote=eq.true`);
    if (jobType)  baseParams.push(`job_type=eq.${encodeURIComponent(jobType)}`);
    if (salaryMin) baseParams.push(`market_rate=gte.${salaryMin}`);  // view uses market_rate, not salary_min

    // ── PASS 1 query ──────────────────────────────────────────────────────────
    if (titleTerms.length > 0) {
      const titleOr = titleTerms.slice(0, 20)
        .map((t: string) => `title.ilike.*${encodeURIComponent(t)}*`)
        .join(",");
      const p1Params = [...baseParams, `or=(${titleOr})`];
      try {
        pass1Jobs = (await pgrest("scraped_jobs", p1Params.join("&"))) ?? [];
      } catch (e) {
        console.warn("[discover-jobs] Pass 1 error:", e instanceof Error ? e.message : e);
      }
    }

    const pass1Ids = new Set(pass1Jobs.map((j: any) => j.id));

    // ── PASS 2 query ──────────────────────────────────────────────────────────
    if (skillPhrases.length > 0) {
      const descOr = skillPhrases.slice(0, 8)
        .map((p: string) => `description.ilike.*${encodeURIComponent(p)}*`)
        .join(",");
      const p2Params = [...baseParams, `or=(${descOr})`];
      try {
        const raw = (await pgrest("scraped_jobs", p2Params.join("&"))) ?? [];
        // Exclude jobs already in pass 1
        pass2Jobs = raw.filter((j: any) => !pass1Ids.has(j.id));
      } catch (e) {
        console.warn("[discover-jobs] Pass 2 error:", e instanceof Error ? e.message : e);
      }
    }

    // ── FALLBACK A: free-text searchTerm against title + description ─────────
    if (pass1Jobs.length === 0 && pass2Jobs.length === 0 && searchTerm.trim()) {
      const fallbackOr = `or=(title.ilike.*${encodeURIComponent(searchTerm.trim())}*,description.ilike.*${encodeURIComponent(searchTerm.trim())}*)`;
      try {
        pass1Jobs = (await pgrest("scraped_jobs", [...baseParams, fallbackOr].join("&"))) ?? [];
      } catch (e) {
        console.warn("[discover-jobs] Fallback A error:", e instanceof Error ? e.message : e);
      }
    }

    // ── FALLBACK B: relax the date window — try 90 days if still no results ──
    // Handles users whose target titles are scraped less frequently.
    if (pass1Jobs.length === 0 && pass2Jobs.length === 0 && titleTerms.length > 0) {
      const looseCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
      const looseBase = baseParams.map((p: string) =>
        p.startsWith("first_seen_at=gte.") ? `first_seen_at=gte.${looseCutoff}` : p
      );
      const titleOr90 = titleTerms.slice(0, 20)
        .map((t: string) => `title.ilike.*${encodeURIComponent(t)}*`)
        .join(",");
      try {
        pass1Jobs = (await pgrest("scraped_jobs", [...looseBase, `or=(${titleOr90})`].join("&"))) ?? [];
        if (pass1Jobs.length > 0) console.log(`[discover-jobs] Fallback B (90d): ${pass1Jobs.length} jobs`);
      } catch (e) {
        console.warn("[discover-jobs] Fallback B error:", e instanceof Error ? e.message : e);
      }
    }

    // ── FALLBACK C: no criteria at all — return recent high-quality jobs ─────
    // Ensures users with empty profiles (no titles, no skills, no query) still
    // see something relevant rather than a blank page.
    if (pass1Jobs.length === 0 && pass2Jobs.length === 0) {
      try {
        const fallbackParams = [
          `select=${selectCols}`,
          `order=quality_score.desc,first_seen_at.desc`,
          `limit=${Math.min(limit, 50)}`,
        ];
        // Keep location / remote / jobType filters if provided
        if (location && !/^\s*remote\s*$/i.test(location)) {
          fallbackParams.push(`location=ilike.*${encodeURIComponent(location)}*`);
        }
        if (isRemote) fallbackParams.push(`is_remote=eq.true`);
        if (jobType)  fallbackParams.push(`job_type=eq.${encodeURIComponent(jobType)}`);
        pass1Jobs = (await pgrest("scraped_jobs", fallbackParams.join("&"))) ?? [];
        if (pass1Jobs.length > 0) console.log(`[discover-jobs] Fallback C (recent quality): ${pass1Jobs.length} jobs`);
      } catch (e) {
        console.warn("[discover-jobs] Fallback C error:", e instanceof Error ? e.message : e);
      }
    }

    // Combine: title matches first, then skill matches
    let jobs: any[] = [...pass1Jobs, ...pass2Jobs].slice(0, Math.min(limit, 200));

    // ── Enrich with AI fit scores ─────────────────────────────────────────────
    let matchingTriggered = false;

    if (userId && jobs.length > 0) {
      const jobIds = jobs.map((j: any) => j.id);

      try {
        const matches: any[] = await pgrest(
          "user_job_matches",
          `select=job_id,fit_score,matched_skills,skill_gaps,strengths,red_flags,match_summary,effort_level,response_prob,smart_tag,is_saved,is_ignored,is_applied` +
          `&user_id=eq.${userId}` +
          `&job_id=in.(${jobIds.join(",")})` +
          `&is_ignored=eq.false`
        );

        if (matches?.length) {
          const matchMap = new Map(matches.map((m: any) => [m.job_id, m]));

          jobs = jobs
            .filter((j: any) => {
              const m = matchMap.get(j.id);
              return !m?.is_ignored;
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

          // Apply minFitScore filter (only scored jobs)
          if (minFitScore && minFitScore > 0) {
            jobs = jobs.filter(
              (j: any) => j.fit_score === null || j.fit_score >= minFitScore
            );
          }

          // Re-sort: title-pass jobs (earlier in array) stay first,
          // within each group sort scored jobs by fit_score
          const pass1Set = new Set(pass1Jobs.map((j: any) => j.id));
          jobs.sort((a: any, b: any) => {
            const aIsTitle = pass1Set.has(a.id) ? 0 : 1;
            const bIsTitle = pass1Set.has(b.id) ? 0 : 1;
            if (aIsTitle !== bIsTitle) return aIsTitle - bIsTitle;
            if (a.fit_score === null && b.fit_score === null) return 0;
            if (a.fit_score === null) return 1;
            if (b.fit_score === null) return -1;
            return b.fit_score - a.fit_score;
          });
        }

        // Trigger background matching for unscored jobs
        const scoredIds = new Set(matches?.map((m: any) => m.job_id) ?? []);
        const unscoredCount = jobIds.filter((id: string) => !scoredIds.has(id)).length;
        if (triggerMatch && unscoredCount > 0 && token) {
          triggerBackgroundMatch(token, userId);
          matchingTriggered = true;
        }

      } catch (enrichErr) {
        console.warn("[discover-jobs] Enrichment skipped:", enrichErr instanceof Error ? enrichErr.message : enrichErr);
        if (triggerMatch && token) {
          triggerBackgroundMatch(token, userId);
          matchingTriggered = true;
        }
      }
    }

    return jsonRes({
      jobs,
      total: jobs.length,
      searchTerm: targetTitles[0] || searchTerm || "",
      matchingTriggered,
      source: "icareeros-native-v7",
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

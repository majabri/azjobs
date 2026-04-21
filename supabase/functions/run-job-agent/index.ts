import { corsHeaders } from "../_shared/cors.ts";
/**
 * run-job-agent — Per-user job search agent (Supabase Edge Function, Deno)
 *
 * Called by the frontend on:
 *   - App load / user login
 *   - Manual "Refresh" from Today's Matches
 *
 * Profile changes automatically mark the agent as 'pending' via a DB trigger
 * (trg_profile_update_agent on job_seeker_profiles), so the next call here
 * picks up fresh results automatically.
 *
 * What it does:
 *   1. Reads user_agent_instances state — decide: serve cache or run fresh
 *   2. If fresh run needed:
 *        a. Query scraped_jobs with multi-pass title + skill filters
 *        b. Score each job heuristically (fast, no AI cost)
 *        c. Upsert into user_job_matches (preserves existing Claude scores)
 *        d. Update agent state → idle, next_run_at = now + AGENT_TTL_HOURS
 *   3. Read top matches from user_job_matches joined with scraped_jobs view
 *   4. Return { jobs, agentStatus, fromCache }
 *
 * POST body: { forceRefresh?: boolean }
 * Auth: Bearer JWT required
 */

import {
  resolveTargetTitles,
  extractTitleKeyPhrases,
  scoreJobHeuristic,
  profileHash,
} from "../_shared/job-matching.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;

// Agent re-runs if last_run_at is older than this many hours
const AGENT_TTL_HOURS  = parseInt(Deno.env.get("AGENT_TTL_HOURS")  ?? "8",  10);
// Max jobs to discover per agent run
const AGENT_LIMIT      = parseInt(Deno.env.get("AGENT_LIMIT")       ?? "60", 10);
// Max matches to return to frontend
const RETURN_LIMIT     = parseInt(Deno.env.get("AGENT_RETURN_LIMIT") ?? "50", 10);
// Only look back this many days in scraped_jobs
const DAYS_OLD         = parseInt(Deno.env.get("AGENT_DAYS_OLD")    ?? "30", 10);

// ── PostgREST helper ──────────────────────────────────────────────────────────

async function pgrest(
  table: string,
  query: string,
  opts: { method?: string; body?: string; prefer?: string } = {}
): Promise<any> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer:        opts.prefer ?? "return=representation",
    },
    ...(opts.body ? { body: opts.body } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostgREST ${res.status} on ${table}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── scraped_jobs columns ──────────────────────────────────────────────────────

const SELECT_COLS = [
  "id","title","company","location","is_remote",
  "job_type","salary","description","job_url",
  "source","first_seen_at","quality_score",
  "is_flagged","flag_reasons","seniority",
].join(",");

// ── Job discovery ─────────────────────────────────────────────────────────────

async function discoverJobs(
  targetTitles: string[],
  skills: string[],
  location: string,
  isRemote: boolean,
  cutoff: string,
): Promise<any[]> {
  // Build base params
  const baseParams = [
    `select=${SELECT_COLS}`,
    `first_seen_at=gte.${cutoff}`,
    `is_flagged=eq.false`,   // skip known fake / low-quality jobs
    `order=quality_score.desc,first_seen_at.desc`,
    `limit=${AGENT_LIMIT}`,
  ];

  // Location filter (skip if blank or "remote")
  if (location && !/^\s*remote\s*$/i.test(location)) {
    baseParams.push(`location=ilike.*${encodeURIComponent(location)}*`);
  }
  if (isRemote) baseParams.push(`is_remote=eq.true`);

  // Expand titles with key-phrase extraction
  const titleTerms = [...new Set([
    ...targetTitles,
    ...targetTitles.flatMap(t => extractTitleKeyPhrases(t)),
  ])].slice(0, 25);

  let pass1: any[] = [];
  let pass2: any[] = [];

  // Pass 1 — title match
  if (titleTerms.length > 0) {
    const titleOr = titleTerms.slice(0, 20)
      .map(t => `title.ilike.*${encodeURIComponent(t)}*`)
      .join(",");
    try {
      pass1 = await pgrest("scraped_jobs", [...baseParams, `or=(${titleOr})`].join("&")) ?? [];
    } catch (e) {
      console.warn("[run-job-agent] Pass 1 error:", e instanceof Error ? e.message : e);
    }
  }

  // Pass 2 — description skill match (top 5 skills)
  const topSkills = skills.slice(0, 5).filter(s => s.length >= 3);
  if (topSkills.length > 0) {
    const seen1 = new Set((pass1 as any[]).map((j: any) => j.id));
    const skillOr = topSkills
      .map(s => `description.ilike.*${encodeURIComponent(s)}*`)
      .join(",");
    try {
      const raw = await pgrest("scraped_jobs", [...baseParams, `or=(${skillOr})`].join("&")) ?? [];
      pass2 = (raw as any[]).filter((j: any) => !seen1.has(j.id));
    } catch (e) {
      console.warn("[run-job-agent] Pass 2 error:", e instanceof Error ? e.message : e);
    }
  }

  // Fallback B — relax date window to 90 days if no results
  if (pass1.length === 0 && pass2.length === 0 && titleTerms.length > 0) {
    const looseCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const looseBase   = baseParams.map(p =>
      p.startsWith("first_seen_at=gte.") ? `first_seen_at=gte.${looseCutoff}` : p
    );
    const titleOr90 = titleTerms.slice(0, 20)
      .map(t => `title.ilike.*${encodeURIComponent(t)}*`)
      .join(",");
    try {
      pass1 = await pgrest("scraped_jobs", [...looseBase, `or=(${titleOr90})`].join("&")) ?? [];
    } catch (e) {
      console.warn("[run-job-agent] Fallback B error:", e instanceof Error ? e.message : e);
    }
  }

  // Fallback C — recent high-quality jobs, no text filter
  if (pass1.length === 0 && pass2.length === 0) {
    try {
      pass1 = await pgrest("scraped_jobs", [
        `select=${SELECT_COLS}`,
        `is_flagged=eq.false`,
        `order=quality_score.desc,first_seen_at.desc`,
        `limit=${Math.min(AGENT_LIMIT, 50)}`,
      ].join("&")) ?? [];
      console.log(`[run-job-agent] Fallback C: ${pass1.length} recent quality jobs`);
    } catch (e) {
      console.warn("[run-job-agent] Fallback C error:", e instanceof Error ? e.message : e);
    }
  }

  return [...pass1, ...pass2];
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    const userId = token ? await verifyToken(token) : null;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const forceRefresh: boolean = body.forceRefresh === true;

    // ── Load agent state ────────────────────────────────────────────────────
    let agentRows: any[] = [];
    try {
      agentRows = await pgrest(
        "user_agent_instances",
        `user_id=eq.${userId}&agent_type=eq.job_match&limit=1`,
      );
    } catch (_) {}

    const agent = agentRows?.[0] ?? null;

    // ── Decide: serve cache or run fresh ────────────────────────────────────
    const agentTtlMs    = AGENT_TTL_HOURS * 60 * 60 * 1000;
    const lastRunAt     = agent?.last_run_at ? new Date(agent.last_run_at).getTime() : 0;
    const isStale       = Date.now() - lastRunAt > agentTtlMs;
    const isPending     = !agent || agent.status === "pending";
    const isRunning     = agent?.status === "running";
    const needsFreshRun = forceRefresh || isPending || (isStale && agent?.status !== "running");

    if (!needsFreshRun || isRunning) {
      // Serve cached matches
      const cached = await readUserMatches(userId);
      return new Response(JSON.stringify({
        jobs:        cached,
        fromCache:   true,
        agentStatus: agent?.status ?? "idle",
        matchCount:  cached.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Load profile ────────────────────────────────────────────────────────
    let profileRows: any[] = [];
    try {
      profileRows = await pgrest(
        "job_seeker_profiles",
        `user_id=eq.${userId}&select=skills,target_job_titles,career_level,location,preferred_job_types,salary_min,salary_max&limit=1`,
      );
    } catch (_) {}

    const profile = profileRows?.[0] ?? null;
    if (!profile) {
      return new Response(JSON.stringify({
        jobs: [], fromCache: false, agentStatus: "idle", matchCount: 0,
        hint: "No profile found — complete your profile to get matches",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Mark agent as running ───────────────────────────────────────────────
    await pgrest("user_agent_instances",
      "on_conflict=user_id%2Cagent_type",
      {
        method: "POST",
        prefer: "return=minimal,resolution=merge-duplicates",
        body: JSON.stringify({
          user_id:    userId,
          agent_type: "job_match",
          status:     "running",
          updated_at: new Date().toISOString(),
        }),
      }
    ).catch(() => {});

    // ── Resolve target titles ───────────────────────────────────────────────
    const targetTitles = resolveTargetTitles(
      profile.target_job_titles ?? [],
      profile.career_level ?? "",
    );
    const skills       = (profile.skills ?? []).slice(0, 10);
    const location     = (profile.location && profile.location !== "<UNKNOWN>") ? profile.location : "";
    const isRemote     = (profile.preferred_job_types ?? []).some((t: string) => /remote/i.test(t));
    const cutoff       = new Date(Date.now() - DAYS_OLD * 86400000).toISOString();

    // ── Discover jobs ───────────────────────────────────────────────────────
    const discovered = await discoverJobs(targetTitles, skills, location, isRemote, cutoff);

    // ── Score & build upsert rows ───────────────────────────────────────────
    const now = new Date().toISOString();
    const matchRows = discovered.map((job: any) => {
      const { score, titleMatch, matchedSkills } = scoreJobHeuristic(
        job.title, job.description, targetTitles, skills
      );
      return {
        user_id:        userId,
        job_id:         job.id,
        fit_score:      score,
        matched_skills: matchedSkills,
        skill_gaps:     [],
        strengths:      titleMatch ? ["Title match"] : [],
        red_flags:      (job.is_flagged ? job.flag_reasons ?? [] : []),
        match_summary:  titleMatch
          ? `Matches your target title: ${job.title}`
          : matchedSkills.length > 0
            ? `Matches ${matchedSkills.length} of your skills`
            : "Recent quality posting",
        smart_tag:      titleMatch ? "title_match" : matchedSkills.length > 3 ? "skill_match" : "recent",
        is_seen:        false,
        is_saved:       false,
        is_ignored:     false,
        is_applied:     false,
        scored_at:      now,
        updated_at:     now,
      };
    });

    // Upsert matches — on conflict (user_id, job_id), only update if the
    // existing fit_score is still heuristic (≤90); preserve Claude scores (>90).
    if (matchRows.length > 0) {
      // Batch upsert in chunks of 50 to stay under PostgREST body limits
      for (let i = 0; i < matchRows.length; i += 50) {
        const chunk = matchRows.slice(i, i + 50);
        await pgrest("user_job_matches",
          "on_conflict=user_id%2Cjob_id",
          {
            method: "POST",
            prefer: "return=minimal,resolution=merge-duplicates",
            body: JSON.stringify(chunk),
          }
        ).catch((e: any) => console.warn("[run-job-agent] Upsert chunk error:", e.message));
      }
    }

    // ── Compute profile hash ────────────────────────────────────────────────
    const pHash = await profileHash(profile);

    // ── Mark agent as idle ──────────────────────────────────────────────────
    const nextRunAt = new Date(Date.now() + agentTtlMs).toISOString();
    await pgrest("user_agent_instances",
      "on_conflict=user_id%2Cagent_type",
      {
        method: "POST",
        prefer: "return=minimal,resolution=merge-duplicates",
        body: JSON.stringify({
          user_id:           userId,
          agent_type:        "job_match",
          status:            "idle",
          last_run_at:       now,
          next_run_at:       nextRunAt,
          last_profile_hash: pHash,
          match_count:       matchRows.length,
          run_count:         (agent?.run_count ?? 0) + 1,
          last_error:        null,
          updated_at:        now,
        }),
      }
    ).catch(() => {});

    // ── Return fresh matches ────────────────────────────────────────────────
    const jobs = await readUserMatches(userId);

    return new Response(JSON.stringify({
      jobs,
      fromCache:   false,
      agentStatus: "idle",
      matchCount:  jobs.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[run-job-agent] Error:", err);

    // Mark agent as idle with error so it retries next load
    const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    const userId = token ? await verifyToken(token).catch(() => null) : null;
    if (userId) {
      await pgrest("user_agent_instances",
        "on_conflict=user_id%2Cagent_type",
        {
          method: "POST",
          prefer: "return=minimal,resolution=merge-duplicates",
          body: JSON.stringify({
            user_id:    userId,
            agent_type: "job_match",
            status:     "pending",  // retry on next call
            last_error: err instanceof Error ? err.message : String(err),
            updated_at: new Date().toISOString(),
          }),
        }
      ).catch(() => {});
    }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Read user matches (joined with job data) ──────────────────────────────────

async function readUserMatches(userId: string): Promise<any[]> {
  // Step 1: get top match job_ids + scores from user_job_matches
  let matches: any[] = [];
  try {
    matches = await pgrest(
      "user_job_matches",
      [
        `user_id=eq.${userId}`,
        `is_ignored=eq.false`,
        `select=job_id,fit_score,matched_skills,match_summary,smart_tag,strengths,red_flags,scored_at`,
        `order=fit_score.desc`,
        `limit=${RETURN_LIMIT}`,
      ].join("&")
    ) ?? [];
  } catch (e) {
    console.warn("[run-job-agent] readUserMatches error:", e instanceof Error ? e.message : e);
    return [];
  }

  if (matches.length === 0) return [];

  // Step 2: fetch job data for those IDs from scraped_jobs view
  const ids = matches.map((m: any) => m.job_id).join(",");
  let jobRows: any[] = [];
  try {
    jobRows = await pgrest(
      "scraped_jobs",
      `id=in.(${ids})&select=${SELECT_COLS}`
    ) ?? [];
  } catch (e) {
    console.warn("[run-job-agent] jobRows fetch error:", e instanceof Error ? e.message : e);
  }

  // Step 3: merge match data onto job rows
  const jobMap = new Map(jobRows.map((j: any) => [j.id, j]));
  return matches
    .map((m: any) => {
      const job = jobMap.get(m.job_id);
      if (!job) return null;
      return {
        ...job,
        fit_score:     m.fit_score,
        matchedSkills: m.matched_skills ?? [],
        matchSummary:  m.match_summary ?? "",
        smartTag:      m.smart_tag ?? "",
        matchScore:    m.fit_score,    // alias for client-side enrichJobs compat
        matchReason:   (job.title ?? "") + " " + (job.description ?? ""),
      };
    })
    .filter(Boolean);
}

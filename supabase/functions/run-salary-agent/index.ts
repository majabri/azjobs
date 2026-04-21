/**
 * run-salary-agent — Salary benchmarking agent (Supabase Edge Function, Deno)
 *
 * Triggered by useAgentWakeup on login when the salary_monitor instance is
 * pending or past next_run_at (default: weekly).
 *
 * What it does:
 *   1. Reads user profile (target_job_titles, career_level, location, salary range)
 *   2. Queries scraped_jobs to aggregate market_rate data for matching titles
 *   3. Computes percentiles (p25/p50/p75) and where the user's range falls
 *   4. Writes a snapshot to user_salary_snapshots
 *   5. Updates user_agent_instances: status='idle', next_run_at=now+7d
 *
 * POST body: {} (no params — reads from user profile)
 * Auth: Bearer JWT required
 */

import { AGENT_SCHEDULE_HOURS } from "../_shared/agent-registry.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

const TTL_HOURS = AGENT_SCHEDULE_HOURS["salary_monitor"];

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
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer:         opts.prefer ?? "return=representation",
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

// ── Salary percentile computation ─────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function userPercentile(sorted: number[], userMid: number): number {
  if (sorted.length === 0) return 50;
  const below = sorted.filter(v => v <= userMid).length;
  return Math.round((below / sorted.length) * 100);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const token  = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    const userId = token ? await verifyToken(token) : null;
    if (!userId) return respond({ error: "Unauthorized" }, 401);

    const now = new Date().toISOString();

    // ── Load agent state ────────────────────────────────────────────────────
    let agentRows: any[] = [];
    try {
      agentRows = await pgrest(
        "user_agent_instances",
        `user_id=eq.${userId}&agent_type=eq.salary_monitor&limit=1`,
      );
    } catch (_) {}

    const agent = agentRows?.[0] ?? null;

    // Serve cache if agent ran recently
    const ttlMs      = TTL_HOURS * 60 * 60 * 1000;
    const lastRunAt  = agent?.last_run_at ? new Date(agent.last_run_at).getTime() : 0;
    const isStale    = Date.now() - lastRunAt > ttlMs;
    const isPending  = !agent || agent.status === "pending";

    if (!isPending && !isStale && agent?.status !== "running") {
      // Return latest snapshot from DB
      let snapshots: any[] = [];
      try {
        snapshots = await pgrest(
          "user_salary_snapshots",
          `user_id=eq.${userId}&order=agent_run_at.desc&limit=1`,
        );
      } catch (_) {}
      return respond({ snapshot: snapshots?.[0] ?? null, fromCache: true });
    }

    // ── Mark running ────────────────────────────────────────────────────────
    await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: JSON.stringify({
        user_id: userId, agent_type: "salary_monitor",
        status: "running", updated_at: now,
      }),
    }).catch(() => {});

    // ── Load profile ────────────────────────────────────────────────────────
    let profileRows: any[] = [];
    try {
      profileRows = await pgrest(
        "job_seeker_profiles",
        `user_id=eq.${userId}&select=target_job_titles,career_level,location,salary_min,salary_max&limit=1`,
      );
    } catch (_) {}

    const profile = profileRows?.[0] ?? null;
    if (!profile) {
      return respond({ snapshot: null, hint: "Complete your profile to get salary benchmarks" });
    }

    const titles: string[] = profile.target_job_titles?.length
      ? profile.target_job_titles
      : [];
    const location: string = profile.location ?? "";
    const userMin: number  = profile.salary_min ?? 0;
    const userMax: number  = profile.salary_max ?? 0;

    // ── Query scraped_jobs for market rate data ──────────────────────────────
    let jobs: any[] = [];
    if (titles.length > 0) {
      const titleOr = titles.slice(0, 10)
        .map(t => `title.ilike.*${encodeURIComponent(t)}*`)
        .join(",");
      try {
        const params = [
          `select=title,company,location,salary,market_rate`,
          `or=(${titleOr})`,
          `is_flagged=eq.false`,
          `market_rate=not.is.null`,
          `order=first_seen_at.desc`,
          `limit=200`,
        ];
        jobs = await pgrest("scraped_jobs", params.join("&")) ?? [];
      } catch (e) {
        console.warn("[run-salary-agent] jobs query error:", e);
      }
    }

    // ── Compute percentiles ──────────────────────────────────────────────────
    const rates: number[] = jobs
      .map((j: any) => parseFloat(j.market_rate))
      .filter((v: number) => !isNaN(v) && v > 0)
      .sort((a: number, b: number) => a - b);

    const p25  = percentile(rates, 25);
    const p50  = percentile(rates, 50);
    const p75  = percentile(rates, 75);
    const userMid = userMin && userMax ? (userMin + userMax) / 2 : userMin || userMax;
    const userPct = userMid ? userPercentile(rates, userMid) : null;

    // Compute trend vs previous snapshot
    let trend: "rising" | "flat" | "falling" | "unknown" = "unknown";
    try {
      const prev = await pgrest(
        "user_salary_snapshots",
        `user_id=eq.${userId}&order=agent_run_at.desc&limit=1`,
      );
      const prevP50 = prev?.[0]?.market_p50;
      if (prevP50 && p50) {
        const delta = (p50 - prevP50) / prevP50;
        trend = delta > 0.02 ? "rising" : delta < -0.02 ? "falling" : "flat";
      }
    } catch (_) {}

    // Top paying companies
    const companySalaries: Record<string, number[]> = {};
    for (const j of jobs) {
      const mr = parseFloat(j.market_rate);
      if (!isNaN(mr) && mr > 0 && j.company) {
        if (!companySalaries[j.company]) companySalaries[j.company] = [];
        companySalaries[j.company].push(mr);
      }
    }
    const topCompanies = Object.entries(companySalaries)
      .map(([name, vals]) => ({
        name,
        avg_rate: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      }))
      .sort((a, b) => b.avg_rate - a.avg_rate)
      .slice(0, 10);

    // ── Write snapshot ───────────────────────────────────────────────────────
    const snapshot = {
      user_id:      userId,
      agent_run_at: now,
      title:        titles[0] ?? null,
      location:     location || null,
      market_p25:   p25 || null,
      market_p50:   p50 || null,
      market_p75:   p75 || null,
      your_min:     userMin || null,
      your_max:     userMax || null,
      percentile:   userPct,
      trend,
      sample_size:  rates.length,
      raw_data:     { top_companies: topCompanies, titles_sampled: titles.slice(0, 5) },
    };

    try {
      await pgrest("user_salary_snapshots", "", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(snapshot),
      });
    } catch (e) {
      console.warn("[run-salary-agent] snapshot write error:", e);
    }

    // ── Mark idle ────────────────────────────────────────────────────────────
    const nextRunAt = new Date(Date.now() + ttlMs).toISOString();
    await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: JSON.stringify({
        user_id: userId, agent_type: "salary_monitor",
        status: "idle", last_run_at: now,
        next_run_at: nextRunAt, run_count: (agent?.run_count ?? 0) + 1,
        last_error: null, updated_at: now,
      }),
    }).catch(() => {});

    return respond({ snapshot, fromCache: false });

  } catch (err) {
    console.error("[run-salary-agent] Error:", err);
    // Mark pending so it retries
    const token  = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    const userId = token ? await verifyToken(token).catch(() => null) : null;
    if (userId) {
      await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
        method: "POST",
        prefer: "return=minimal,resolution=merge-duplicates",
        body: JSON.stringify({
          user_id: userId, agent_type: "salary_monitor",
          status: "pending",
          last_error: err instanceof Error ? err.message : String(err),
          updated_at: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

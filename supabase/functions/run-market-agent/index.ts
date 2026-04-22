/**
 * run-market-agent — Job market intelligence agent (Supabase Edge Function, Deno)
 *
 * Triggered by useAgentWakeup on login when the market_intel instance is
 * pending or past next_run_at (default: monthly).
 *
 * What it does:
 *   1. Reads user profile (target_job_titles, career_level, location)
 *   2. Aggregates scraped_jobs to compute:
 *        - Top hiring companies (by open role count)
 *        - Trending skills (most frequent in descriptions)
 *        - Remote ratio (% of remote postings)
 *        - Demand by city
 *   3. Writes a snapshot to user_market_intel
 *   4. Updates user_agent_instances: status='idle', next_run_at=now+30d
 *
 * POST body: {} (no params — reads from user profile)
 * Auth: Bearer JWT required
 */

import { AGENT_SCHEDULE_HOURS } from "../_shared/agent-registry.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TTL_HOURS = AGENT_SCHEDULE_HOURS["market_intel"];

// ── PostgREST helper ──────────────────────────────────────────────────────────

async function pgrest(
  table: string,
  query: string,
  opts: { method?: string; body?: string; prefer?: string } = {},
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
    throw new Error(
      `PostgREST ${res.status} on ${table}: ${text.slice(0, 300)}`,
    );
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
  } catch {
    return null;
  }
}

// ── Skill extraction ──────────────────────────────────────────────────────────

// Common tech/domain skills to look for in job descriptions
const SKILL_PATTERNS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "SQL",
  "AWS",
  "Azure",
  "GCP",
  "Kubernetes",
  "Docker",
  "Terraform",
  "CI/CD",
  "REST API",
  "GraphQL",
  "Machine Learning",
  "Data Science",
  "Cybersecurity",
  "Zero Trust",
  "SIEM",
  "SOAR",
  "Cloud Security",
  "Product Management",
  "Agile",
  "Scrum",
  "Salesforce",
  "HubSpot",
  "Excel",
  "Tableau",
  "Leadership",
  "Communication",
  "Strategic Planning",
  "P&L",
  "Revenue",
  "Go-to-Market",
  "Compliance",
  "GDPR",
  "SOC 2",
  "ISO 27001",
  "Risk Management",
  "Audit",
  "Java",
  "Go",
  "Rust",
  "C++",
  "Swift",
  "Kotlin",
  ".NET",
  "PHP",
  "Ruby",
];

function countSkills(
  descriptions: string[],
): { skill: string; count: number }[] {
  const counts: Record<string, number> = {};
  const combined = descriptions.join(" ").toLowerCase();
  for (const skill of SKILL_PATTERNS) {
    const re = new RegExp(
      `\\b${skill.toLowerCase().replace(".", "\\.")}\\b`,
      "g",
    );
    const matches = combined.match(re);
    if (matches?.length) counts[skill] = matches.length;
  }
  return Object.entries(counts)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const token =
      req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    const userId = token ? await verifyToken(token) : null;
    if (!userId) return respond({ error: "Unauthorized" }, 401);

    const now = new Date().toISOString();

    // ── Load agent state ────────────────────────────────────────────────────
    let agentRows: any[] = [];
    try {
      agentRows = await pgrest(
        "user_agent_instances",
        `user_id=eq.${userId}&agent_type=eq.market_intel&limit=1`,
      );
    } catch (_) {}

    const agent = agentRows?.[0] ?? null;

    // Serve cache if fresh
    const ttlMs = TTL_HOURS * 60 * 60 * 1000;
    const lastRunAt = agent?.last_run_at
      ? new Date(agent.last_run_at).getTime()
      : 0;
    const isStale = Date.now() - lastRunAt > ttlMs;
    const isPending = !agent || agent.status === "pending";

    if (!isPending && !isStale && agent?.status !== "running") {
      let snapshots: any[] = [];
      try {
        snapshots = await pgrest(
          "user_market_intel",
          `user_id=eq.${userId}&order=agent_run_at.desc&limit=1`,
        );
      } catch (_) {}
      return respond({ intel: snapshots?.[0] ?? null, fromCache: true });
    }

    // ── Mark running ────────────────────────────────────────────────────────
    await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: JSON.stringify({
        user_id: userId,
        agent_type: "market_intel",
        status: "running",
        updated_at: now,
      }),
    }).catch(() => {});

    // ── Load profile ────────────────────────────────────────────────────────
    let profileRows: any[] = [];
    try {
      profileRows = await pgrest(
        "job_seeker_profiles",
        `user_id=eq.${userId}&select=target_job_titles,career_level,location&limit=1`,
      );
    } catch (_) {}

    const profile = profileRows?.[0] ?? null;
    const titles = profile?.target_job_titles ?? [];

    // ── Query scraped_jobs ───────────────────────────────────────────────────
    let jobs: any[] = [];
    try {
      const params: string[] = [
        `select=title,company,location,is_remote,description`,
        `is_flagged=eq.false`,
        `order=first_seen_at.desc`,
        `limit=500`,
      ];
      if (titles.length > 0) {
        const titleOr = titles
          .slice(0, 10)
          .map((t: string) => `title.ilike.*${encodeURIComponent(t)}*`)
          .join(",");
        params.push(`or=(${titleOr})`);
      }
      jobs = (await pgrest("scraped_jobs", params.join("&"))) ?? [];
    } catch (e) {
      console.warn("[run-market-agent] jobs query error:", e);
    }

    // ── Aggregate data ───────────────────────────────────────────────────────

    // Top hiring companies
    const companyCounts: Record<string, number> = {};
    for (const j of jobs) {
      if (j.company)
        companyCounts[j.company] = (companyCounts[j.company] ?? 0) + 1;
    }
    const hotCompanies = Object.entries(companyCounts)
      .map(([name, open_roles]) => ({ name, open_roles }))
      .sort((a, b) => b.open_roles - a.open_roles)
      .slice(0, 15);

    // Remote ratio
    const remoteCount = jobs.filter((j: any) => j.is_remote).length;
    const remoteRatio = jobs.length > 0 ? remoteCount / jobs.length : 0;

    // Demand by city
    const cityCounts: Record<string, number> = {};
    for (const j of jobs) {
      if (j.location && !/remote/i.test(j.location)) {
        // Normalise: take first part before comma
        const city = (j.location.split(",")[0] ?? j.location).trim();
        if (city) cityCounts[city] = (cityCounts[city] ?? 0) + 1;
      }
    }
    const demandByCity = Object.entries(cityCounts)
      .map(([city, job_count]) => ({ city, job_count }))
      .sort((a, b) => b.job_count - a.job_count)
      .slice(0, 10);

    // Trending skills
    const descriptions = jobs
      .map((j: any) => j.description ?? "")
      .filter(Boolean);
    const trendingSkills = countSkills(descriptions);

    // ── Write intel snapshot ─────────────────────────────────────────────────
    const intel = {
      user_id: userId,
      agent_run_at: now,
      hot_companies: hotCompanies,
      trending_skills: trendingSkills,
      remote_ratio: Math.round(remoteRatio * 100) / 100,
      demand_by_city: demandByCity,
      total_listings: jobs.length,
    };

    try {
      await pgrest("user_market_intel", "", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(intel),
      });
    } catch (e) {
      console.warn("[run-market-agent] intel write error:", e);
    }

    // ── Mark idle ────────────────────────────────────────────────────────────
    const nextRunAt = new Date(Date.now() + ttlMs).toISOString();
    await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: JSON.stringify({
        user_id: userId,
        agent_type: "market_intel",
        status: "idle",
        last_run_at: now,
        next_run_at: nextRunAt,
        run_count: (agent?.run_count ?? 0) + 1,
        last_error: null,
        updated_at: now,
      }),
    }).catch(() => {});

    return respond({ intel, fromCache: false });
  } catch (err) {
    console.error("[run-market-agent] Error:", err);
    const token =
      req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    const userId = token ? await verifyToken(token).catch(() => null) : null;
    if (userId) {
      await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
        method: "POST",
        prefer: "return=minimal,resolution=merge-duplicates",
        body: JSON.stringify({
          user_id: userId,
          agent_type: "market_intel",
          status: "pending",
          last_error: err instanceof Error ? err.message : String(err),
          updated_at: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

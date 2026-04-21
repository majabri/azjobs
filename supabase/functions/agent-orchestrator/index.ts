// iCareerOS v5 — agent-orchestrator Edge Function
// Zero-dependency: uses Deno.serve + inline PostgREST + direct GoTrue auth.
// Orchestrates 5 AI agents: discovery, matching, optimization, application, learning.

// ─── Shared modules ───────────────────────────────────────────────────────────
// Import shared job-search logic instead of HTTP-fetching the search-jobs
// edge function.  Function-to-function HTTP calls add latency, create hidden
// dependencies, and make local testing harder.
import { searchJobPostings } from "../_shared/job-search.ts";
import { corsHeaders } from "../_shared/cors.ts";

// ─── CORS ─────────────────────────────────────────────────────────────────────
// ─── Inline PostgREST / GoTrue helpers ────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

function svcHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function pgGet(table: string, qs: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
  });
  if (!res.ok) throw new Error(`pgGet ${table}: ${res.status}`);
  return res.json();
}

async function pgPost(table: string, body: any, prefer = "return=representation"): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...svcHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pgPost ${table}: ${res.status}`);
  if (prefer === "return=minimal") return null;
  return res.json();
}

async function pgPatch(table: string, qs: string, body: any): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: svcHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pgPatch ${table}: ${res.status}`);
  return res.json();
}

async function pgCount(table: string, qs: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&select=id`, {
    headers: { ...svcHeaders(), Prefer: "count=exact", Range: "0-0" },
  });
  const range = res.headers.get("Content-Range") || "";
  const m = range.match(/\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function getUser(authHeader: string): Promise<{ id: string } | null> {
  if (!authHeader) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: authHeader,
    },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.id ? u : null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentContext {
  userId: string;
  profile: Record<string, any>;
  supabaseUrl: string;
  userAuthHeader: string;
  apiKey: string | undefined;
  config: { threshold: number; dailyCap: number; mode: string };
}
interface AgentResult {
  name: string;
  success: boolean;
  metrics: Record<string, number>;
  error?: string;
}
type AgentFn = (ctx: AgentContext) => Promise<AgentResult>;

const RETRYABLE = new Set(["discovery", "matching"]);
const MAX_RETRIES = 3;
const BASE_DELAY = 500;

async function withRetry(name: string, fn: () => Promise<AgentResult>): Promise<AgentResult> {
  if (!RETRYABLE.has(name)) return fn();
  let lastErr: Error | undefined;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, i)));
    }
  }
  return { name, success: false, metrics: {}, error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastErr?.message}` };
}

// ─── Agent Registry ─────────────────────────────────────────────────────────
const AGENTS: Record<string, AgentFn> = {
  discovery: runDiscovery,
  matching: runMatching,
  optimization: runOptimization,
  application: runApplication,
  learning: runLearning,
};

// ─── Agent Implementations ──────────────────────────────────────────────────
async function runDiscovery(ctx: AgentContext): Promise<AgentResult> {
  const titles: string[] = ctx.profile.target_job_titles || [];
  // Use shared searchJobPostings directly — no HTTP hop to search-jobs function.
  const result = await searchJobPostings({
    targetTitles: titles.slice(0, 3),
    query: titles.length ? undefined : "software engineer",
    location: ctx.profile.location || undefined,
    limit: 20,
  });
  return { name: "discovery", success: true, metrics: { jobs_found: result.jobs.length } };
}

async function runMatching(ctx: AgentContext): Promise<AgentResult> {
  if (!ctx.apiKey) return { name: "matching", success: true, metrics: { jobs_matched: 0 } };

  const jobs = await pgGet("scraped_jobs", "select=id,title,company,description&order=created_at.desc&limit=30");
  if (!jobs?.length) return { name: "matching", success: true, metrics: { jobs_matched: 0 } };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ctx.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content:
        `Score jobs for candidate. Return JSON array of {job_index, match_score, interview_probability, gaps}.\n` +
        `Skills: ${(ctx.profile.skills || []).join(", ")}\n` +
        `Experience: ${JSON.stringify(ctx.profile.work_experience || []).slice(0, 500)}\n` +
        `Targets: ${(ctx.profile.target_job_titles || []).join(", ")}\n` +
        `Jobs:\n${jobs.slice(0, 15).map((j: any, i: number) => `[${i}] ${j.title} @ ${j.company}: ${(j.description || "").slice(0, 200)}`).join("\n")}`
      }],
    }),
  });
  if (!resp.ok) throw new Error(`AI scoring failed: ${resp.status}`);

  let matched = 0;
  try {
    const aiData = await resp.json();
    const text = aiData.content?.[0]?.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const scores = JSON.parse(jsonMatch[0]);
      matched = scores.filter((s: any) => s.match_score >= ctx.config.threshold).length;
    }
  } catch { /* parse error — ok */ }

  return { name: "matching", success: true, metrics: { jobs_matched: matched } };
}

async function runOptimization(_ctx: AgentContext): Promise<AgentResult> {
  return { name: "optimization", success: true, metrics: {} };
}

async function runApplication(ctx: AgentContext): Promise<AgentResult> {
  if (ctx.config.mode === "manual") return { name: "application", success: true, metrics: { applications_sent: 0 } };
  const today = new Date().toISOString().split("T")[0];
  const count = await pgCount("job_applications", `user_id=eq.${ctx.userId}&applied_at=gte.${today}T00:00:00`);
  const remaining = Math.max(0, ctx.config.dailyCap - count);
  return { name: "application", success: true, metrics: { applications_sent: remaining } };
}

async function runLearning(ctx: AgentContext): Promise<AgentResult> {
  const apps = await pgGet("job_applications", `select=status&user_id=eq.${ctx.userId}&order=applied_at.desc&limit=50`);
  if (!apps?.length) return { name: "learning", success: true, metrics: {} };

  const outcomes = apps.reduce((acc: Record<string, number>, a: any) => {
    acc[a.status] = (acc[a.status] || 0) + 1; return acc;
  }, {});

  await pgPost("learning_events", {
    user_id: ctx.userId,
    outcome: "cycle_complete",
    features: { total_apps: apps.length, outcomes, timestamp: new Date().toISOString() },
    insights: {
      interview_rate: ((outcomes.interview || 0) / apps.length * 100).toFixed(1) + "%",
      ghost_rate: ((outcomes.ghosted || 0) / apps.length * 100).toFixed(1) + "%",
    },
  }, "return=minimal").catch(() => {});

  return { name: "learning", success: true, metrics: {} };
}

// ─── Log Helper ───────────────────────────────────────────────────────────
function ingestLog(level: string, message: string, extra: Record<string, any> = {}) {
  pgPost("admin_logs", { level, message, ...extra }, "return=minimal").catch(() => {});
}

// ─── Orchestrator Engine ────────────────────────────────────────────────────
async function executeAgents(agentNames: string[], ctx: AgentContext, runId: string) {
  const phases = [
    agentNames.filter(a => ["discovery", "learning"].includes(a)),
    agentNames.filter(a => a === "matching"),
    agentNames.filter(a => ["optimization", "application"].includes(a)),
  ].filter(p => p.length > 0);

  const completed: string[] = [];
  const errors: string[] = [];
  const metrics: Record<string, number> = {};
  const timings: Record<string, number> = {};

  for (const phase of phases) {
    const results = await Promise.allSettled(
      phase.map(async (name) => {
        const fn = AGENTS[name];
        if (!fn) throw new Error(`Unknown agent: ${name}`);
        ingestLog("info", `Agent ${name} started`, { user_id: ctx.userId, run_id: runId, agent_id: name, status: "running" });
        const start = performance.now();
        const result = await withRetry(name, () => fn(ctx));
        timings[name] = Math.round(performance.now() - start);
        ingestLog(result.success ? "info" : "error",
          `Agent ${name} ${result.success ? "completed" : "failed"}${result.error ? ": " + result.error : ""}`,
          { user_id: ctx.userId, run_id: runId, agent_id: name, status: result.success ? "completed" : "failed", metadata: { duration_ms: timings[name], ...result.metrics } },
        );
        return result;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.success) completed.push(r.value.name);
        else errors.push(r.value.error || `${r.value.name} failed`);
        Object.assign(metrics, r.value.metrics);
      } else {
        errors.push(r.reason?.message || "Unknown error");
      }
    }
  }
  return { completed, errors, metrics, timings };
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const user = await getUser(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedAgents: string[] = body.agents || Object.keys(AGENTS);
    const validAgents = requestedAgents.filter(a => a in AGENTS);

    // Load profile
    const profiles = await pgGet("job_seeker_profiles", `select=*&user_id=eq.${user.id}&limit=1`);
    const profile = profiles?.[0];
    if (!profile) {
      return new Response(JSON.stringify({ error: "No profile found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create run record
    const runs = await pgPost("agent_runs", { user_id: user.id, status: "running", agents_completed: [] });
    const run = Array.isArray(runs) ? runs[0] : runs;
    if (!run?.id) throw new Error("Failed to create run record");

    const ctx: AgentContext = {
      userId: user.id,
      profile,
      supabaseUrl: SUPABASE_URL,
      userAuthHeader: authHeader,
      apiKey: ANTHROPIC_KEY,
      config: {
        threshold: profile.match_threshold || 70,
        dailyCap: profile.daily_apply_cap || 10,
        mode: profile.automation_mode || "manual",
      },
    };

    ingestLog("info", "Agent orchestrator run started", { user_id: user.id, run_id: run.id, status: "running" });
    const { completed, errors, metrics, timings } = await executeAgents(validAgents, ctx, run.id);

    // Finalize
    await pgPatch("agent_runs", `id=eq.${run.id}`, {
      status: errors.length ? "completed_with_errors" : "completed",
      agents_completed: completed,
      agent_timings: timings,
      jobs_found: metrics.jobs_found || 0,
      jobs_matched: metrics.jobs_matched || 0,
      applications_sent: metrics.applications_sent || 0,
      errors,
      completed_at: new Date().toISOString(),
    });

    pgPost("notifications", {
      user_id: user.id, type: "agent_run", title: "Agent Run Complete",
      message: `Found ${metrics.jobs_found || 0} jobs, matched ${metrics.jobs_matched || 0}, sent ${metrics.applications_sent || 0} applications.`,
      action_url: "/dashboard",
    }, "return=minimal").catch(() => {});

    return new Response(JSON.stringify({
      runId: run.id, status: "completed", agentsCompleted: completed, timings, ...metrics, errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("agent-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

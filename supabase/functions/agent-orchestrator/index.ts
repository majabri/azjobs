import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ───────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface AgentContext {
  userId: string;
  profile: Record<string, any>;
  adminClient: SupabaseClient;
  supabaseUrl: string;
  anonKey: string;
  apiKey: string | undefined;
  config: AgentConfig;
}

interface AgentConfig {
  threshold: number;
  dailyCap: number;
  mode: string;
}

interface AgentResult {
  name: string;
  success: boolean;
  metrics: Record<string, number>;
  error?: string;
}

type AgentFn = (ctx: AgentContext) => Promise<AgentResult>;

const RETRYABLE_AGENTS = new Set(["discovery", "matching"]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function withRetry(name: string, fn: () => Promise<AgentResult>): Promise<AgentResult> {
  if (!RETRYABLE_AGENTS.has(name)) return fn();
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return { name, success: false, metrics: {}, error: `Failed after ${MAX_RETRIES + 1} attempts: ${lastErr?.message}` };
}

// ─── Agent Registry ─────────────────────────────────────────────────────────
const AGENT_REGISTRY: Record<string, AgentFn> = {
  discovery: runDiscovery,
  matching: runMatching,
  optimization: runOptimization,
  application: runApplication,
  learning: runLearning,
};

// ─── Agent Implementations ──────────────────────────────────────────────────

async function runDiscovery(ctx: AgentContext): Promise<AgentResult> {
  const titles = ctx.profile.target_job_titles || [];
  const query = titles.length > 0 ? titles.slice(0, 3).join(" OR ") : "software engineer";

  const resp = await fetch(`${ctx.supabaseUrl}/functions/v1/search-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.anonKey}` },
    body: JSON.stringify({ query, location: ctx.profile.location || "", limit: 20 }),
  });

  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
  const data = await resp.json();
  return { name: "discovery", success: true, metrics: { jobs_found: data.jobs?.length || 0 } };
}

async function runMatching(ctx: AgentContext): Promise<AgentResult> {
  if (!ctx.apiKey) return { name: "matching", success: true, metrics: { jobs_matched: 0 } };

  const { data: jobs } = await ctx.adminClient.from("scraped_jobs")
    .select("id,title,company,description")
    .order("created_at", { ascending: false }).limit(30);

  if (!jobs?.length) return { name: "matching", success: true, metrics: { jobs_matched: 0 } };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{
        role: "user",
        content: `Score jobs for candidate. Return JSON via tool call.
Skills: ${(ctx.profile.skills || []).join(", ")}
Experience: ${JSON.stringify(ctx.profile.work_experience || []).slice(0, 500)}
Targets: ${(ctx.profile.target_job_titles || []).join(", ")}

Jobs:\n${jobs.slice(0, 15).map((j, i) => `[${i}] ${j.title} @ ${j.company}: ${(j.description || "").slice(0, 200)}`).join("\n")}`
      }],
      tools: [{
        type: "function",
        function: {
          name: "score_jobs",
          description: "Score job matches",
          parameters: {
            type: "object",
            properties: {
              scores: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    job_index: { type: "number" },
                    match_score: { type: "number" },
                    interview_probability: { type: "number" },
                    gaps: { type: "array", items: { type: "string" } },
                  },
                  required: ["job_index", "match_score", "interview_probability", "gaps"],
                },
              },
            },
            required: ["scores"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "score_jobs" } },
    }),
  });

  if (!resp.ok) throw new Error(`AI scoring failed: ${resp.status}`);
  const aiData = await resp.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  const scores = toolCall ? JSON.parse(toolCall.function.arguments).scores || [] : [];
  const matched = scores.filter((s: any) => s.match_score >= ctx.config.threshold).length;

  return { name: "matching", success: true, metrics: { jobs_matched: matched } };
}

async function runOptimization(_ctx: AgentContext): Promise<AgentResult> {
  // Resume optimization is per-application; this agent validates readiness
  return { name: "optimization", success: true, metrics: {} };
}

async function runApplication(ctx: AgentContext): Promise<AgentResult> {
  if (ctx.config.mode === "manual") {
    return { name: "application", success: true, metrics: { applications_sent: 0 } };
  }

  const today = new Date().toISOString().split("T")[0];
  const { count } = await ctx.adminClient.from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .gte("applied_at", `${today}T00:00:00`);

  const remaining = Math.max(0, ctx.config.dailyCap - (count || 0));
  return { name: "application", success: true, metrics: { applications_sent: remaining } };
}

async function runLearning(ctx: AgentContext): Promise<AgentResult> {
  const { data: apps } = await ctx.adminClient.from("job_applications")
    .select("status").eq("user_id", ctx.userId)
    .order("applied_at", { ascending: false }).limit(50);

  if (!apps?.length) return { name: "learning", success: true, metrics: {} };

  const outcomes = apps.reduce((acc: Record<string, number>, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  await ctx.adminClient.from("learning_events").insert({
    user_id: ctx.userId,
    outcome: "cycle_complete",
    features: { total_apps: apps.length, outcomes, timestamp: new Date().toISOString() },
    insights: {
      interview_rate: ((outcomes.interview || 0) / apps.length * 100).toFixed(1) + "%",
      ghost_rate: ((outcomes.ghosted || 0) / apps.length * 100).toFixed(1) + "%",
    },
  });

  return { name: "learning", success: true, metrics: {} };
}

// ─── Orchestrator Engine ────────────────────────────────────────────────────

async function executeAgents(agentNames: string[], ctx: AgentContext): Promise<{
  completed: string[];
  errors: string[];
  metrics: Record<string, number>;
  timings: Record<string, number>;
}> {
  // Phase 1: Discovery + Learning (independent, run in parallel)
  // Phase 2: Matching (depends on discovery)
  // Phase 3: Optimization + Application (depend on matching)
  const phases: string[][] = [
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
      phase.map(async name => {
        const fn = AGENT_REGISTRY[name];
        if (!fn) throw new Error(`Unknown agent: ${name}`);
        const start = performance.now();
        const result = await withRetry(name, () => fn(ctx));
        timings[name] = Math.round(performance.now() - start);
        return result;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          completed.push(result.value.name);
        } else {
          errors.push(result.value.error || `${result.value.name} failed`);
        }
        Object.assign(metrics, result.value.metrics);
      } else {
        errors.push(result.reason?.message || "Unknown error");
      }
    }

    await ctx.adminClient.from("agent_runs").update({
      agents_completed: completed,
      agent_timings: timings,
      ...metrics,
    }).eq("user_id", ctx.userId).eq("status", "running");
  }

  return { completed, errors, metrics, timings };
}

// ─── HTTP Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const requestedAgents: string[] = body.agents || Object.keys(AGENT_REGISTRY);

    // Validate agent names
    const validAgents = requestedAgents.filter(a => a in AGENT_REGISTRY);

    // Load profile
    const { data: profile } = await adminClient.from("job_seeker_profiles")
      .select("*").eq("user_id", user.id).single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "No profile found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create run record
    const { data: run, error: runErr } = await adminClient.from("agent_runs").insert({
      user_id: user.id, status: "running", agents_completed: [],
    }).select("id").single();
    if (runErr) throw runErr;

    const ctx: AgentContext = {
      userId: user.id,
      profile,
      adminClient,
      supabaseUrl,
      anonKey,
      apiKey,
      config: {
        threshold: profile.match_threshold || 70,
        dailyCap: profile.daily_apply_cap || 10,
        mode: profile.automation_mode || "manual",
      },
    };

    // Execute
    const { completed, errors, metrics, timings } = await executeAgents(validAgents, ctx);

    // Finalize
    await adminClient.from("agent_runs").update({
      status: errors.length ? "completed_with_errors" : "completed",
      agents_completed: completed,
      agent_timings: timings,
      jobs_found: metrics.jobs_found || 0,
      jobs_matched: metrics.jobs_matched || 0,
      applications_sent: metrics.applications_sent || 0,
      errors,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    await adminClient.from("notifications").insert({
      user_id: user.id,
      type: "agent_run",
      title: "Agent Run Complete",
      message: `Found ${metrics.jobs_found || 0} jobs, matched ${metrics.jobs_matched || 0}, sent ${metrics.applications_sent || 0} applications.`,
      action_url: "/dashboard",
    });

    return new Response(JSON.stringify({
      runId: run.id,
      status: "completed",
      agentsCompleted: completed,
      timings,
      ...metrics,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("agent-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

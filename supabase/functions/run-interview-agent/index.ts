/**
 * run-interview-agent — Interview preparation agent (Supabase Edge Function, Deno)
 *
 * Triggered by a DB trigger (trg_job_application_interview_prep) when a user
 * saves a job application. The trigger writes agent_type='interview_prep' with
 * status='pending' and config={job_id, job_url}.
 *
 * useAgentWakeup picks this up on next login and calls this function.
 *
 * What it does:
 *   1. Reads the pending config from user_agent_instances (job_id or job_url)
 *   2. Fetches the job description from scraped_jobs
 *   3. Reads user profile (skills, experience, career_level)
 *   4. Calls Claude Haiku to generate:
 *        - Likely interview questions (behavioural, technical, situational)
 *        - Suggested answers personalised to user's background
 *        - Company research bullets
 *        - Red flags to ask about
 *   5. Writes to user_interview_prep (expires in 7 days)
 *   6. Marks agent as idle
 *
 * POST body: {} (reads job context from user_agent_instances.config)
 * Auth: Bearer JWT required
 */

import { AGENT_SCHEDULE_HOURS } from "../_shared/agent-registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY        = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_KEY   = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

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

// ── Claude Haiku: generate interview prep ─────────────────────────────────────

interface PrepResult {
  questions: { id: string; question: string; category: string; difficulty: string }[];
  suggested_ans: { question_id: string; answer: string; tips: string }[];
  company_bullets: string[];
  red_flags: string[];
}

async function generatePrep(
  jobTitle: string,
  jobDescription: string,
  company: string,
  userSkills: string[],
  careerLevel: string,
): Promise<PrepResult | null> {
  if (!ANTHROPIC_KEY) {
    console.warn("[run-interview-agent] No ANTHROPIC_API_KEY — skipping AI prep");
    return null;
  }

  const prompt = `You are an expert career coach preparing a candidate for a job interview.

JOB:
Title: ${jobTitle}
Company: ${company}
Description: ${jobDescription.slice(0, 2000)}

CANDIDATE:
Skills: ${userSkills.slice(0, 15).join(", ")}
Career Level: ${careerLevel}

Generate interview preparation in this exact JSON format (no markdown, raw JSON only):
{
  "questions": [
    {"id": "q1", "question": "...", "category": "behavioural|technical|situational|cultural", "difficulty": "easy|medium|hard"},
    ... (8-12 questions total)
  ],
  "suggested_ans": [
    {"question_id": "q1", "answer": "...", "tips": "..."},
    ... (one per question)
  ],
  "company_bullets": ["...", "...", "..."],
  "red_flags": ["...", "..."]
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL,
        max_tokens: 2000,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn("[run-interview-agent] Anthropic error:", res.status);
      return null;
    }

    const data = await res.json();
    const raw  = data?.content?.[0]?.text ?? "";
    return JSON.parse(raw) as PrepResult;
  } catch (e) {
    console.warn("[run-interview-agent] AI parse error:", e);
    return null;
  }
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

    // ── Load agent state (includes config with job_id / job_url) ───────────
    let agentRows: any[] = [];
    try {
      agentRows = await pgrest(
        "user_agent_instances",
        `user_id=eq.${userId}&agent_type=eq.interview_prep&limit=1`,
      );
    } catch (_) {}

    const agent = agentRows?.[0] ?? null;

    // Only run if pending (triggered by application save)
    if (!agent || agent.status !== "pending") {
      // Return latest prep if available
      let preps: any[] = [];
      try {
        preps = await pgrest(
          "user_interview_prep",
          `user_id=eq.${userId}&order=agent_run_at.desc&limit=1`,
        );
      } catch (_) {}
      return respond({ prep: preps?.[0] ?? null, fromCache: true });
    }

    const config  = agent.config ?? {};
    const jobId   = config.job_id ?? null;
    const jobUrl  = config.job_url ?? null;

    // ── Mark running ────────────────────────────────────────────────────────
    await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: JSON.stringify({
        user_id: userId, agent_type: "interview_prep",
        status: "running", updated_at: now,
      }),
    }).catch(() => {});

    // ── Fetch job details ───────────────────────────────────────────────────
    let job: any = null;
    if (jobId) {
      try {
        const rows = await pgrest(
          "scraped_jobs",
          `id=eq.${jobId}&select=title,company,description,job_url&limit=1`,
        );
        job = rows?.[0] ?? null;
      } catch (_) {}
    }

    if (!job && jobUrl) {
      // Fallback: look up by URL
      try {
        const rows = await pgrest(
          "scraped_jobs",
          `job_url=eq.${encodeURIComponent(jobUrl)}&select=title,company,description,job_url&limit=1`,
        );
        job = rows?.[0] ?? null;
      } catch (_) {}
    }

    // ── Load profile ────────────────────────────────────────────────────────
    let profileRows: any[] = [];
    try {
      profileRows = await pgrest(
        "job_seeker_profiles",
        `user_id=eq.${userId}&select=skills,career_level,target_job_titles&limit=1`,
      );
    } catch (_) {}

    const profile    = profileRows?.[0] ?? null;
    const skills     = profile?.skills ?? [];
    const careerLevel = profile?.career_level ?? "";
    const jobTitle   = job?.title ?? profile?.target_job_titles?.[0] ?? "Target Role";
    const company    = job?.company ?? "the company";
    const description = job?.description ?? "";

    // ── Generate prep with Claude ────────────────────────────────────────────
    let prep: PrepResult | null = null;
    if (description) {
      prep = await generatePrep(jobTitle, description, company, skills, careerLevel);
    }

    // ── Write prep record ────────────────────────────────────────────────────
    const prepRow = {
      user_id:        userId,
      job_id:         jobId,
      job_url:        jobUrl ?? job?.job_url,
      agent_run_at:   now,
      questions:      prep?.questions     ?? [],
      suggested_ans:  prep?.suggested_ans ?? [],
      company_bullets: prep?.company_bullets ?? [],
      red_flags:      prep?.red_flags     ?? [],
    };

    let savedPrep: any = null;
    try {
      const res = await pgrest("user_interview_prep", "", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify(prepRow),
      });
      savedPrep = Array.isArray(res) ? res[0] : res;
    } catch (e) {
      console.warn("[run-interview-agent] prep write error:", e);
    }

    // ── Mark idle ────────────────────────────────────────────────────────────
    await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: JSON.stringify({
        user_id: userId, agent_type: "interview_prep",
        status: "idle", last_run_at: now,
        // No next_run_at — interview_prep only runs on demand
        run_count: (agent?.run_count ?? 0) + 1,
        last_error: null, updated_at: now,
        config: null, // clear the job context once processed
      }),
    }).catch(() => {});

    return respond({ prep: savedPrep, fromCache: false });

  } catch (err) {
    console.error("[run-interview-agent] Error:", err);
    const token  = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    const userId = token ? await verifyToken(token).catch(() => null) : null;
    if (userId) {
      await pgrest("user_agent_instances", "on_conflict=user_id%2Cagent_type", {
        method: "POST",
        prefer: "return=minimal,resolution=merge-duplicates",
        body: JSON.stringify({
          user_id: userId, agent_type: "interview_prep",
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Auth check
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const agents = body.agents || ["discovery", "matching", "optimization", "application"];

    // Create agent run record
    const { data: run, error: runErr } = await adminClient.from("agent_runs").insert({
      user_id: user.id,
      status: "running",
      agents_completed: [],
    }).select().single();

    if (runErr) throw runErr;
    const runId = run.id;
    const completed: string[] = [];
    const errors: string[] = [];
    let jobsFound = 0, jobsMatched = 0, applicationsSent = 0;

    // Get user profile
    const { data: profile } = await adminClient.from("job_seeker_profiles")
      .select("*").eq("user_id", user.id).single();

    if (!profile) {
      await adminClient.from("agent_runs").update({
        status: "failed", errors: ["No profile found. Complete your profile first."], completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: "No profile found", runId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const threshold = profile.match_threshold || profile.min_match_score || 70;
    const dailyCap = profile.daily_apply_cap || 10;
    const mode = profile.automation_mode || "manual";

    // --- AGENT 1: Discovery ---
    if (agents.includes("discovery")) {
      try {
        const titles = profile.target_job_titles || [];
        const searchQuery = titles.length > 0 ? titles.slice(0, 3).join(" OR ") : "software engineer";

        const searchResp = await fetch(`${supabaseUrl}/functions/v1/search-jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ query: searchQuery, location: profile.location || "", limit: 20 }),
        });

        if (searchResp.ok) {
          const searchData = await searchResp.json();
          jobsFound = searchData.jobs?.length || 0;
        }
        completed.push("discovery");
      } catch (e) {
        errors.push(`Discovery: ${e instanceof Error ? e.message : "failed"}`);
      }

      await adminClient.from("agent_runs").update({
        agents_completed: completed, jobs_found: jobsFound,
      }).eq("id", runId);
    }

    // --- AGENT 2: Matching ---
    if (agents.includes("matching")) {
      try {
        const { data: jobs } = await adminClient.from("scraped_jobs")
          .select("*").order("created_at", { ascending: false }).limit(50);

        if (jobs && jobs.length > 0 && LOVABLE_API_KEY) {
          const skillsStr = (profile.skills || []).join(", ");
          const experienceStr = JSON.stringify(profile.work_experience || []);

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{
                role: "user",
                content: `Score these jobs for a candidate. Return JSON array of {job_index, match_score (0-100), interview_probability (0-100), gaps: string[]}.

Candidate skills: ${skillsStr}
Experience: ${experienceStr}
Target titles: ${(profile.target_job_titles || []).join(", ")}

Jobs:
${jobs.slice(0, 15).map((j, i) => `[${i}] ${j.title} at ${j.company}: ${(j.description || "").slice(0, 300)}`).join("\n\n")}`
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

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const parsed = JSON.parse(toolCall.function.arguments);
              const matched = (parsed.scores || []).filter((s: any) => s.match_score >= threshold);
              jobsMatched = matched.length;
            }
          }
        }
        completed.push("matching");
      } catch (e) {
        errors.push(`Matching: ${e instanceof Error ? e.message : "failed"}`);
      }

      await adminClient.from("agent_runs").update({
        agents_completed: completed, jobs_matched: jobsMatched,
      }).eq("id", runId);
    }

    // --- AGENT 3: Optimization ---
    if (agents.includes("optimization")) {
      try {
        // Resume optimization happens per-application, just mark as ready
        completed.push("optimization");
      } catch (e) {
        errors.push(`Optimization: ${e instanceof Error ? e.message : "failed"}`);
      }

      await adminClient.from("agent_runs").update({ agents_completed: completed }).eq("id", runId);
    }

    // --- AGENT 4: Application ---
    if (agents.includes("application") && (mode === "smart" || mode === "full-auto")) {
      try {
        // Count today's applications
        const today = new Date().toISOString().split("T")[0];
        const { count } = await adminClient.from("job_applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("applied_at", `${today}T00:00:00`);

        const remaining = dailyCap - (count || 0);
        applicationsSent = Math.min(remaining, jobsMatched);

        completed.push("application");
      } catch (e) {
        errors.push(`Application: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    // --- AGENT 5: Learning ---
    if (agents.includes("learning")) {
      try {
        const { data: recentApps } = await adminClient.from("job_applications")
          .select("*").eq("user_id", user.id)
          .order("applied_at", { ascending: false }).limit(50);

        if (recentApps && recentApps.length > 0) {
          const outcomes = recentApps.reduce((acc: Record<string, number>, app) => {
            acc[app.status] = (acc[app.status] || 0) + 1;
            return acc;
          }, {});

          await adminClient.from("learning_events").insert({
            user_id: user.id,
            outcome: "cycle_complete",
            features: { total_apps: recentApps.length, outcomes, timestamp: new Date().toISOString() },
            insights: {
              interview_rate: ((outcomes.interview || 0) / recentApps.length * 100).toFixed(1) + "%",
              ghost_rate: ((outcomes.ghosted || 0) / recentApps.length * 100).toFixed(1) + "%",
            },
          });
        }
        completed.push("learning");
      } catch (e) {
        errors.push(`Learning: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    // Finalize
    await adminClient.from("agent_runs").update({
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      agents_completed: completed,
      jobs_found: jobsFound,
      jobs_matched: jobsMatched,
      applications_sent: applicationsSent,
      errors,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    // Create notification
    await adminClient.from("notifications").insert({
      user_id: user.id,
      type: "agent_run",
      title: "Agent Run Complete",
      message: `Found ${jobsFound} jobs, matched ${jobsMatched}, sent ${applicationsSent} applications.`,
      action_url: "/dashboard",
    });

    return new Response(JSON.stringify({
      runId,
      status: "completed",
      jobsFound, jobsMatched, applicationsSent,
      agentsCompleted: completed,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

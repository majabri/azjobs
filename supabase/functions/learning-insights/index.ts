import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    // Get applications with outcomes
    const { data: applications } = await supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", userId)
      .order("applied_at", { ascending: false })
      .limit(50);

    // Get analysis history
    const { data: analyses } = await supabase
      .from("analysis_history")
      .select("overall_score, job_title, company, matched_skills, gaps, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const prompt = `Analyze this job seeker's application history and analysis scores to find actionable patterns.

APPLICATIONS (${(applications || []).length} total):
${JSON.stringify((applications || []).map(a => ({
  title: a.job_title,
  company: a.company,
  status: a.status,
  outcome_detail: a.outcome_detail,
  interview_stage: a.interview_stage,
  response_days: a.response_days,
})).slice(0, 20), null, 0)}

ANALYSIS SCORES:
${JSON.stringify((analyses || []).map(a => ({
  title: a.job_title,
  company: a.company,
  score: a.overall_score,
  gaps: ((a.gaps as any[]) || []).length,
  matched: ((a.matched_skills as any[]) || []).filter((s: any) => s.matched).length,
})).slice(0, 15), null, 0)}

Return a JSON array of 3-5 insights with this structure:
[
  { "pattern": "what you observed", "recommendation": "what to do about it", "impact": "high/medium/low" }
]

Focus on:
- Score ranges that correlate with interviews
- Application timing patterns
- Skill gap patterns
- Industry/role success rates
Be specific with numbers when possible.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: ,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You analyze career data patterns. Return only valid JSON array. No markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let insights;
    try {
      insights = JSON.parse(content);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      insights = match ? JSON.parse(match[0]) : [];
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("learning-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

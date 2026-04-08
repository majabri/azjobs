import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { resumeText, jobDescription, jobTitle } = await req.json();

    if (!resumeText || !jobDescription) {
      return new Response(JSON.stringify({ error: "Resume and job description required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callAnthropic({
      system: "You simulate ATS and recruiter rejection stages for job applications. Return only valid JSON.",
      userMessage: `Simulate two rejection stages for this application.

Job Title: ${jobTitle || "Not specified"}
Job Description:
${jobDescription.slice(0, 3000)}

Resume:
${resumeText.slice(0, 3000)}

Return JSON with:
{
  "ats_stage": { "passed": bool, "score": 0-100, "keyword_matches": [], "missing_keywords": [], "formatting_issues": [], "rejection_reasons": [] },
  "recruiter_stage": { "passed": bool, "score": 0-100, "first_impression": "", "strengths": [], "red_flags": [], "rejection_reasons": [] },
  "fix_suggestions": [{ "priority": "critical|high|medium|low", "area": "", "suggestion": "", "impact": "" }],
  "overall_survival_rate": 0-100
}`,
      temperature: 0.3,
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { error: "Failed to parse AI response" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("simulate-rejection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

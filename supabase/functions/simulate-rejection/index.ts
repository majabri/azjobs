import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{
          role: "user",
          content: `You are simulating two rejection stages for a job application. Analyze this resume against the job description.

Job Title: ${jobTitle || "Not specified"}
Job Description:
${jobDescription.slice(0, 3000)}

Resume:
${resumeText.slice(0, 3000)}

Simulate:
1. ATS (Applicant Tracking System) filtering - keyword matching, formatting issues, missing sections
2. Recruiter 6-second skim - first impression, clarity, relevance, red flags

For each stage, determine pass/fail and provide specific reasons.`
        }],
        tools: [{
          type: "function",
          function: {
            name: "rejection_simulation",
            description: "Return structured rejection simulation results",
            parameters: {
              type: "object",
              properties: {
                ats_stage: {
                  type: "object",
                  properties: {
                    passed: { type: "boolean" },
                    score: { type: "number", description: "0-100 ATS compatibility score" },
                    keyword_matches: { type: "array", items: { type: "string" } },
                    missing_keywords: { type: "array", items: { type: "string" } },
                    formatting_issues: { type: "array", items: { type: "string" } },
                    rejection_reasons: { type: "array", items: { type: "string" } },
                  },
                  required: ["passed", "score", "keyword_matches", "missing_keywords", "formatting_issues", "rejection_reasons"],
                },
                recruiter_stage: {
                  type: "object",
                  properties: {
                    passed: { type: "boolean" },
                    score: { type: "number", description: "0-100 recruiter impression score" },
                    first_impression: { type: "string" },
                    strengths: { type: "array", items: { type: "string" } },
                    red_flags: { type: "array", items: { type: "string" } },
                    rejection_reasons: { type: "array", items: { type: "string" } },
                  },
                  required: ["passed", "score", "first_impression", "strengths", "red_flags", "rejection_reasons"],
                },
                fix_suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      area: { type: "string" },
                      suggestion: { type: "string" },
                      impact: { type: "string" },
                    },
                    required: ["priority", "area", "suggestion", "impact"],
                  },
                },
                overall_survival_rate: { type: "number", description: "0-100 chance of passing both stages" },
              },
              required: ["ats_stage", "recruiter_stage", "fix_suggestions", "overall_survival_rate"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rejection_simulation" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured response from AI");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("simulate-rejection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

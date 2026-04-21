import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const prompt = `Analyze this professional's career and provide strategic recommendations.

PROFILE:
- Skills: ${(body.skills || []).join(", ")}
- Career Level: ${body.careerLevel || "Not specified"}
- Target Titles: ${(body.targetTitles || []).join(", ")}
- Certifications: ${(body.certifications || []).join(", ")}
- Experience: ${JSON.stringify(body.experience || []).slice(0, 1000)}
- Education: ${JSON.stringify(body.education || []).slice(0, 500)}
- Recent job analyses: ${JSON.stringify(body.recentAnalyses || []).slice(0, 1000)}

Provide a JSON response with this EXACT structure:
{
  "currentLevel": "their current career level assessment",
  "nextRoles": [
    { "title": "role title", "salaryRange": "$X-$Y", "matchGap": "what they need to get there" }
  ],
  "skillsToLearn": [
    {
      "skill": "skill name",
      "impact": "high/medium/low",
      "timeEstimate": "e.g. 2-3 months",
      "actionStep": "specific action to take, e.g. 'Complete AWS Solutions Architect certification on Udemy'",
      "resourceType": "course/certification/project/book",
      "resourceSuggestion": "specific resource name or platform"
    }
  ],
  "industryTrends": ["trend 1", "trend 2"],
  "advice": "personalized career advice paragraph",
  "roadmap": [
    { "stage": "description of this career stage", "role": "role title", "skills": ["skill1", "skill2"], "timeframe": "e.g. Now - 6 months" }
  ]
}

Include 3-4 next roles sorted by attainability, 4-5 skills to learn sorted by impact, 2-3 industry trends, and 3-4 roadmap stages showing progression from current to target role. For each skill, provide a SPECIFIC actionStep (not generic), a resourceType, and a concrete resourceSuggestion. Be specific and actionable.`;

    let result;
    try {
      result = JSON.parse(await callAnthropic(prompt, "You are a career strategy advisor. Return only valid JSON. No markdown."));
    } catch {
      result = { currentLevel: "Unknown", nextRoles: [], skillsToLearn: [], industryTrends: [], advice: "Unable to parse response" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("career-path-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

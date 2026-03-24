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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
    { "skill": "skill name", "impact": "high/medium/low", "timeEstimate": "e.g. 2-3 months" }
  ],
  "industryTrends": ["trend 1", "trend 2"],
  "advice": "personalized career advice paragraph",
  "roadmap": [
    { "stage": "description of this career stage", "role": "role title", "skills": ["skill1", "skill2"], "timeframe": "e.g. Now - 6 months" }
  ]
}

Include 3-4 next roles sorted by attainability, 4-5 skills to learn sorted by impact, 2-3 industry trends, and 3-4 roadmap stages showing progression from current to target role. Be specific and actionable.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a career strategy advisor. Return only valid JSON. No markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI service error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { currentLevel: "Unknown", nextRoles: [], skillsToLearn: [], industryTrends: [], advice: content };
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

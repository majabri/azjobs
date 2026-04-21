import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAnthropic } from "../_shared/anthropic.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { skills, careerLevel, salaryMin, salaryMax, salaryTarget, targetTitles, experience } = await req.json();

    const prompt = `Based on this professional profile, generate realistic salary projections for 1, 3, and 5 years.

Profile:
- Career Level: ${careerLevel || "Not specified"}
- Skills: ${(skills || []).join(", ")}
- Current Salary Range: $${salaryMin || "?"} - $${salaryMax || "?"}
- Target Salary: $${salaryTarget || "Not set"}
- Target Roles: ${(targetTitles || []).join(", ")}
- Experience: ${JSON.stringify(experience || []).slice(0, 500)}

Return JSON with: currentEstimate (number), projections (array of {year, low, mid, high, label}), insights (array of strings), topPayingSkills (array of strings). All salary values should be numbers.`;

    const result = await callAnthropic({
      system: "You are a career salary analyst. Return ONLY valid JSON, no markdown.",
      userMessage: prompt,
      temperature: 0.5,
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { currentEstimate: 0, projections: [], insights: [], topPayingSkills: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("salary-projection error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

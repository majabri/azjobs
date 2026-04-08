import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

Return projections as JSON with this structure. Use realistic US market data. All salary values should be numbers (no commas/symbols).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: ,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are a career salary analyst. Return ONLY valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "salary_projection",
              description: "Return salary projections for 1, 3, and 5 years",
              parameters: {
                type: "object",
                properties: {
                  currentEstimate: { type: "number", description: "Estimated current market salary" },
                  projections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        year: { type: "number" },
                        low: { type: "number" },
                        mid: { type: "number" },
                        high: { type: "number" },
                        label: { type: "string" },
                      },
                      required: ["year", "low", "mid", "high", "label"],
                    },
                  },
                  insights: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-4 actionable insights about salary growth",
                  },
                  topPayingSkills: {
                    type: "array",
                    items: { type: "string" },
                    description: "Top 3-5 skills that would increase salary the most",
                  },
                },
                required: ["currentEstimate", "projections", "insights", "topPayingSkills"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "salary_projection" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("salary-projection error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

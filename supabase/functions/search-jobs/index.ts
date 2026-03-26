import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { skills, jobTypes, location, query, careerLevel, targetTitles } = await req.json();

    const skillsList = (skills as string[])?.join(", ") || "general";
    const jobTypesList = (jobTypes as string[])?.join(", ") || "";
    const locationStr = (location as string) || "";
    const customQuery = (query as string) || "";
    const careerLevelStr = (careerLevel as string) || "";
    const titlesList = (targetTitles as string[])?.join(", ") || "";

    const searchPrompt = `Find current job openings for someone with these skills: ${skillsList}.${
      careerLevelStr ? ` Career level: ${careerLevelStr}.` : ""
    }${titlesList ? ` Target job titles: ${titlesList}.` : ""}${
      jobTypesList ? ` Job type preferences: ${jobTypesList}.` : ""
    }${locationStr ? ` Location: ${locationStr}.` : ""}${
      customQuery ? ` Additional criteria: ${customQuery}.` : ""
    }

Return 8-10 real, currently active job listings that would match these qualifications. For each job provide:
- title: the exact job title
- company: the real company name
- location: job location
- type: remote/hybrid/in-office/full-time/part-time/contract
- description: 2-3 sentence summary of the role
- url: the REAL, ACTUAL application URL on the company's careers page or job board (e.g. https://careers.google.com/jobs/results/12345, https://www.linkedin.com/jobs/view/12345, https://boards.greenhouse.io/company/jobs/12345). The URL must be a real link where someone can actually apply. Do NOT make up or fabricate URLs.
- matchReason: why this job matches the given skills

IMPORTANT: Only include jobs with real, working application URLs. If you cannot provide a real URL for a job, do not include that job.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a job search assistant. Return only valid JSON arrays. No markdown, no code blocks, just the raw JSON array." },
          { role: "user", content: searchPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_jobs",
            description: "Return job listings as structured data",
            parameters: {
              type: "object",
              properties: {
                jobs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      company: { type: "string" },
                      location: { type: "string" },
                      type: { type: "string" },
                      description: { type: "string" },
                      url: { type: "string" },
                      matchReason: { type: "string" },
                    },
                    required: ["title", "company", "location", "type", "description", "url", "matchReason"],
                  },
                },
              },
              required: ["jobs"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_jobs" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();

    // Extract jobs from tool call response
    let jobs = [];
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        jobs = parsed.jobs || [];
      } catch { jobs = []; }
    } else {
      // Fallback: try parsing content directly
      const content = data.choices?.[0]?.message?.content || "[]";
      try {
        jobs = JSON.parse(content);
      } catch {
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          try { jobs = JSON.parse(match[0]); } catch { jobs = []; }
        }
      }
    }

    return new Response(JSON.stringify({ jobs, citations: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-jobs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

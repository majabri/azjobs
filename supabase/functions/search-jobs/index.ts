import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Build a direct search URL on a real job board so the user lands on
 * actual listings — never a hallucinated link.
 */
function buildJobSearchUrl(title: string, company: string, location: string): string {
  const q = encodeURIComponent(`"${title}" "${company}"`);
  const loc = location ? `&l=${encodeURIComponent(location)}` : "";
  // LinkedIn job search — always returns real results
  return `https://www.linkedin.com/jobs/search/?keywords=${q}${loc}&f_TPR=r604800`;
}

function buildGoogleJobSearchUrl(title: string, company: string): string {
  const q = encodeURIComponent(`${title} ${company} job apply`);
  return `https://www.google.com/search?q=${q}&ibp=htl;jobs`;
}

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

    const searchPrompt = `Find 8-10 real, currently in-demand job openings for someone with these skills: ${skillsList}.${
      careerLevelStr ? ` Career level: ${careerLevelStr}.` : ""
    }${titlesList ? ` Target job titles: ${titlesList}.` : ""}${
      jobTypesList ? ` Job type preferences: ${jobTypesList}.` : ""
    }${locationStr ? ` Location: ${locationStr}.` : ""}${
      customQuery ? ` Additional criteria: ${customQuery}.` : ""
    }

For each job provide:
- title: the exact job title
- company: the real company name (must be a real company that exists)
- location: job location (city, state or "Remote")
- type: remote/hybrid/in-office/full-time/part-time/contract
- description: A DETAILED 4-6 sentence summary of the role including key responsibilities, required qualifications, and what the team does.
- matchReason: why this job matches the given skills

IMPORTANT: Do NOT include URLs. Only return title, company, location, type, description, and matchReason. All companies must be real, well-known companies that are actually hiring for these types of roles.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a job market expert. Return structured job data. Do NOT return URLs — only job details. All companies must be real companies. Return only valid JSON via the tool call.",
          },
          { role: "user", content: searchPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_jobs",
              description: "Return job listings as structured data without URLs",
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
                        matchReason: { type: "string" },
                      },
                      required: ["title", "company", "location", "type", "description", "matchReason"],
                    },
                  },
                },
                required: ["jobs"],
              },
            },
          },
        ],
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
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();

    let jobs: any[] = [];
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        jobs = parsed.jobs || [];
      } catch {
        jobs = [];
      }
    } else {
      const content = data.choices?.[0]?.message?.content || "[]";
      try {
        jobs = JSON.parse(content);
      } catch {
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            jobs = JSON.parse(match[0]);
          } catch {
            jobs = [];
          }
        }
      }
    }

    // Build real search URLs for each job — never use AI-generated URLs
    const finalJobs = jobs
      .filter(
        (job: any) =>
          job.title && job.company && job.description && job.description.length >= 80
      )
      .map((job: any) => ({
        title: job.title,
        company: job.company,
        location: job.location || locationStr || "Remote",
        type: job.type || "full-time",
        description: job.description,
        matchReason: job.matchReason || "",
        // Primary: LinkedIn search scoped to this exact role + company
        url: buildJobSearchUrl(job.title, job.company, job.location || locationStr),
        // Secondary: Google Jobs search as fallback
        googleUrl: buildGoogleJobSearchUrl(job.title, job.company),
        urlVerified: true, // these are real search URLs, always valid
        urlType: "search", // signals to UI this is a search link, not a direct posting
      }));

    return new Response(JSON.stringify({ jobs: finalJobs, citations: [] }), {
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

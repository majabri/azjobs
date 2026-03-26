import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERIC_JOB_PATH_SEGMENTS = new Set([
  "careers",
  "career",
  "jobs",
  "job",
  "job-search",
  "open-positions",
  "positions",
  "vacancies",
  "opportunities",
  "join-us",
  "work-with-us",
  "employment",
]);

const LISTING_TAIL_SEGMENTS = new Set([
  "search",
  "results",
  "all",
  "openings",
  "index",
  "list",
]);

function normalizeJobUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  const markdownMatch = trimmed.match(/\((https?:\/\/[^)\s]+)\)/i);
  const plainMatch = trimmed.match(/https?:\/\/[^\s<>'"\])]+/i);
  const extracted = (markdownMatch?.[1] || plainMatch?.[0] || trimmed).replace(/[),.;]+$/g, "").trim();
  if (!extracted) return "";

  const withProtocol = /^https?:\/\//i.test(extracted) ? extracted : `https://${extracted}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || parsed.hostname.includes("example.com") || parsed.hostname.includes("placeholder")) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function isGenericJobListingUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname
      .split("/")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (parts.length === 0) return true;

    const allGeneric = parts.every((p) => GENERIC_JOB_PATH_SEGMENTS.has(p) || LISTING_TAIL_SEGMENTS.has(p));
    if (allGeneric) return true;

    if (parts.length === 1 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0])) return true;

    if (parts.length === 2 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0]) && LISTING_TAIL_SEGMENTS.has(parts[1])) {
      return true;
    }

    const last = parts[parts.length - 1];
    if (GENERIC_JOB_PATH_SEGMENTS.has(last) || LISTING_TAIL_SEGMENTS.has(last)) return true;

    const qp = url.searchParams;
    if (
      ["q", "query", "keywords", "search", "location", "department", "team"].some((key) => qp.has(key)) &&
      parts.length <= 2
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function hasSubstantiveDescription(description: unknown): boolean {
  if (typeof description !== "string") return false;
  const text = description.trim();
  if (text.length < 140) return false;
  if (text.split(/\s+/).length < 24) return false;
  return true;
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
- description: A DETAILED 4-6 sentence summary of the role including key responsibilities, required qualifications, and what the team does. This must be substantive enough to evaluate fit.
- url: the REAL, ACTUAL URL to the SPECIFIC job detail page (e.g. https://www.linkedin.com/jobs/view/12345, https://boards.greenhouse.io/company/jobs/12345). The URL must point directly to a single posting that shows the full job description. Do NOT return company homepages, careers landing pages, or search result pages.
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

    // Strict filters: keep only specific job-detail URLs with substantive descriptions
    const validJobs = jobs
      .map((job: any) => {
        const normalized = normalizeJobUrl(job?.url || "");
        return { ...job, url: normalized };
      })
      .filter((job: any) => {
        if (!job.url) return false;
        if (isGenericJobListingUrl(job.url)) return false;
        if (!hasSubstantiveDescription(job.description)) return false;
        return true;
      });

    // Validate URLs by checking they're well-formed
    const checkedJobs = await Promise.all(
      validJobs.map(async (job: any) => {
        try {
          const url = new URL(job.url.startsWith("http") ? job.url : `https://${job.url}`);
            // Quick HEAD check with timeout
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          try {
              let check = await fetch(url.toString(), {
              method: "HEAD",
              signal: controller.signal,
              redirect: "follow",
            });
            clearTimeout(timeout);

              if (check.status === 405) {
                const controllerGet = new AbortController();
                const timeoutGet = setTimeout(() => controllerGet.abort(), 5000);
                try {
                  check = await fetch(url.toString(), {
                    method: "GET",
                    signal: controllerGet.signal,
                    redirect: "follow",
                  });
                } finally {
                  clearTimeout(timeoutGet);
                }
              }

              if (check.status >= 400 && check.status !== 403) {
              // Try GET as fallback (some servers reject HEAD)
              const controller2 = new AbortController();
              const timeout2 = setTimeout(() => controller2.abort(), 3000);
              try {
                const check2 = await fetch(url.toString(), {
                  method: "GET",
                  signal: controller2.signal,
                  redirect: "follow",
                });
                clearTimeout(timeout2);
                if (check2.status >= 400) return null;

                  const resolvedUrl = normalizeJobUrl(check2.url || url.toString());
                  if (!resolvedUrl || isGenericJobListingUrl(resolvedUrl)) return null;
                  return { ...job, url: resolvedUrl };
              } catch {
                clearTimeout(timeout2);
                return null;
              }
            }

              const resolvedUrl = normalizeJobUrl(check.url || url.toString());
              if (!resolvedUrl || isGenericJobListingUrl(resolvedUrl)) return null;
              return { ...job, url: resolvedUrl };
          } catch {
            clearTimeout(timeout);
              // Fail closed: do not include unverified links
              return null;
          }
        } catch {
          return null; // Invalid URL format
        }
      })
    );

    const finalJobs = checkedJobs.filter(Boolean);

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

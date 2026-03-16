import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

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

Return 8-10 real, current job listings. For each job provide:
- title: the job title
- company: the company name
- location: job location
- type: remote/hybrid/in-office/full-time/part-time/contract
- description: 2-3 sentence summary of the role
- url: the application URL if available, otherwise empty string
- matchReason: why this job matches the given skills

Format your response as a JSON array of objects with these exact keys.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a job search assistant. Return only valid JSON arrays. No markdown, no code blocks, just the raw JSON array." },
          { role: "user", content: searchPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "API credits exhausted. Please check your Perplexity account." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Perplexity API error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    const citations = data.citations || [];

    // Try to parse the JSON from the response
    let jobs = [];
    try {
      // Try direct parse first
      jobs = JSON.parse(content);
    } catch {
      // Try extracting JSON array from text
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        try { jobs = JSON.parse(match[0]); } catch { jobs = []; }
      }
    }

    return new Response(JSON.stringify({ jobs, citations }), {
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, company, department, requirements, tone, feedback } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert HR recruiter and job description writer. Generate professional, inclusive, and compelling job postings. Return a JSON object with these fields: title, description, requirements (string with bullet points), nice_to_haves (string with bullet points), salary_suggestion_min (number), salary_suggestion_max (number).`;

    let userPrompt = `Create a job posting for the role: "${title}"`;
    if (company) userPrompt += ` at ${company}`;
    if (department) userPrompt += ` in the ${department} department`;
    if (requirements) userPrompt += `.\n\nKey requirements the hiring manager wants:\n${requirements}`;
    if (tone) userPrompt += `.\n\nTone/style: ${tone}`;
    if (feedback) userPrompt += `.\n\nAdditional feedback/refinement:\n${feedback}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_job_posting",
            description: "Create a structured job posting",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string", description: "Full job description in markdown" },
                requirements: { type: "string", description: "Required qualifications as bullet points" },
                nice_to_haves: { type: "string", description: "Nice to have qualifications as bullet points" },
                salary_suggestion_min: { type: "number" },
                salary_suggestion_max: { type: "number" },
              },
              required: ["title", "description", "requirements"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_job_posting" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-job-posting error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

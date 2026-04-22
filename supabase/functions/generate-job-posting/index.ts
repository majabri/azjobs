import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAnthropic } from "../_shared/anthropic.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { title, company, department, requirements, tone, feedback } =
      await req.json();

    const systemPrompt = `You are an expert HR recruiter and job description writer. Generate professional, inclusive, and compelling job postings. Return a JSON object with these fields: title, description, requirements (string with bullet points), nice_to_haves (string with bullet points), salary_suggestion_min (number), salary_suggestion_max (number). Return ONLY valid JSON.`;

    let userPrompt = `Create a job posting for the role: "${title}"`;
    if (company) userPrompt += ` at ${company}`;
    if (department) userPrompt += ` in the ${department} department`;
    if (requirements)
      userPrompt += `.\n\nKey requirements the hiring manager wants:\n${requirements}`;
    if (tone) userPrompt += `.\n\nTone/style: ${tone}`;
    if (feedback)
      userPrompt += `.\n\nAdditional feedback/refinement:\n${feedback}`;

    const result = await callAnthropic({
      system: systemPrompt,
      userMessage: userPrompt,
      temperature: 0.7,
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const match = result.content.match(/\{[\s\S]*\}/);
      parsed = match
        ? JSON.parse(match[0])
        : { title, description: result.content, requirements: "" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-job-posting error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

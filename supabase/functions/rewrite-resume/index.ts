import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const InputSchema = z.object({
  resume: z.string().min(10, "Resume too short").max(50000, "Resume too long"),
  jobDescription: z.string().min(10, "Job description too short").max(50000, "Job description too long"),
  matchedSkills: z.array(z.string().max(200)).max(100),
  gaps: z.array(z.string().max(200)).max(100),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkRateLimit(`rewrite-resume:${data.user.id}`, 10, 60_000)) {
      return new Response(
        JSON.stringify({ error: "Too many requests – please slow down" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawInput = await req.json();
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { resume, jobDescription, matchedSkills, gaps } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert ATS (Applicant Tracking System) resume writer. Your job is to rewrite the candidate's resume to maximize their chances of passing ATS screening for the target job.

RULES:
- Use a clean, ATS-friendly plain-text format with clear section headers (ALL CAPS with a line of dashes underneath)
- Incorporate keywords from the job description naturally into the resume
- Keep all factual information from the original resume — do NOT invent experience or qualifications
- Reorganize and rephrase bullet points to better align with the job requirements
- Use strong action verbs and quantify achievements where possible
- Include a tailored Professional Summary at the top
- Add a "Core Competencies" section listing relevant skills (matched + transferable)
- For skills the candidate is missing, do NOT fabricate them — instead, frame adjacent experience to show transferable capability
- Keep formatting simple: no tables, columns, or special characters that ATS systems struggle with
- Output ONLY the rewritten resume text, no commentary`;

    const userPrompt = `JOB DESCRIPTION:
${jobDescription}

ORIGINAL RESUME:
${resume}

MATCHED SKILLS: ${matchedSkills.join(", ")}
SKILL GAPS: ${gaps.join(", ")}

Rewrite this resume in ATS-optimized format for the above job description.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("rewrite-resume error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

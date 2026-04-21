import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";
import { corsHeaders } from "../_shared/cors.ts";

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

    const { jobTitle, company, resume, emailType = "follow-up", context = "" } = await req.json();

    const typeInstructions: Record<string, string> = {
      "follow-up": "Write a professional follow-up email after submitting a job application. Be polite, reiterate interest, and reference specific qualifications.",
      "thank-you": "Write a thank-you email after a job interview. Reference specific discussion points, reiterate fit, and express enthusiasm.",
      "recruiter-outreach": "Write a cold outreach email to a recruiter or hiring manager. Be concise, show value, and request a conversation.",
      "networking": "Write a professional networking email to someone at the target company. Be genuine, reference shared connections or interests.",
    };

    const systemPrompt = `You are an expert career coach who writes compelling professional emails.

${typeInstructions[emailType] || typeInstructions["follow-up"]}

RULES:
- Keep it concise (150-250 words)
- Use a professional but warm tone
- Include a clear subject line at the top (format: "Subject: ...")
- Personalize based on the job, company, and candidate's background
- Include a specific call to action
- Do NOT be generic — reference specific skills or experiences from the resume
- Output ONLY the email text with subject line`;

    const userPrompt = `JOB TITLE: ${jobTitle}
COMPANY: ${company}
EMAIL TYPE: ${emailType}
${context ? `ADDITIONAL CONTEXT: ${context}` : ""}

CANDIDATE BACKGROUND:
${resume.slice(0, 3000)}

Write the ${emailType} email.`;

    const emailText = await callAnthropic(systemPrompt, userPrompt);

    return new Response(JSON.stringify({ email: emailText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-followup-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

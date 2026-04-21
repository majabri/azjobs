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

    const { jobDescription, resume, matchedSkills = [], gaps = [] } = await req.json();

    const systemPrompt = `You are an expert interview coach. Generate comprehensive interview preparation materials.

OUTPUT FORMAT (use these exact headers):
## Likely Interview Questions

For each question provide:
### Q1: [Question text]
**Why they ask this:** [Brief explanation]
**Suggested answer:** [Tailored answer using the candidate's actual experience]
**Key points to hit:** [Bullet points]

Generate 8-10 questions covering:
- 2-3 behavioral questions (STAR format)
- 2-3 technical/skill-specific questions
- 1-2 situational questions
- 1-2 questions about gaps or areas to address
- 1 "tell me about yourself" opener

## Questions to Ask the Interviewer
Provide 4-5 insightful questions the candidate should ask.

## Key Talking Points
Summarize 3-4 compelling stories/achievements from the resume that map to job requirements.

RULES:
- Base ALL suggested answers on the candidate's ACTUAL experience from their resume
- For skill gaps, suggest honest framing strategies (not fabrication)
- Include specific metrics and examples from the resume
- Keep answers concise but detailed enough to be useful`;

    const userPrompt = `JOB DESCRIPTION:
${jobDescription.slice(0, 4000)}

CANDIDATE RESUME:
${resume.slice(0, 4000)}

MATCHED SKILLS: ${matchedSkills.join(", ")}
SKILL GAPS: ${gaps.join(", ")}

Generate interview preparation materials for this candidate and role.`;

    const result = await callAnthropic({ system: systemPrompt, userMessage: userPrompt });

    return new Response(JSON.stringify({ content: result.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-interview-prep error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

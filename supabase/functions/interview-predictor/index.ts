import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // Evaluate mode: score a user's answer
    if (body.mode === "evaluate") {
      const evalPrompt = `You are an interview coach. A candidate was asked this question for a job:

Question: ${body.question}
Job context: ${body.jobDescription || "Not provided"}

Their answer: "${body.answer}"

Evaluate their answer. Return JSON with:
{
  "score": <0-100 confidence score>,
  "feedback": "<specific feedback on what was good and what to improve>"
}

Be honest but constructive. Return only valid JSON.`;

      const evalResult = await callAnthropic({
        system: "You evaluate interview answers. Return only valid JSON.",
        userMessage: evalPrompt,
        temperature: 0.3,
      });

      let parsed;
      try { parsed = JSON.parse(evalResult.content); } catch { const m = evalResult.content.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { score: 50, feedback: evalResult.content }; }

      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Predict mode: generate interview questions
    const prompt = `Analyze this job description and resume, then predict the most likely interview questions.

JOB DESCRIPTION:
${body.jobDescription}

RESUME:
${body.resumeText}

Return a JSON object with this EXACT structure:
{
  "questions": [
    {
      "question": "the interview question",
      "difficulty": "easy|medium|hard",
      "category": "behavioral|technical|situational|culture-fit",
      "weakAnswerWarning": "specific warning about what would make the candidate fail this question based on their resume gaps",
      "suggestedAnswer": "a strong answer tailored to the candidate's actual experience from their resume",
      "confidenceScore": <0-100 how confident the candidate should feel based on their resume>
    }
  ]
}

Generate 6-8 questions. Sort by confidenceScore ascending (hardest first).
Return only valid JSON.`;

    const result = await callAnthropic({
      system: "You are an expert interview predictor. Return only valid JSON.",
      userMessage: prompt,
      temperature: 0.3,
    });

    let parsed;
    try { parsed = JSON.parse(result.content); } catch { const m = result.content.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { questions: [] }; }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("interview-predictor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

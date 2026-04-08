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

      const evalResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { Authorization: , "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          messages: [
            { role: "system", content: "You evaluate interview answers. Return only valid JSON." },
            { role: "user", content: evalPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!evalResp.ok) {
        if (evalResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (evalResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI error");
      }

      const evalData = await evalResp.json();
      const evalContent = evalData.choices?.[0]?.message?.content || "{}";
      let evalResult;
      try { evalResult = JSON.parse(evalContent); } catch { const m = evalContent.match(/\{[\s\S]*\}/); evalResult = m ? JSON.parse(m[0]) : { score: 50, feedback: evalContent }; }

      return new Response(JSON.stringify(evalResult), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

Generate 6-8 questions. For each:
- weakAnswerWarning: Be specific about WHY this candidate might struggle (reference actual resume gaps)
- suggestedAnswer: Use the candidate's REAL experience from the resume to craft a compelling answer
- confidenceScore: Lower for questions targeting resume gaps, higher for questions matching experience
- Sort by confidenceScore ascending (hardest first)

Return only valid JSON.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { Authorization: , "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are an expert interview predictor. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let result;
    try { result = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : { questions: [] }; }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("interview-predictor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

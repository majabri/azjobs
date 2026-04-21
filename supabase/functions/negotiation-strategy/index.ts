import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "benchmark":
        result = await handleBenchmark(body);
        break;
      case "analyze-offer":
        result = await handleOfferAnalysis(body);
        break;
      case "negotiate":
        result = await handleNegotiation(body);
        break;
      case "generate-scripts":
        result = await handleScriptGeneration(body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("negotiation-strategy error:", e);
    const status = e?.message?.includes("429") ? 429 : e?.message?.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(systemPrompt: string, userPrompt: string) {
  const result = await callAnthropic({ system: systemPrompt, userMessage: userPrompt, temperature: 0.5 });
  try {
    return JSON.parse(result.content);
  } catch {
    const match = result.content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

async function handleBenchmark(body: any) {
  const { jobTitle, location, experienceLevel, skills } = body;
  return callAI(
    "You are a compensation analyst with deep US market salary data knowledge. Return realistic salary benchmarks as JSON.",
    `Provide salary benchmarks for:
- Role: ${jobTitle || "Software Engineer"}
- Location: ${location || "US National Average"}
- Experience: ${experienceLevel || "Mid-level"}
- Key Skills: ${(skills || []).join(", ")}

Return JSON with: marketLow, marketMedian, marketHigh, top10Percent (numbers), classification (underpaid/fair/overpaid), targetRange (string), insights (array of strings), topPayingCompanies (array), demandTrend (rising/stable/declining).`
  );
}

async function handleOfferAnalysis(body: any) {
  const { baseSalary, bonus, equity, jobTitle, company, location, experienceLevel } = body;
  const totalComp = (baseSalary || 0) + (bonus || 0) + (equity || 0);
  return callAI(
    "You are a compensation expert. Analyze job offers against market rates. Return JSON.",
    `Analyze this offer:
- Role: ${jobTitle} at ${company}
- Location: ${location || "US"}
- Experience: ${experienceLevel || "Mid-level"}
- Base: $${baseSalary || 0}, Bonus: $${bonus || 0}, Equity: $${equity || 0}, Total: $${totalComp}

Return JSON with: marketComparison (string), moneyLeftOnTable (number), overallRating (poor/below_market/fair/good/excellent), breakdownAnalysis ({baseVerdict, bonusVerdict, equityVerdict}), riskFactors (array), strengths (array), recommendation (string).`
  );
}

async function handleNegotiation(body: any) {
  const { baseSalary, bonus, equity, jobTitle, company, skills, experience, marketData } = body;
  return callAI(
    "You are an expert salary negotiation coach. Generate specific, actionable negotiation strategies. Return JSON.",
    `Create a negotiation strategy for:
- Offer: $${baseSalary} base + $${bonus || 0} bonus + $${equity || 0} equity at ${company} for ${jobTitle}
- Skills: ${(skills || []).join(", ")}
- Experience: ${JSON.stringify(experience || []).slice(0, 500)}
- Market context: ${JSON.stringify(marketData || {}).slice(0, 300)}

Return JSON with: targetSalary, walkAwayPoint, anchorPoint (numbers), justificationPoints, tacticalAdvice, leveragePoints, concessions (arrays of strings), timing (string).`
  );
}

async function handleScriptGeneration(body: any) {
  const { baseSalary, targetSalary, jobTitle, company, justificationPoints } = body;
  return callAI(
    "You are a professional communication expert. Write confident negotiation scripts. Return JSON.",
    `Generate negotiation scripts for:
- Current offer: $${baseSalary} for ${jobTitle} at ${company}
- Target: $${targetSalary}
- Justifications: ${(justificationPoints || []).join("; ")}

Return JSON with: emailSubject (string), emailBody (string), callScript ({opening, counterOffer, objectionHandling: [{objection, response}], closing}).`
  );
}

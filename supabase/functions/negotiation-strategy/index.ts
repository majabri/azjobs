import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const { action } = body;

    // Auth
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
        result = await handleBenchmark(body, LOVABLE_API_KEY);
        break;
      case "analyze-offer":
        result = await handleOfferAnalysis(body, LOVABLE_API_KEY);
        break;
      case "negotiate":
        result = await handleNegotiation(body, LOVABLE_API_KEY);
        break;
      case "generate-scripts":
        result = await handleScriptGeneration(body, LOVABLE_API_KEY);
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

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string, toolDef: any) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{ type: "function", function: toolDef }],
      tool_choice: { type: "function", function: { name: toolDef.name } },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("429: Rate limited");
    if (resp.status === 402) throw new Error("402: Credits exhausted");
    throw new Error(`AI error: ${resp.status}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in response");
  return JSON.parse(toolCall.function.arguments);
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleBenchmark(body: any, apiKey: string) {
  const { jobTitle, location, experienceLevel, skills } = body;

  return callAI(apiKey,
    "You are a compensation analyst with deep US market salary data knowledge. Return realistic salary benchmarks.",
    `Provide salary benchmarks for:
- Role: ${jobTitle || "Software Engineer"}
- Location: ${location || "US National Average"}
- Experience: ${experienceLevel || "Mid-level"}
- Key Skills: ${(skills || []).join(", ")}

Provide market salary ranges, percentile breakdowns, and a classification.`,
    {
      name: "salary_benchmark",
      description: "Return salary benchmark data",
      parameters: {
        type: "object",
        properties: {
          marketLow: { type: "number", description: "25th percentile salary" },
          marketMedian: { type: "number", description: "50th percentile salary" },
          marketHigh: { type: "number", description: "75th percentile salary" },
          top10Percent: { type: "number", description: "90th percentile salary" },
          classification: { type: "string", enum: ["underpaid", "fair", "overpaid", "unknown"] },
          targetRange: { type: "string", description: "Recommended target range e.g. '$120k–$145k'" },
          insights: { type: "array", items: { type: "string" }, description: "3-4 market insights" },
          topPayingCompanies: { type: "array", items: { type: "string" }, description: "Top 5 companies paying most for this role" },
          demandTrend: { type: "string", enum: ["rising", "stable", "declining"], description: "Market demand trend" },
        },
        required: ["marketLow", "marketMedian", "marketHigh", "top10Percent", "classification", "targetRange", "insights", "topPayingCompanies", "demandTrend"],
      },
    }
  );
}

async function handleOfferAnalysis(body: any, apiKey: string) {
  const { baseSalary, bonus, equity, jobTitle, company, location, experienceLevel } = body;
  const totalComp = (baseSalary || 0) + (bonus || 0) + (equity || 0);

  return callAI(apiKey,
    "You are a compensation expert. Analyze job offers and identify how they compare to market rates. Be specific about dollar amounts left on the table.",
    `Analyze this offer:
- Role: ${jobTitle} at ${company}
- Location: ${location || "US"}
- Experience: ${experienceLevel || "Mid-level"}
- Base: $${baseSalary || 0}
- Bonus: $${bonus || 0}
- Equity: $${equity || 0}
- Total: $${totalComp}

Compare to market and identify negotiation opportunities.`,
    {
      name: "offer_analysis",
      description: "Analyze a job offer against market data",
      parameters: {
        type: "object",
        properties: {
          marketComparison: { type: "string", description: "e.g. '12% below market median'" },
          moneyLeftOnTable: { type: "number", description: "Estimated $ amount that could be negotiated" },
          overallRating: { type: "string", enum: ["poor", "below_market", "fair", "good", "excellent"] },
          breakdownAnalysis: {
            type: "object",
            properties: {
              baseVerdict: { type: "string" },
              bonusVerdict: { type: "string" },
              equityVerdict: { type: "string" },
            },
            required: ["baseVerdict", "bonusVerdict", "equityVerdict"],
          },
          riskFactors: { type: "array", items: { type: "string" }, description: "2-3 risk factors to consider" },
          strengths: { type: "array", items: { type: "string" }, description: "Positive aspects of the offer" },
          recommendation: { type: "string", description: "Overall recommendation" },
        },
        required: ["marketComparison", "moneyLeftOnTable", "overallRating", "breakdownAnalysis", "riskFactors", "strengths", "recommendation"],
      },
    }
  );
}

async function handleNegotiation(body: any, apiKey: string) {
  const { baseSalary, bonus, equity, jobTitle, company, skills, experience, marketData } = body;

  return callAI(apiKey,
    "You are an expert salary negotiation coach. Generate specific, actionable negotiation strategies with exact numbers and justifications.",
    `Create a negotiation strategy for:
- Offer: $${baseSalary} base + $${bonus || 0} bonus + $${equity || 0} equity at ${company} for ${jobTitle}
- Skills: ${(skills || []).join(", ")}
- Experience: ${JSON.stringify(experience || []).slice(0, 500)}
- Market context: ${JSON.stringify(marketData || {}).slice(0, 300)}

Generate a complete negotiation plan.`,
    {
      name: "negotiation_strategy",
      description: "Generate a negotiation strategy",
      parameters: {
        type: "object",
        properties: {
          targetSalary: { type: "number", description: "Recommended counter-offer salary" },
          walkAwayPoint: { type: "number", description: "Minimum acceptable salary" },
          anchorPoint: { type: "number", description: "Initial ask (slightly above target)" },
          justificationPoints: { type: "array", items: { type: "string" }, description: "4-5 data-backed justification points" },
          tacticalAdvice: { type: "array", items: { type: "string" }, description: "3-4 tactical negotiation tips" },
          timing: { type: "string", description: "Best timing advice for the negotiation" },
          leveragePoints: { type: "array", items: { type: "string" }, description: "Leverage points the candidate has" },
          concessions: { type: "array", items: { type: "string" }, description: "Things to concede strategically" },
        },
        required: ["targetSalary", "walkAwayPoint", "anchorPoint", "justificationPoints", "tacticalAdvice", "timing", "leveragePoints", "concessions"],
      },
    }
  );
}

async function handleScriptGeneration(body: any, apiKey: string) {
  const { baseSalary, targetSalary, jobTitle, company, justificationPoints } = body;

  return callAI(apiKey,
    "You are a professional communication expert. Write confident, professional, data-backed negotiation scripts. Keep the tone respectful but assertive.",
    `Generate negotiation scripts for:
- Current offer: $${baseSalary} for ${jobTitle} at ${company}
- Target: $${targetSalary}
- Justifications: ${(justificationPoints || []).join("; ")}

Generate both an email and a phone call script.`,
    {
      name: "negotiation_scripts",
      description: "Generate negotiation email and call scripts",
      parameters: {
        type: "object",
        properties: {
          emailSubject: { type: "string" },
          emailBody: { type: "string", description: "Full professional negotiation email" },
          callScript: {
            type: "object",
            properties: {
              opening: { type: "string" },
              counterOffer: { type: "string" },
              objectionHandling: { type: "array", items: {
                type: "object",
                properties: {
                  objection: { type: "string" },
                  response: { type: "string" },
                },
                required: ["objection", "response"],
              }},
              closing: { type: "string" },
            },
            required: ["opening", "counterOffer", "objectionHandling", "closing"],
          },
        },
        required: ["emailSubject", "emailBody", "callScript"],
      },
    }
  );
}

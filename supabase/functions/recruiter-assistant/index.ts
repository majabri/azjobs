import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { recruiterMessage, replyType, availability, userName, skills, careerLevel } = await req.json();

    const typeInstructions: Record<string, string> = {
      thank_you: "Write a warm, professional thank-you reply. Acknowledge the opportunity and express genuine interest.",
      schedule_interview: `Write a professional reply to schedule an interview. ${availability ? `The candidate is available: ${availability}` : "Ask for available times."} Suggest specific time slots if availability is provided.`,
      follow_up: "Write a polite follow-up email checking on the application status. Be professional but not pushy. Reference the original conversation.",
      negotiate: "Write a professional, confident response to negotiate offer terms. Be respectful but firm. Ask for specifics if the offer details aren't clear.",
      decline: "Write a gracious, professional decline. Thank them for the opportunity, express that it wasn't the right fit at this time, and leave the door open for future opportunities.",
    };

    const systemPrompt = `You are an expert career communication coach. Draft a professional email reply for a job candidate.

CANDIDATE INFO:
- Name: ${userName || "the candidate"}
- Key Skills: ${(skills || []).slice(0, 10).join(", ")}
- Career Level: ${careerLevel || "professional"}

INSTRUCTIONS: ${typeInstructions[replyType] || typeInstructions.thank_you}

RULES:
- Be concise (under 200 words)
- Sound natural and human, not AI-generated
- Use the candidate's name in the sign-off
- Do NOT include subject lines
- Output ONLY the email body text`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: ,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Recruiter's message:\n\n${recruiterMessage}\n\nDraft a ${replyType.replace("_", " ")} reply.` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("recruiter-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { callAnthropic } from "../_shared/anthropic.ts";
import { corsHeaders } from "../_shared/cors.ts";

const InputSchema = z.object({
  company: z.string().min(1).max(500),
  role: z.string().min(1).max(500),
  contactName: z.string().max(200).optional(),
  messageType: z.enum(["cold_outreach", "warm_intro", "informational"]).default("cold_outreach"),
});

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
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkRateLimit(`outreach:${authData.user.id}`, 10, 60_000)) {
      return new Response(JSON.stringify({ error: "Too many requests – please slow down" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawInput = await req.json();
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { company, role, contactName, messageType } = parsed.data;

    const { data: profile } = await supabase
      .from("job_seeker_profiles")
      .select("full_name, summary, skills, career_level, work_experience")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    const typeDescriptions: Record<string, string> = {
      cold_outreach: "a cold LinkedIn/email outreach message to a recruiter or hiring manager",
      warm_intro: "a warm introduction request asking a mutual connection to introduce them",
      informational: "a request for an informational interview to learn about the company/role",
    };

    const prompt = `Write ${typeDescriptions[messageType] || typeDescriptions.cold_outreach}.

TARGET:
- Company: ${company}
- Role: ${role}
${contactName ? `- Contact: ${contactName}` : ""}

SENDER PROFILE:
- Name: ${profile?.full_name || "Job Seeker"}
- Level: ${(profile as any)?.career_level || "Not specified"}
- Skills: ${((profile?.skills as string[]) || []).slice(0, 10).join(", ")}
- Summary: ${profile?.summary?.slice(0, 300) || "Not provided"}

RULES:
- Keep it under 150 words
- Be professional but personable
- Reference specific skills relevant to the role
- Include a clear call to action
- Don't be generic or overly formal
- Return ONLY the message text, no subject line or formatting`;

    const result = await callAnthropic({
      system: "You write concise, effective networking messages. Return only the message text.",
      userMessage: prompt,
      temperature: 0.7,
    });

    return new Response(JSON.stringify({ message: result.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outreach error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing your request. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

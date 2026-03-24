import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for personalization
    const { data: profile } = await supabase
      .from("job_seeker_profiles")
      .select("full_name, summary, skills, career_level, work_experience")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    const { company, role, contactName, messageType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write concise, effective networking messages. Return only the message text." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const aiData = await response.json();
    const message = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outreach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

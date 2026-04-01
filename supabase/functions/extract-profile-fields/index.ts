import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { resumeText } = await req.json();
    if (!resumeText) {
      return new Response(
        JSON.stringify({ error: "resumeText is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an expert resume parser. Extract structured profile information from the provided resume text. Return only the tool call with all fields you can identify.",
          },
          {
            role: "user",
            content: `Extract profile fields from this resume:\n\n${resumeText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract structured profile fields from a resume",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", description: "Candidate's full name" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number" },
                  location: { type: "string", description: "City, state or country" },
                  summary: { type: "string", description: "Professional summary or objective" },
                  linkedin_url: {
                    type: "string",
                    description: "LinkedIn profile URL (e.g. https://linkedin.com/in/username)",
                  },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of professional skills",
                  },
                  work_experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        company: { type: "string" },
                        startDate: { type: "string" },
                        endDate: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["title", "company", "startDate", "endDate", "description"],
                    },
                    description: "List of work experience entries",
                  },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string" },
                        institution: { type: "string" },
                        year: { type: "string" },
                      },
                      required: ["degree", "institution", "year"],
                    },
                    description: "List of education entries",
                  },
                  certifications: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of certifications or licenses",
                  },
                },
                required: ["full_name", "email", "skills", "work_experience", "education", "certifications"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_profile" } },
        temperature: 0.1,
      }),
    });

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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    let profile: Record<string, unknown> = {};
    if (toolCall?.function?.arguments) {
      try {
        profile = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Regex fallback: extract LinkedIn URL if AI did not return one
    if (!profile.linkedin_url) {
      const linkedinMatch = resumeText.match(
        /https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/
      );
      if (linkedinMatch) {
        profile.linkedin_url = linkedinMatch[0];
      }
    }

    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-profile-fields error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
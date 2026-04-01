// Edge function: extract profile fields from resume text using AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resumeText } = await req.json();
    if (!resumeText || typeof resumeText !== "string") {
      return new Response(JSON.stringify({ error: "resumeText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured, falling back to regex");
      return new Response(JSON.stringify({ profile: regexFallback(resumeText) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI with tool calling for structured extraction
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a resume parser. Extract structured profile data from the resume text provided. Be thorough and accurate. For work experience, extract every position listed. For education, extract every degree. For certifications, extract all listed certifications, licenses, and professional credentials.`,
          },
          {
            role: "user",
            content: `Extract all profile fields from this resume:\n\n${resumeText.substring(0, 15000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract structured profile data from a resume",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", description: "Full name of the candidate" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number" },
                  location: { type: "string", description: "City, state or full address" },
                  summary: { type: "string", description: "Professional summary or objective (max 500 chars)" },
                  linkedin_url: { type: "string", description: "LinkedIn profile URL" },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of technical and soft skills",
                  },
                  work_experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Job title" },
                        company: { type: "string", description: "Company name" },
                        startDate: { type: "string", description: "Start date (e.g. Jan 2020)" },
                        endDate: { type: "string", description: "End date or Present" },
                        description: { type: "string", description: "Key responsibilities and achievements" },
                      },
                      required: ["title", "company", "startDate", "endDate", "description"],
                    },
                    description: "All work experience entries",
                  },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string", description: "Degree name (e.g. B.S. Computer Science)" },
                        institution: { type: "string", description: "School or university name" },
                        year: { type: "string", description: "Graduation year or date range" },
                      },
                      required: ["degree", "institution", "year"],
                    },
                    description: "All education entries",
                  },
                  certifications: {
                    type: "array",
                    items: { type: "string" },
                    description: "Professional certifications, licenses, and credentials",
                  },
                },
                required: ["full_name"],
              },
            },
          },
        ],
        tool_choice: "required",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fall back to regex on AI failure
      return new Response(JSON.stringify({ profile: regexFallback(resumeText) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response, falling back to regex");
      return new Response(JSON.stringify({ profile: regexFallback(resumeText) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse AI tool call arguments");
      return new Response(JSON.stringify({ profile: regexFallback(resumeText) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = {
      full_name: extracted.full_name || null,
      email: extracted.email || null,
      phone: extracted.phone || null,
      location: extracted.location || null,
      summary: extracted.summary ? extracted.summary.substring(0, 500) : null,
      linkedin_url: extracted.linkedin_url || null,
      skills: Array.isArray(extracted.skills) && extracted.skills.length > 0 ? extracted.skills : null,
      work_experience: Array.isArray(extracted.work_experience) && extracted.work_experience.length > 0 ? extracted.work_experience : null,
      education: Array.isArray(extracted.education) && extracted.education.length > 0 ? extracted.education : null,
      certifications: Array.isArray(extracted.certifications) && extracted.certifications.length > 0 ? extracted.certifications : null,
    };

    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-profile-fields error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Regex fallback when AI is unavailable
function regexFallback(resumeText: string) {
  const emailMatch = resumeText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phoneMatch = resumeText.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  const linkedinMatch = resumeText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i);

  const lines = resumeText.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const fullName = lines.length > 0 ? lines[0].replace(/[^a-zA-Z\s'-]/g, "").trim() : null;

  const skillsSection = resumeText.match(/(?:skills|technical skills|core competencies)[:\s]*([^\n]*(?:\n(?![A-Z][a-z]+ ?[A-Z])[^\n]*)*)/i);
  const skills: string[] = [];
  if (skillsSection) {
    skillsSection[1].split(/[,;•|·\n]/).forEach((s: string) => {
      const cleaned = s.replace(/[-–—]/g, "").trim();
      if (cleaned.length > 1 && cleaned.length < 50) skills.push(cleaned);
    });
  }

  const locationMatch = resumeText.match(/(?:location|address|city)[:\s]*([^\n]+)/i) ||
    resumeText.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z]{2}(?:\s+\d{5})?)/);

  const summaryMatch = resumeText.match(/(?:summary|objective|profile|about)[:\s]*\n?([^\n](?:[^\n]*\n?){1,5})/i);

  return {
    full_name: fullName && fullName.length > 1 ? fullName : null,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[1].trim() : null,
    location: locationMatch ? locationMatch[1].trim() : null,
    summary: summaryMatch ? summaryMatch[1].trim().substring(0, 500) : null,
    skills: skills.length > 0 ? skills : null,
    linkedin_url: linkedinMatch ? linkedinMatch[0] : null,
    work_experience: null,
    education: null,
    certifications: null,
  };
}

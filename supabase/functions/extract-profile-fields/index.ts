// Edge function: extract profile fields from resume text using AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-platform-arch",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resumeText } = await req.json();

    if (!resumeText || typeof resumeText !== "string") {
      return new Response(
        JSON.stringify({ error: "resumeText is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call Anthropic Messages API with tool_use for structured extraction
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: `You are an expert resume parser. Your job is to extract ALL structured profile data from the resume text provided. Be extremely thorough and accurate.

CRITICAL INSTRUCTIONS:
- Extract EVERY piece of information available in the resume
- For the summary field, ONLY include the professional summary/objective paragraph. Do NOT include work experience or other sections in the summary.
- For phone numbers, include the full number with area code and any formatting (e.g., "(415) 555-1234")
- For LinkedIn URLs, extract the full URL or partial URL (e.g., "linkedin.com/in/username")
- For work_experience, extract EVERY position listed with all details. Each entry MUST have title, company, startDate, endDate (use "Present" if current), location, and description (bullet points joined with newlines)
- For education, extract EVERY degree/institution listed
- For certifications, extract ALL certifications, licenses, and credentials mentioned
- NEVER return null for work_experience, education, or certifications if they exist in the resume. Return empty arrays [] only if truly not present.
- You MUST call the extract_profile tool with your findings.`,
        messages: [
          {
            role: "user",
            content: `Parse this resume and extract all profile fields by calling the extract_profile tool. Be thorough - extract every work experience entry, education entry, and certification listed.\n\nRESUME TEXT:\n${resumeText}`,
          },
        ],
        tool_choice: { type: "tool", name: "extract_profile" },
        tools: [
          {
            name: "extract_profile",
            description:
              "Extract structured profile information from a resume. You must populate ALL fields that are present in the resume.",
            input_schema: {
              type: "object",
              properties: {
                full_name: {
                  type: "string",
                  description: "Full name of the candidate",
                },
                email: {
                  type: "string",
                  description: "Email address",
                },
                phone: {
                  type: "string",
                  description: "Phone number including area code, e.g. (415) 555-1234",
                },
                location: {
                  type: "string",
                  description: "City and state/country",
                },
                summary: {
                  type: "string",
                  description: "Professional summary or objective paragraph ONLY. Do NOT include work experience or other sections here.",
                },
                linkedin_url: {
                  type: "string",
                  description: "LinkedIn profile URL or partial URL (e.g. linkedin.com/in/username or https://www.linkedin.com/in/username)",
                },
                skills: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of all technical and soft skills mentioned",
                },
                work_experience: {
                  type: "array",
                  description: "ALL work experience entries from the resume. Extract every position listed.",
                  items: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Job title",
                      },
                      company: {
                        type: "string",
                        description: "Company or organization name",
                      },
                      startDate: {
                        type: "string",
                        description: "Start date (e.g. January 2021, Jan 2021, 2021)",
                      },
                      endDate: {
                        type: "string",
                        description: "End date or 'Present' if current role",
                      },
                      location: {
                        type: "string",
                        description: "Job location (city, state)",
                      },
                      description: {
                        type: "string",
                        description: "Job responsibilities and achievements as bullet points joined by newlines",
                      },
                    },
                    required: ["title", "company", "startDate", "endDate"],
                  },
                },
                education: {
                  type: "array",
                  description: "ALL education entries from the resume",
                  items: {
                    type: "object",
                    properties: {
                      degree: {
                        type: "string",
                        description: "Degree type and field (e.g. B.S. Computer Science)",
                      },
                      institution: {
                        type: "string",
                        description: "School or university name",
                      },
                      graduationDate: {
                        type: "string",
                        description: "Graduation date or expected graduation",
                      },
                      gpa: {
                        type: "string",
                        description: "GPA if listed",
                      },
                    },
                    required: ["degree", "institution"],
                  },
                },
                certifications: {
                  type: "array",
                  description: "ALL certifications, licenses, and professional credentials",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Certification name",
                      },
                      issuer: {
                        type: "string",
                        description: "Issuing organization",
                      },
                      date: {
                        type: "string",
                        description: "Date obtained or expiry",
                      },
                    },
                    required: ["name"],
                  },
                },
              },
              required: [
                "full_name",
                "email",
                "phone",
                "location",
                "summary",
                "skills",
                "work_experience",
                "education",
                "certifications",
              ],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      // Fall back to regex extraction
      const profile = regexFallback(resumeText);
      return new Response(JSON.stringify({ profile, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Extract the tool_use result from the response
    const toolUseBlock = data.content?.find(
      (block: any) => block.type === "tool_use"
    );

    if (toolUseBlock?.input) {
      const profile = toolUseBlock.input;

      // Normalize: ensure arrays are arrays, not null
      profile.work_experience = Array.isArray(profile.work_experience)
        ? profile.work_experience
        : [];
      profile.education = Array.isArray(profile.education)
        ? profile.education
        : [];
      profile.certifications = Array.isArray(profile.certifications)
        ? profile.certifications.map((c: any) =>
            typeof c === "string" ? c : c.name || String(c)
          )
        : [];
      profile.skills = Array.isArray(profile.skills) ? profile.skills : [];

      // Sanitize string fields — discard AI placeholders like <UNKNOWN>
      const PLACEHOLDER_RE = /^<[A-Z_]+>$/;
      for (const key of ["full_name", "email", "phone", "location", "summary", "linkedin_url"] as const) {
        if (typeof profile[key] === "string" && PLACEHOLDER_RE.test(profile[key].trim())) {
          profile[key] = null;
        }
      }

      return new Response(
        JSON.stringify({ profile, source: "ai" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If no tool_use block, try to parse text content as JSON
    const textBlock = data.content?.find(
      (block: any) => block.type === "text"
    );
    if (textBlock?.text) {
      try {
        const parsed = JSON.parse(textBlock.text);
        return new Response(
          JSON.stringify({ profile: parsed, source: "ai-text" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch {
        // Text wasn't JSON, fall through to fallback
      }
    }

    // Fallback to regex-based extraction
    console.warn("No tool_use block found in AI response, using fallback");
    const profile = regexFallback(resumeText);
    return new Response(JSON.stringify({ profile, source: "fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Regex-based fallback extraction when AI is unavailable
function regexFallback(text: string) {
  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const phoneMatch = text.match(
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/
  );
  const linkedinMatch = text.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i
  );

  // Try to extract name from first non-empty line
  const lines = text.split("\n").filter((l) => l.trim());
  const nameCandidate = lines[0]?.trim() || "";

  // Extract location - look for "City, ST" pattern
  const locationMatch = text.match(
    /(?:^|\||\n)\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z]{2})\s*(?:\||$|\n)/m
  );

  // Extract skills from a skills section
  const skillsMatch = text.match(
    /(?:SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES)[:\s]*\n?([\s\S]*?)(?:\n\s*\n|\n[A-Z]{2,})/i
  );
  let skills: string[] = [];
  if (skillsMatch) {
    skills = skillsMatch[1]
      .split(/[,\n]/)
      .map((s) => s.replace(/^[-â¢*]\s*/, "").trim())
      .filter((s) => s.length > 0 && s.length < 50);
  }

  // Extract summary
  const summaryMatch = text.match(
    /(?:SUMMARY|PROFESSIONAL SUMMARY|OBJECTIVE|PROFILE)[:\s]*\n?([\s\S]*?)(?:\n\s*\n|\n[A-Z]{2,})/i
  );

  return {
    full_name: nameCandidate,
    email: emailMatch?.[0] || null,
    phone: phoneMatch?.[0] || null,
    location: locationMatch?.[1] || null,
    summary: summaryMatch?.[1]?.trim() || null,
    linkedin_url: linkedinMatch?.[0] || null,
    skills,
    work_experience: [],
    education: [],
    certifications: [],
  };
}

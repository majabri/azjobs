const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Extract fields using regex patterns
    const emailMatch = resumeText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    const phoneMatch = resumeText.match(/(\+?\d[\d\s\-().]{7,}\d)/);
    const linkedinMatch = resumeText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i);

    // Extract name from first non-empty line
    const lines = resumeText.split("\n").map((l: string) => l.trim()).filter(Boolean);
    const fullName = lines.length > 0 ? lines[0].replace(/[^a-zA-Z\s'-]/g, "").trim() : null;

    // Extract skills (common section patterns)
    const skillsSection = resumeText.match(/(?:skills|technical skills|core competencies)[:\s]*([^\n]*(?:\n(?![A-Z][a-z]+ ?[A-Z])[^\n]*)*)/i);
    const skills: string[] = [];
    if (skillsSection) {
      const raw = skillsSection[1];
      raw.split(/[,;•|·\n]/).forEach((s: string) => {
        const cleaned = s.replace(/[-–—]/g, "").trim();
        if (cleaned.length > 1 && cleaned.length < 50) skills.push(cleaned);
      });
    }

    // Extract location
    const locationMatch = resumeText.match(/(?:location|address|city)[:\s]*([^\n]+)/i) ||
      resumeText.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z]{2}(?:\s+\d{5})?)/);
    const location = locationMatch ? locationMatch[1].trim() : null;

    // Extract summary
    const summaryMatch = resumeText.match(/(?:summary|objective|profile|about)[:\s]*\n?([^\n](?:[^\n]*\n?){1,5})/i);
    const summary = summaryMatch ? summaryMatch[1].trim().substring(0, 500) : null;

    const profile = {
      full_name: fullName && fullName.length > 1 ? fullName : null,
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[1].trim() : null,
      location,
      summary,
      skills: skills.length > 0 ? skills : null,
      linkedin_url: linkedinMatch ? linkedinMatch[0] : null,
      work_experience: null,
      education: null,
      certifications: null,
    };

    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

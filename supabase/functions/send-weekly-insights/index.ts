import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    // Get users who want weekly insights
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("user_id")
      .eq("weekly_insights", true);

    if (!prefs?.length) {
      return new Response(JSON.stringify({ message: "No users with weekly insights enabled", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const pref of prefs) {
      const { data: profile } = await supabase
        .from("job_seeker_profiles")
        .select("skills, career_level, full_name, email")
        .eq("user_id", pref.user_id)
        .maybeSingle();

      if (!profile?.email || !profile.skills?.length) continue;

      // Get recent analysis scores
      const { data: history } = await supabase
        .from("analysis_history")
        .select("overall_score, gaps, created_at")
        .eq("user_id", pref.user_id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Generate insights using AI
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Generate 3 brief, actionable career improvement tips. Return JSON array of strings." },
            {
              role: "user",
              content: `Profile: ${profile.career_level || "Unknown"} level, skills: ${profile.skills.slice(0, 10).join(", ")}. Recent scores: ${(history || []).map(h => h.overall_score).join(", ") || "No analyses yet"}. Common gaps: ${(history || []).flatMap(h => (h.gaps as string[]) || []).slice(0, 5).join(", ") || "None"}`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "weekly_tips",
              description: "Return weekly improvement tips",
              parameters: {
                type: "object",
                properties: {
                  tips: { type: "array", items: { type: "string" }, description: "3 actionable tips" },
                },
                required: ["tips"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "weekly_tips" } },
        }),
      });

      if (aiResp.ok) {
        // Tips generated successfully - in production would send email
        processed++;
      }
    }

    return new Response(JSON.stringify({ message: "Weekly insights processed", processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-weekly-insights error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

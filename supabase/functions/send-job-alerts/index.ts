import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get users who want daily alerts
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("user_id, min_match_score")
      .eq("daily_job_alerts", true);

    if (!prefs?.length) {
      return new Response(JSON.stringify({ message: "No users with daily alerts enabled", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const pref of prefs) {
      // Get user profile
      const { data: profile } = await supabase
        .from("job_seeker_profiles")
        .select("skills, target_job_titles, full_name, email")
        .eq("user_id", pref.user_id)
        .maybeSingle();

      if (!profile?.email || !profile.skills?.length) continue;

      // Get recent jobs (last 24h)
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const { data: jobs } = await supabase
        .from("scraped_jobs")
        .select("title, company, location, salary, job_url")
        .gte("created_at", yesterday)
        .eq("is_flagged", false)
        .gte("quality_score", 60)
        .limit(10);

      if (!jobs?.length) continue;

      // Update last_active_at tracking
      await supabase
        .from("job_seeker_profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", pref.user_id);

      processed++;
    }

    return new Response(JSON.stringify({ message: "Job alerts processed", processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-job-alerts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

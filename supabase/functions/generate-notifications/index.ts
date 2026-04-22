import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { type, user_id } = await req.json();
    let notifications: any[] = [];

    if (type === "job_alerts") {
      // Generate job alert notifications for users with daily alerts enabled
      const { data: prefs } = await supabase
        .from("email_preferences")
        .select("user_id, min_match_score")
        .eq("daily_job_alerts", true);

      for (const pref of prefs || []) {
        const { data: profile } = await supabase
          .from("job_seeker_profiles")
          .select("skills, target_job_titles")
          .eq("user_id", pref.user_id)
          .maybeSingle();

        if (!profile?.skills?.length) continue;

        const yesterday = new Date(Date.now() - 86400000).toISOString();
        const { data: jobs } = await supabase
          .from("scraped_jobs")
          .select("title, company")
          .gte("created_at", yesterday)
          .eq("is_flagged", false)
          .gte("quality_score", 60)
          .limit(5);

        if (jobs?.length) {
          notifications.push({
            user_id: pref.user_id,
            type: "job_alert",
            title: `${jobs.length} new job${jobs.length > 1 ? "s" : ""} match your profile`,
            message: jobs
              .map((j: any) => `${j.title} at ${j.company}`)
              .join(", "),
            action_url: "/job-search",
          });
        }
      }
    } else if (type === "weekly_insights") {
      // Generate weekly insight notifications
      const targetId = user_id;
      if (targetId) {
        const { data: analyses } = await supabase
          .from("analysis_history")
          .select("overall_score")
          .eq("user_id", targetId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (analyses?.length) {
          const avg = Math.round(
            analyses.reduce((s: number, a: any) => s + a.overall_score, 0) /
              analyses.length,
          );
          notifications.push({
            user_id: targetId,
            type: "insight",
            title: "Your Weekly Career Insights",
            message: `Your average fit score this week is ${avg}%. ${avg >= 70 ? "Great work! Keep applying to high-match roles." : "Consider optimizing your resume for better matches."}`,
            action_url: "/dashboard",
          });
        }
      }
    } else if (type === "re_engagement") {
      // Nudge inactive users
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: inactive } = await supabase
        .from("job_seeker_profiles")
        .select("user_id, full_name")
        .lt("last_active_at", sevenDaysAgo);

      for (const user of inactive || []) {
        notifications.push({
          user_id: user.user_id,
          type: "nudge",
          title: "We miss you! 🚀",
          message: `${user.full_name || "Hey"}, new jobs are waiting. Come back and check your latest matches.`,
          action_url: "/dashboard",
        });
      }
    }

    if (notifications.length) {
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({ created: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-notifications error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

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
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find users inactive for more than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data: inactiveUsers } = await supabase
      .from("job_seeker_profiles")
      .select("user_id, full_name, email, last_active_at")
      .lt("last_active_at", sevenDaysAgo)
      .not("email", "is", null);

    if (!inactiveUsers?.length) {
      return new Response(JSON.stringify({ message: "No inactive users to re-engage", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const user of inactiveUsers) {
      // Check how many new jobs matched since last active
      const { count } = await supabase
        .from("scraped_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", user.last_active_at || sevenDaysAgo)
        .eq("is_flagged", false);

      // In production, would send re-engagement email with:
      // - "X new jobs matched to your profile since you last visited"
      // - Link back to dashboard
      if ((count || 0) > 0) {
        processed++;
      }
    }

    return new Response(JSON.stringify({ message: "Re-engagement processed", inactive: inactiveUsers.length, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("re-engagement error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// supabase/functions/admin-invite-dashboard/index.ts
// GET /functions/v1/admin-invite-dashboard
// Returns invite analytics for admins.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    if (user.user_metadata?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Total invites sent
    const { count: totalSent } = await supabase
      .from("invitations")
      .select("id", { count: "exact", head: true });

    // Total accepted
    const { count: totalAccepted } = await supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted");

    // Active pending
    const { count: activePending } = await supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    // Conversion rate
    const conversionRate =
      totalSent && totalSent > 0 ? (totalAccepted || 0) / totalSent : 0;

    // Top inviters (top 20 by total sent)
    const { data: topInviters } = await supabase
      .from("invitations")
      .select("inviter_id")
      .then(async (res) => {
        if (!res.data) return { data: [] };

        const counts: Record<string, { sent: number; accepted: number }> = {};
        for (const inv of res.data) {
          if (!counts[inv.inviter_id]) {
            counts[inv.inviter_id] = { sent: 0, accepted: 0 };
          }
          counts[inv.inviter_id].sent++;
        }

        // Get accepted counts
        const { data: acceptedData } = await supabase
          .from("invitations")
          .select("inviter_id")
          .eq("status", "accepted");

        for (const inv of acceptedData || []) {
          if (counts[inv.inviter_id]) {
            counts[inv.inviter_id].accepted++;
          }
        }

        // Get usernames
        const userIds = Object.keys(counts);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, full_name")
          .in("user_id", userIds);

        const profileMap: Record<string, { username?: string; full_name?: string }> = {};
        for (const p of profiles || []) {
          profileMap[p.user_id] = p;
        }

        const sorted = Object.entries(counts)
          .sort(([, a], [, b]) => b.sent - a.sent)
          .slice(0, 20)
          .map(([userId, c]) => ({
            user_id: userId,
            username: profileMap[userId]?.username || profileMap[userId]?.full_name || "Unknown",
            total_sent: c.sent,
            total_accepted: c.accepted,
          }));

        return { data: sorted };
      });

    // Daily activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentInvitations } = await supabase
      .from("invitations")
      .select("created_at, status, accepted_at")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    const dailyActivity: Record<string, { sent: number; accepted: number }> = {};
    for (const inv of recentInvitations || []) {
      const day = inv.created_at.split("T")[0];
      if (!dailyActivity[day]) dailyActivity[day] = { sent: 0, accepted: 0 };
      dailyActivity[day].sent++;
      if (inv.status === "accepted" && inv.accepted_at) {
        const acceptDay = inv.accepted_at.split("T")[0];
        if (!dailyActivity[acceptDay]) dailyActivity[acceptDay] = { sent: 0, accepted: 0 };
        dailyActivity[acceptDay].accepted++;
      }
    }

    // Chain stats
    const { data: chainData } = await supabase
      .from("referral_tree")
      .select("depth");

    let maxDepth = 0;
    let totalDepth = 0;
    const chainCount = chainData?.length || 0;
    for (const entry of chainData || []) {
      if (entry.depth > maxDepth) maxDepth = entry.depth;
      totalDepth += entry.depth;
    }

    // Recent invites (last 50)
    const { data: recentInvites } = await supabase
      .from("invitations")
      .select("id, inviter_id, invitee_email, invite_type, invite_code, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    // Enrich with inviter usernames
    const inviterIds = [...new Set((recentInvites || []).map((i) => i.inviter_id))];
    const { data: inviterProfiles } = await supabase
      .from("profiles")
      .select("user_id, username, full_name")
      .in("user_id", inviterIds);

    const inviterMap: Record<string, string> = {};
    for (const p of inviterProfiles || []) {
      inviterMap[p.user_id] = p.username || p.full_name || "Unknown";
    }

    const enrichedRecent = (recentInvites || []).map((inv) => ({
      ...inv,
      inviter_name: inviterMap[inv.inviter_id] || "Unknown",
    }));

    return new Response(
      JSON.stringify({
        total_invites_sent: totalSent || 0,
        total_accepted: totalAccepted || 0,
        active_pending: activePending || 0,
        conversion_rate: Math.round(conversionRate * 1000) / 1000,
        top_inviters: topInviters || [],
        daily_activity: Object.entries(dailyActivity)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => b.date.localeCompare(a.date)),
        chain_stats: {
          max_depth: maxDepth,
          avg_depth: chainCount > 0 ? Math.round((totalDepth / chainCount) * 10) / 10 : 0,
          total_users_in_tree: chainCount,
        },
        recent_invites: enrichedRecent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

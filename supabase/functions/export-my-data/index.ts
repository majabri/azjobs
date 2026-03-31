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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify the caller is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use service-role client to read across all user-owned tables
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const uid = user.id;

  // Fetch all user data in parallel; use allSettled so a single table error does not abort the export
  const results = await Promise.allSettled([
    adminClient.from("job_seeker_profiles").select("*").eq("user_id", uid).maybeSingle(),
    adminClient.from("resume_versions").select("*").eq("user_id", uid),
    adminClient.from("job_applications").select("*").eq("user_id", uid),
    adminClient.from("analysis_history").select("*").eq("user_id", uid),
    adminClient.from("user_portfolio_items").select("*").eq("user_id", uid),
    adminClient.from("interview_sessions").select("*").eq("user_id", uid),
    adminClient.from("outreach_contacts").select("*").eq("user_id", uid),
    adminClient.from("notifications").select("*").eq("user_id", uid),
    adminClient.from("email_preferences").select("*").eq("user_id", uid).maybeSingle(),
    adminClient.from("learning_events").select("*").eq("user_id", uid),
    adminClient.from("agent_runs").select("*").eq("user_id", uid),
    adminClient.from("offers").select("*").eq("user_id", uid),
    adminClient.from("interview_schedules").select("*").eq("user_id", uid),
    adminClient.from("ignored_jobs").select("*").eq("user_id", uid),
  ]);

  const getData = (result: PromiseSettledResult<any>, single = false) => {
    if (result.status === "fulfilled") return result.value.data ?? (single ? null : []);
    return single ? null : [];
  };

  const [
    profile, resumeVersions, jobApplications, analysisHistory,
    portfolioItems, interviewSessions, outreachContacts, notifications,
    emailPreferences, learningEvents, agentRuns, offers,
    interviewSchedules, ignoredJobs,
  ] = results;

  const exportData = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: getData(profile, true),
    resume_versions: getData(resumeVersions),
    job_applications: getData(jobApplications),
    analysis_history: getData(analysisHistory),
    portfolio_items: getData(portfolioItems),
    interview_sessions: getData(interviewSessions),
    outreach_contacts: getData(outreachContacts),
    notifications: getData(notifications),
    email_preferences: getData(emailPreferences, true),
    learning_events: getData(learningEvents),
    agent_runs: getData(agentRuns),
    offers: getData(offers),
    interview_schedules: getData(interviewSchedules),
    ignored_jobs: getData(ignoredJobs),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="my_data_export_${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
});

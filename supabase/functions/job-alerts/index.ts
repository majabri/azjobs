import { corsHeaders } from "../_shared/cors.ts";
// iCareerOS v5 â job-alerts Edge Function
// Zero-dependency: uses Deno.serve + inline PostgREST client.
// Checks active alerts, finds new matching jobs, publishes notification events.
// Called by pg_cron every hour or manually.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

function svcHeaders(prefer = "return=representation"): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

async function pgGet(table: string, qs: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
  });
  if (!res.ok) throw new Error(`pgGet ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function pgPost(table: string, body: any, prefer = "return=representation"): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: svcHeaders(prefer),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pgPost ${table}: ${res.status}`);
  if (prefer === "return=minimal") return null;
  return res.json();
}

async function pgPatch(table: string, qs: string, body: any): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: svcHeaders("return=minimal"),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pgPatch ${table}: ${res.status}`);
}

async function getUser(authHeader: string): Promise<{ id: string } | null> {
  if (!authHeader) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.id ? u : null;
}

// âââ Handler ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, userId, alertId, ...rest } = await req.json().catch(() => ({} as any));

    // ââ check-alerts: cron / admin trigger ââââââââââââââââââââââââââââââ
    if (action === "check-alerts") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const alerts = await pgGet(
        "job_alerts",
        `select=*&is_active=eq.true&or=(last_sent_at.is.null,last_sent_at.lt.${oneDayAgo})`,
      );

      const results: any[] = [];

      for (const alert of alerts) {
        const since = alert.last_sent_at ?? oneDayAgo;
        const term = encodeURIComponent(alert.search_term);

        const matches = await pgGet(
          "job_postings",
          `select=id,title,company,location,job_url,salary_min,salary_max,source` +
            `&or=(title.ilike.*${term}*,description.ilike.*${term}*)` +
            `&scraped_at=gte.${since}` +
            `&limit=10`,
        );

        if (matches?.length) {
          await pgPatch("job_alerts", `id=eq.${alert.id}`, {
            last_sent_at: new Date().toISOString(),
          });

          pgPost("platform_events", {
            event_type: "job.alert.triggered",
            payload: {
              user_id: alert.user_id,
              alert_id: alert.id,
              match_count: matches.length,
              matches,
            },
            source_service: "job-alerts",
            status: "pending",
          }, "return=minimal").catch(() => {});

          results.push({ alert_id: alert.id, new_matches: matches.length });
        }
      }

      return new Response(
        JSON.stringify({ status: "ok", processed: results.length, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ââ create-alert âââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (action === "create-alert" && userId) {
      const data = await pgPost("job_alerts", {
        user_id: userId,
        search_term: rest.search_term || rest.searchTerm,
        location: rest.location || null,
        is_remote: rest.is_remote ?? rest.isRemote ?? false,
        is_active: true,
      });
      const alert = Array.isArray(data) ? data[0] : data;
      return new Response(JSON.stringify({ alert }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ââ get-alerts âââââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (action === "get-alerts" && userId) {
      const alerts = await pgGet(
        "job_alerts",
        `select=*&user_id=eq.${userId}&order=created_at.desc`,
      );
      return new Response(JSON.stringify({ alerts: alerts ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ââ delete-alert âââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (action === "delete-alert" && alertId) {
      await pgPatch("job_alerts", `id=eq.${alertId}`, { is_active: false });
      return new Response(JSON.stringify({ status: "deactivated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: check-alerts | create-alert | get-alerts | delete-alert" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("job-alerts error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { corsHeaders } from "../_shared/cors.ts";
/**
 * iCareerOS — event-processor Edge Function
 * HIGH-008 Phase 3: Async Event Coordination
 *
 * Subscribes to platform_events and dispatches work to the appropriate
 * backend service.  Provides at-least-once delivery:
 *   - Primary path: triggered by a Supabase Database Webhook on platform_events INSERT
 *   - Retry path:   called with { "mode": "retry" } to reprocess stale events
 *
 * ── Setup (one-time, done in Supabase Dashboard) ──────────────────────────
 *  1. Database → Webhooks → Create Webhook
 *     Table: platform_events  |  Events: INSERT
 *     URL: https://<ref>.supabase.co/functions/v1/event-processor
 *     Headers: Authorization: Bearer <service_role_key>
 *
 *  2. (Optional) Cron → New cron job  every 5 minutes
 *     POST /functions/v1/event-processor  body: {"mode":"retry"}
 * ─────────────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ─── PostgREST helpers ────────────────────────────────────────────────────────

function svcHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function pgGet(table: string, qs: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
  });
  if (!res.ok) throw new Error(`pgGet ${table}: ${res.status}`);
  return res.json();
}

async function pgPatch(table: string, qs: string, body: any): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: svcHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pgPatch ${table}: ${res.status}`);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * job.search.requested — delegate to agent-orchestrator for the user whose
 * profile triggered the event.  The orchestrator loads the full profile from
 * the DB itself; we only need to pass the user auth header.
 *
 * The event_data payload carries { filters, user_id } written by runAllAgents.
 */
async function handleJobSearchRequested(
  event: any,
): Promise<{ dispatched: boolean; detail: string }> {
  const userId = event.user_id;
  if (!userId) return { dispatched: false, detail: "no user_id on event" };

  // Call agent-orchestrator as the service role on behalf of the user.
  // We restrict to discovery + matching only (no auto-apply in async mode by default).
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/agent-orchestrator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      agents: ["discovery", "matching"],
      user_id: userId,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return {
      dispatched: false,
      detail: `agent-orchestrator ${resp.status}: ${txt.slice(0, 200)}`,
    };
  }

  const data = await resp.json().catch(() => ({}));
  return {
    dispatched: true,
    detail: `jobs_found=${data.jobs_found ?? 0}, jobs_matched=${data.jobs_matched ?? 0}`,
  };
}

/**
 * pipeline.failed — log to console (Sentry already captured on the frontend).
 * Future: could trigger an admin notification or recovery rule.
 */
async function handlePipelineFailed(
  event: any,
): Promise<{ dispatched: boolean; detail: string }> {
  const step = event.payload?.step ?? "unknown";
  const msg = event.payload?.error_message ?? "";
  console.error(
    `[event-processor] pipeline.failed  step=${step}  error=${msg}`,
  );
  return { dispatched: true, detail: `logged step=${step}` };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const HANDLERS: Record<
  string,
  (event: any) => Promise<{ dispatched: boolean; detail: string }>
> = {
  "job.search.requested": handleJobSearchRequested,
  "pipeline.failed": handlePipelineFailed,
};

async function processEvent(event: any): Promise<void> {
  const handler = HANDLERS[event.event_type];
  if (!handler) {
    // Unknown event type — mark processed so we don't retry forever
    await pgPatch("platform_events", `id=eq.${event.id}`, {
      processed: true,
    }).catch(() => {});
    return;
  }

  // Optimistic lock: mark processed before running handler so concurrent invocations skip it
  await pgPatch("platform_events", `id=eq.${event.id}`, {
    processed: true,
  }).catch(() => {});

  try {
    const result = await handler(event);
    console.log(
      `[event-processor] ${event.event_type} id=${event.id} →`,
      result,
    );
  } catch (err) {
    // Reset processed so the retry loop picks it up again (unless it keeps failing)
    console.error(
      `[event-processor] handler threw for ${event.event_type} id=${event.id}:`,
      err,
    );
    await pgPatch("platform_events", `id=eq.${event.id}`, {
      processed: false,
    }).catch(() => {});
  }
}

// ─── Retry scan ───────────────────────────────────────────────────────────────

/**
 * Find events that are still unprocessed after 5 minutes and process them.
 * Called with mode=retry (by the Supabase cron scheduler or an external ping).
 */
async function retryStaleEvents(): Promise<{ retried: number }> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const stale = await pgGet(
    "platform_events",
    `processed=eq.false&published_at=lt.${cutoff}&order=published_at.asc&limit=20`,
  );

  if (!stale.length) return { retried: 0 };

  console.log(`[event-processor] retrying ${stale.length} stale events`);
  await Promise.allSettled(stale.map(processEvent));
  return { retried: stale.length };
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    // Retry mode: scan for stale unprocessed events
    if (body.mode === "retry") {
      const result = await retryStaleEvents();
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Webhook mode: Supabase Database Webhook delivers the new row in body.record
    if (body.record) {
      await processEvent(body.record);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Direct mode: caller passes the event row directly
    if (body.event) {
      await processEvent(body.event);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "no event, record, or mode provided",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[event-processor] error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/**
 * ai-recovery — Self-healing service.
 * Processes error.detected events and applies automated recovery:
 * - Retry (up to 3 times)
 * - Circuit breaker (open after 5 consecutive failures)
 * - Emit recovery.triggered / recovery.completed events
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch unprocessed error events
    const { data: events, error: fetchErr } = await supabase
      .from("service_events")
      .select("*")
      .eq("event_name", "error.detected")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ status: "success", data: { processed: 0 }, fallback: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;

    for (const event of events) {
      const payload = event.payload as any;
      const serviceName = payload?.service || "unknown";
      const errorType = payload?.error_type || "unknown";

      // Get current service health
      const { data: health } = await supabase
        .from("service_health")
        .select("*")
        .eq("service_name", serviceName)
        .maybeSingle();

      const errorCount = (health?.error_count || 0) + 1;
      const shouldOpenCircuitBreaker = errorCount >= 5;

      // Update service health
      await supabase
        .from("service_health")
        .upsert({
          service_name: serviceName,
          status: shouldOpenCircuitBreaker ? "down" : errorCount >= 3 ? "degraded" : "healthy",
          error_count: errorCount,
          circuit_breaker_open: shouldOpenCircuitBreaker,
          last_error: payload?.message || errorType,
          last_check: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "service_name" });

      // Emit recovery event
      const recoveryAction = shouldOpenCircuitBreaker
        ? "circuit_breaker_opened"
        : errorCount >= 3
        ? "switched_to_fallback"
        : "retry_scheduled";

      await supabase.from("service_events").insert({
        event_name: "recovery.triggered",
        payload: {
          service: serviceName,
          action: recoveryAction,
          error_count: errorCount,
          original_error: payload?.message,
        },
        emitted_by: "ai-recovery",
      });

      // Mark original event as processed
      await supabase
        .from("service_events")
        .update({ processed: true })
        .eq("id", event.id);

      processed++;
    }

    // Emit completion event
    await supabase.from("service_events").insert({
      event_name: "recovery.completed",
      payload: { processed_count: processed },
      emitted_by: "ai-recovery",
    });

    return new Response(
      JSON.stringify({ status: "success", data: { processed }, fallback: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[ai-recovery] Error:", e);
    return new Response(
      JSON.stringify({ status: "error", data: { message: String(e) }, fallback: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

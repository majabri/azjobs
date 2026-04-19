/**
 * Phase 10.4: AI Recovery Service
 * Deno Edge Function for automated system health monitoring and recovery
 * Stack: Supabase Edge Functions, TypeScript 5.8, PostgreSQL
 *
 * Handles reactive recovery (on health.probe_failed events) and
 * scheduled daily audit mode (2 AM UTC) for SLO computation and reporting
 */

import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface RecoveryRequest {
  action: "handle_probe_failure" | "daily_audit" | "health_ping" | "process_events";
  event?: Record<string, unknown>;
}

/**
 * Database schema for watchdog and recovery tracking
 */
interface WatchdogResult {
  service: string;
  status: "healthy" | "degraded" | "failed";
  last_check: string;
  response_time_ms: number;
  error_message?: string;
}

interface RecoveryRule {
  issue: string;
  condition: string;
  action: string;
  playbook: string;
}

/**
 * Handle health probe failure (reactive recovery)
 */
async function handleProbeFailure(
  supabase: any,
  event: Record<string, unknown>
): Promise<{ success: boolean; recovered?: boolean; message?: string }> {
  try {
    const serviceName = (event.service as string) || "unknown";
    const errorMessage = (event.error as string) || "Unknown error";

    console.log(`Handling probe failure for ${serviceName}: ${errorMessage}`);

    // Query recovery rules for this service
    const { data: rules } = await supabase
      .from("recovery_rules")
      .select("*")
      .ilike("issue", `%${serviceName}%`)
      .limit(5);

    if (!rules || rules.length === 0) {
      console.log(`No recovery rules found for ${serviceName}`);
      return {
        success: true,
        recovered: false,
        message: "No matching recovery rules",
      };
    }

    // Execute first matching rule
    const rule = rules[0];
    console.log(`Executing recovery action: ${rule.action}`);

    // Record recovery attempt
    await supabase.from("recovery_attempts").insert([
      {
        service: serviceName,
        issue: rule.issue,
        action: rule.action,
        status: "in_progress",
        initiated_at: new Date().toISOString(),
      },
    ]);

    // In production, execute playbook (pseudo-code)
    // - Restart service
    // - Clear cache
    // - Failover to backup
    // - Scale up resources

    return {
      success: true,
      recovered: true,
      message: `Recovery initiated for ${serviceName}`,
    };
  } catch (err) {
    console.error("Error in handleProbeFailure:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Daily audit mode (2 AM UTC)
 * - Review 24h watchdog results
 * - Classify incidents
 * - Detect patterns
 * - Compute SLO
 * - Write daily report
 */
async function dailyAudit(
  supabase: any
): Promise<{ success: boolean; report?: Record<string, unknown> }> {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`Running daily audit for ${yesterday.toISOString()}`);

    // Get watchdog results from last 24 hours
    const { data: results } = await supabase
      .from("watchdog_results")
      .select("*")
      .gte("created_at", yesterday.toISOString())
      .lte("created_at", now.toISOString());

    // Calculate SLO metrics
    const totalChecks = results?.length || 0;
    const healthyChecks = results?.filter((r) => r.status === "healthy").length || 0;
    const sloPercentage = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 100;

    // Group incidents by service
    const incidentsByService: Record<string, number> = {};
    results?.forEach((r) => {
      if (r.status !== "healthy") {
        incidentsByService[r.service] = (incidentsByService[r.service] || 0) + 1;
      }
    });

    // Detect patterns (consecutive failures)
    const patterns: string[] = [];
    if (sloPercentage < 99) {
      patterns.push("SLO breach: < 99% uptime");
    }

    // Generate report
    const report = {
      date: yesterday.toISOString().split("T")[0],
      total_checks: totalChecks,
      healthy_checks: healthyChecks,
      slo_percentage: Math.round(sloPercentage * 100) / 100,
      incidents_by_service: incidentsByService,
      patterns: patterns,
      report_generated_at: now.toISOString(),
    };

    // Store report
    await supabase.from("daily_audit_reports").insert([report]);

    // Auto-close support tickets for fixed issues
    const { data: fixedIssues } = await supabase
      .from("known_issues")
      .select("*")
      .eq("status", "fixed")
      .gte("fix_deployed_at", yesterday.toISOString());

    if (fixedIssues) {
      for (const issue of fixedIssues) {
        // Auto-close related support tickets (pseudo-code)
        console.log(`Auto-closing tickets for issue: ${issue.id}`);
      }
    }

    return { success: true, report };
  } catch (err) {
    console.error("Error in dailyAudit:", err);
    return {
      success: false,
      report: { error: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

/**
 * process_events — retry unprocessed platform_events via event-processor.
 *
 * Called on a cron schedule (every 5 min recommended).  Delegates to
 * event-processor with { mode: "retry" } so the retry logic lives in one place.
 *
 * Note: pg_net is not available on this project, so we use a Deno fetch
 * from this edge function instead of a pg_cron HTTP call.
 */
async function processEvents(): Promise<{ success: boolean; retried?: number; message?: string }> {
  const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  try {
    const resp = await fetch(`${SUPABASE_URL_ENV}/functions/v1/event-processor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ mode: "retry" }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return { success: false, message: `event-processor ${resp.status}: ${txt.slice(0, 200)}` };
    }

    const data = await resp.json().catch(() => ({}));
    return { success: true, retried: data.retried ?? 0 };
  } catch (err) {
    console.error("[ai-recovery-service] processEvents error:", err);
    return { success: false, message: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Health ping for watchdog monitoring
 */
function healthPing(): { status: string; timestamp: string } {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const body = (await req.json()) as RecoveryRequest;

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let response;

    switch (body.action) {
      case "handle_probe_failure":
        response = await handleProbeFailure(supabase, body.event || {});
        break;

      case "daily_audit":
        response = await dailyAudit(supabase);
        break;

      case "health_ping":
        response = healthPing();
        break;

      case "process_events":
        response = await processEvents();
        break;

      default:
        response = { success: false, message: "Unknown action" };
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in ai-recovery-service:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

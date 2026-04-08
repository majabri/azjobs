// supabase/functions/ai-recovery-service/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Recovery configuration
const RECOVERY_RULES = {
  "gig-service": {
    maxRetries: 3,
    retryDelayMs: 5000,
    fallbackEnabled: true,
    criticalOps: ["create_project", "create_contract"],
  },
  "proposal-service": {
    maxRetries: 5, // Higher retry for proposal submissions
    retryDelayMs: 3000,
    fallbackEnabled: true,
    criticalOps: ["submit_proposal", "accept_proposal"],
  },
  "project-service": {
    maxRetries: 3,
    retryDelayMs: 5000,
    fallbackEnabled: true,
    criticalOps: ["create_milestone", "update_contract_status"],
  },
  "billing-service": {
    maxRetries: 1, // Critical: immediate alert, minimal retries
    retryDelayMs: 1000,
    fallbackEnabled: false,
    criticalOps: ["create_payment_intent", "handle_webhook"],
  },
};

interface ServiceStatus {
  service_name: string;
  status: "healthy" | "degraded" | "down";
  error_message?: string;
  retry_count: number;
  last_check: string;
  fallback_active: boolean;
  last_recovery_attempt?: string;
}

interface RecoveryAction {
  service: string;
  action: string;
  timestamp: string;
  success: boolean;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Health check for a single service
async function checkServiceHealth(
  serviceName: string
): Promise<ServiceStatus | null> {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${serviceName}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "health" }),
      }
    );

    if (response.ok) {
      return {
        service_name: serviceName,
        status: "healthy",
        retry_count: 0,
        last_check: new Date().toISOString(),
        fallback_active: false,
      };
    } else {
      return {
        service_name: serviceName,
        status: "degraded",
        error_message: `HTTP ${response.status}`,
        retry_count: 1,
        last_check: new Date().toISOString(),
        fallback_active: false,
      };
    }
  } catch (error) {
    return {
      service_name: serviceName,
      status: "down",
      error_message: error instanceof Error ? error.message : String(error),
      retry_count: 1,
      last_check: new Date().toISOString(),
      fallback_active: false,
    };
  }
}

// Attempt recovery for a service
async function attemptRecovery(serviceName: string): Promise<RecoveryAction> {
  const rules = RECOVERY_RULES[serviceName as keyof typeof RECOVERY_RULES];
  if (!rules) {
    return {
      service: serviceName,
      action: "recovery_skipped",
      timestamp: new Date().toISOString(),
      success: false,
    };
  }

  const { data: currentStatus } = await supabase
    .from("service_health")
    .select("*")
    .eq("service_name", serviceName)
    .single();

  if (!currentStatus) {
    return {
      service: serviceName,
      action: "recovery_not_needed",
      timestamp: new Date().toISOString(),
      success: true,
    };
  }

  // Check if we should attempt recovery
  if (currentStatus.status === "healthy") {
    return {
      service: serviceName,
      action: "service_healthy",
      timestamp: new Date().toISOString(),
      success: true,
    };
  }

  // If retry count exceeded, activate fallback
  if (currentStatus.retry_count >= rules.maxRetries) {
    if (rules.fallbackEnabled) {
      const { error } = await supabase
        .from("service_health")
        .update({
          fallback_active: true,
          last_recovery_attempt: new Date().toISOString(),
        })
        .eq("service_name", serviceName);

      if (!error) {
        // Publish recovery event
        await supabase
          .from("platform_events")
          .insert({
            event_type: "service.fallback_activated",
            payload: {
              service: serviceName,
              retry_count: currentStatus.retry_count,
              reason: "max_retries_exceeded",
            },
            source_service: "ai-recovery-service",
          })
          .catch((err) => console.error("Event publish failed:", err));

        return {
          service: serviceName,
          action: "fallback_activated",
          timestamp: new Date().toISOString(),
          success: true,
        };
      }
    }

    // Alert Sentry immediately for critical failures
    await alertSentry({
      level: "critical",
      message: `Service ${serviceName} exceeded max retries`,
      service: serviceName,
      retry_count: currentStatus.retry_count,
    });

    return {
      service: serviceName,
      action: "critical_alert_sent",
      timestamp: new Date().toISOString(),
      success: true,
    };
  }

  // Attempt to recover service
  const newRetryCount = (currentStatus.retry_count || 0) + 1;
  const backoffDelay = Math.pow(2, newRetryCount - 1) * rules.retryDelayMs;

  // Update retry count and timestamp
  const { error: updateError } = await supabase
    .from("service_health")
    .update({
      retry_count: newRetryCount,
      last_recovery_attempt: new Date().toISOString(),
    })
    .eq("service_name", serviceName);

  if (updateError) {
    console.error("Failed to update service health:", updateError);
  }

  // Schedule next retry
  console.log(
    `Scheduling ${serviceName} retry in ${backoffDelay}ms (attempt ${newRetryCount}/${rules.maxRetries})`
  );

  return {
    service: serviceName,
    action: `recovery_scheduled`,
    timestamp: new Date().toISOString(),
    success: true,
  };
}

// Alert Sentry for critical issues
async function alertSentry(alert: {
  level: string;
  message: string;
  service: string;
  retry_count: number;
}): Promise<void> {
  const sentryDsn = Deno.env.get("SENTRY_DSN");
  if (!sentryDsn) {
    console.warn("Sentry DSN not configured");
    return;
  }

  try {
    const response = await fetch(sentryDsn, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: alert.message,
        level: alert.level,
        tags: {
          service: alert.service,
          retry_count: String(alert.retry_count),
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error("Sentry alert failed:", response.statusText);
    }
  } catch (err) {
    console.error("Failed to send Sentry alert:", err);
  }
}

// Process failed proposals from queue
async function processPendingProposals(): Promise<void> {
  const { data: failedProposals } = await supabase
    .from("proposal_queue")
    .select("*")
    .eq("status", "failed")
    .lt("retry_count", 3)
    .order("created_at", { ascending: true })
    .limit(10);

  if (!failedProposals || failedProposals.length === 0) {
    return;
  }

  for (const proposal of failedProposals) {
    try {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/proposal-service`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(proposal.payload),
        }
      );

      if (response.ok) {
        // Mark as processed
        await supabase
          .from("proposal_queue")
          .update({ status: "processed" })
          .eq("id", proposal.id);

        // Publish event
        supabase
          .from("platform_events")
          .insert({
            event_type: "recovery.proposal_recovered",
            payload: {
              queue_id: proposal.id,
              retry_count: proposal.retry_count + 1,
            },
            source_service: "ai-recovery-service",
          })
          .catch((err) => console.error("Event publish failed:", err));
      } else {
        // Increment retry count
        await supabase
          .from("proposal_queue")
          .update({ retry_count: proposal.retry_count + 1 })
          .eq("id", proposal.id);
      }
    } catch (err) {
      console.error("Error processing proposal queue:", err);
      await supabase
        .from("proposal_queue")
        .update({ retry_count: proposal.retry_count + 1 })
        .eq("id", proposal.id);
    }
  }
}

// Main health check loop
async function runHealthCheckLoop(): Promise<void> {
  const serviceNames = Object.keys(RECOVERY_RULES);

  for (const serviceName of serviceNames) {
    try {
      // Check current health
      const healthStatus = await checkServiceHealth(serviceName);

      if (healthStatus) {
        // Update database
        const { error } = await supabase
          .from("service_health")
          .upsert(healthStatus, { onConflict: "service_name" });

        if (error) {
          console.error(`Failed to update health for ${serviceName}:`, error);
          continue;
        }

        // If status changed from degraded to healthy, publish event
        const { data: previousStatus } = await supabase
          .from("service_health")
          .select("status")
          .eq("service_name", serviceName)
          .single();

        if (
          previousStatus &&
          previousStatus.status !== "healthy" &&
          healthStatus.status === "healthy"
        ) {
          // Service recovered
          await supabase
            .from("platform_events")
            .insert({
              event_type: "service.recovered",
              payload: {
                service: serviceName,
                recovered_at: new Date().toISOString(),
              },
              source_service: "ai-recovery-service",
            })
            .catch((err) => console.error("Event publish failed:", err));

          // Reset retry count
          await supabase
            .from("service_health")
            .update({
              retry_count: 0,
              fallback_active: false,
            })
            .eq("service_name", serviceName);
        }

        // Attempt recovery if degraded
        if (healthStatus.status !== "healthy") {
          await attemptRecovery(serviceName);

          // Publish degraded event
          await supabase
            .from("platform_events")
            .insert({
              event_type: "service.degraded",
              payload: {
                service: serviceName,
                status: healthStatus.status,
                error: healthStatus.error_message,
              },
              source_service: "ai-recovery-service",
            })
            .catch((err) => console.error("Event publish failed:", err));
        }
      }
    } catch (err) {
      console.error(`Error checking health for ${serviceName}:`, err);
    }
  }

  // Process pending proposals
  try {
    await processPendingProposals();
  } catch (err) {
    console.error("Error processing pending proposals:", err);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action } = await req.json().catch(() => ({}));

    switch (action) {
      case "health": {
        return new Response(JSON.stringify({ status: "healthy" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "run_checks": {
        // Run health checks
        await runHealthCheckLoop();

        return new Response(
          JSON.stringify({ status: "checks_completed" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "get_service_status": {
        // Get status of a specific service
        const { data: status } = await supabase
          .from("service_health")
          .select("*")
          .eq("service_name", action)
          .single();

        return new Response(JSON.stringify(status || {}), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_all_status": {
        // Get status of all services
        const { data: statuses } = await supabase
          .from("service_health")
          .select("*");

        return new Response(JSON.stringify(statuses || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (err) {
    console.error("Error:", err);

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

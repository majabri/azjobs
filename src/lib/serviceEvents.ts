/**
 * Service Event Emitter — utility to emit events to the service_events table.
 * Used by all service modules to report errors, completions, etc.
 */

import { supabase } from "@/integrations/supabase/client";

export type ServiceEventName =
  | "user.created"
  | "profile.updated"
  | "job.fetched"
  | "match.calculated"
  | "gig.created"
  | "application.submitted"
  | "auto_apply.executed"
  | "error.detected"
  | "recovery.triggered"
  | "recovery.completed";

interface EmitEventOptions {
  eventName: ServiceEventName;
  payload?: Record<string, any>;
  emittedBy: string;
}

/**
 * Emit a service event. Fire-and-forget — never throws.
 */
export async function emitServiceEvent({ eventName, payload = {}, emittedBy }: EmitEventOptions): Promise<void> {
  try {
    await supabase.from("service_events" as any).insert({
      event_name: eventName,
      payload,
      emitted_by: emittedBy,
    } as any);
  } catch (e) {
    // Silent failure — event system should never break the caller
    console.warn("[emitServiceEvent] Failed to emit:", eventName, e);
  }
}

/**
 * Report an error to the self-healing system.
 */
export async function reportServiceError(
  service: string,
  error: unknown,
  context?: Record<string, any>
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await emitServiceEvent({
    eventName: "error.detected",
    payload: {
      service,
      error_type: error instanceof Error ? error.constructor.name : "UnknownError",
      message,
      ...context,
    },
    emittedBy: service,
  });
}

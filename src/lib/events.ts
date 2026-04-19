/**
 * Platform Event Publisher
 *
 * Thin fire-and-forget wrapper around Supabase inserts into platform_events.
 * The caller never awaits — events are always non-blocking so a slow or
 * failed insert cannot break the pipeline that emits them.
 *
 * Usage:
 *   import { publishEvent } from "@/lib/events";
 *   publishEvent("job.search.completed", { job_count: 42, ... }, userId);
 *
 * Phase 2: events are an append-only audit log.
 * Phase 3: database webhooks will trigger edge functions on new rows.
 */

import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";
import type { EventType, EventPayloads } from "@/types/events";

// ─── Publish ──────────────────────────────────────────────────────────────────

/**
 * Emit a structured event to platform_events.  Always fire-and-forget —
 * never throws, never blocks the caller.
 */
export function publishEvent<T extends EventType>(
  eventType: T,
  eventData: T extends keyof EventPayloads ? EventPayloads[T] : Record<string, unknown>,
  userId?: string | null,
): void {
  // Non-blocking insert — we do NOT await this
  supabase
    .from("platform_events")
    .insert({
      event_type: eventType,
      event_data: eventData as Record<string, unknown>,
      user_id: userId ?? null,
      source: "frontend",
    })
    .then(({ error }) => {
      if (error) {
        // Warn locally but never surface to user
        console.warn(`[Events] Failed to publish ${eventType}:`, error.message);
      }
    });
}

/**
 * Emit a pipeline.failed event and forward to Sentry with full event context.
 * Call this whenever a pipeline step throws an unrecoverable error.
 */
export function publishFailureEvent(
  step: string,
  error: unknown,
  durationMs: number,
  userId?: string | null,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Emit to platform_events
  publishEvent(
    "pipeline.failed",
    { step, error_message: errorMessage, duration_ms: durationMs },
    userId,
  );

  // Forward to Sentry with structured context (setExtras — searchable in Sentry UI)
  captureError(error instanceof Error ? error : new Error(errorMessage), {
    event_type: "pipeline.failed",
    pipeline_step: step,
    duration_ms: durationMs,
  });
}

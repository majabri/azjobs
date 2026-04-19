/**
 * Platform Event Types — canonical registry for all pipeline events.
 *
 * Events are emitted by the shell orchestrator after each pipeline step
 * and written to the platform_events Supabase table.  This module is the
 * single source of truth for event type strings and their payloads.
 *
 * Phase 2: events are append-only audit log entries.
 * Phase 3: events will also drive async subscribers via DB webhooks.
 */

// ─── Event Type Registry ──────────────────────────────────────────────────────

export type EventType =
  // Job search pipeline
  | "job.search.requested"    // user triggered a search
  | "job.search.completed"    // searchJobs() returned results
  | "job.scored"              // scoreJobs() finished enriching results
  // Resume / application pipeline
  | "resume.optimized"        // optimize() produced a resume
  | "application.submitted"   // apply() sent applications
  // Failures
  | "pipeline.failed"         // a pipeline step threw an unrecoverable error
  // Future (Phase 3)
  | "pipeline.step.skipped"   // a step was skipped (e.g. no jobs found)
  ;

// ─── Payload shapes per event type ───────────────────────────────────────────

export interface EventPayloads {
  "job.search.requested": {
    filters: Record<string, unknown>;
  };
  "job.search.completed": {
    job_count: number;
    source: string;
    matching_triggered: boolean;
    duration_ms: number;
  };
  "job.scored": {
    jobs_scored: number;
    top_score: number;
    duration_ms: number;
  };
  "resume.optimized": {
    job_titles: string[];
    duration_ms: number;
  };
  "application.submitted": {
    application_count: number;
    duration_ms: number;
  };
  "pipeline.failed": {
    step: string;
    error_message: string;
    duration_ms: number;
  };
  "pipeline.step.skipped": {
    step: string;
    reason: string;
  };
}

// ─── Canonical event record (matches platform_events table) ──────────────────

// Matches the real platform_events table schema (columns pre-existed with these names)
export interface PlatformEvent<T extends EventType = EventType> {
  id?: string;
  event_type: T;
  payload: T extends keyof EventPayloads ? EventPayloads[T] : Record<string, unknown>;
  user_id?: string | null;
  published_at?: string;
  processed?: boolean;
  source_service?: "frontend" | "edge-function" | "cron";
  status?: string | null;
}

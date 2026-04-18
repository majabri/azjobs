-- Phase 3: Critical performance indexes
-- Covers the tables identified in production query analysis.
-- NOTE: CONCURRENTLY removed for compatibility with Supabase Management API.
-- IF NOT EXISTS makes these idempotent.

-- ── job_applications ──────────────────────────────────────────────────────────
-- user_id: used in every RLS policy and user-facing query
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id
  ON public.job_applications(user_id);

-- status: filtering by pipeline stage (applied / interview / offer / rejected)
CREATE INDEX IF NOT EXISTS idx_job_applications_status
  ON public.job_applications(status);

-- applied_at: sorting by recency
CREATE INDEX IF NOT EXISTS idx_job_applications_applied_at
  ON public.job_applications(applied_at DESC);

-- composite: user + status for dashboard queries ("show me my interviews")
CREATE INDEX IF NOT EXISTS idx_job_applications_user_status
  ON public.job_applications(user_id, status);

-- ── job_postings ─────────────────────────────────────────────────────────────
-- user_id (= poster/employer): owner queries
CREATE INDEX IF NOT EXISTS idx_job_postings_user_id
  ON public.job_postings(user_id);

-- created_at: feed ordering
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at
  ON public.job_postings(created_at DESC);

-- composite: status + created_at for "active postings sorted by recency"
CREATE INDEX IF NOT EXISTS idx_job_postings_status_created_at
  ON public.job_postings(status, created_at DESC);

-- Phase 3: Critical performance indexes
-- Covers the tables identified in production query analysis.
-- Uses CONCURRENTLY + IF NOT EXISTS to be safe on live DB.

-- ── job_applications ──────────────────────────────────────────────────────────
-- user_id: used in every RLS policy and user-facing query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_user_id
  ON public.job_applications(user_id);

-- status: filtering by pipeline stage (applied / interview / offer / rejected)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_status
  ON public.job_applications(status);

-- applied_at (= created_at): sorting by recency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_applied_at
  ON public.job_applications(applied_at DESC);

-- composite: user + status for dashboard queries ("show me my interviews")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_user_status
  ON public.job_applications(user_id, status);

-- ── job_postings ─────────────────────────────────────────────────────────────
-- employer_id: employer dashboard queries (all postings by this employer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_postings_employer_id
  ON public.job_postings(employer_id);

-- created_at: feed ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_postings_created_at
  ON public.job_postings(created_at DESC);

-- composite: status + created_at for "active postings sorted by recency"
-- (the most common public browsing query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_postings_status_created_at
  ON public.job_postings(status, created_at DESC);

-- 20260420_add_job_expiry_cron.sql
-- Add daily pg_cron jobs to clean up expired job data.
-- job_postings: expires_at is GENERATED AS (scraped_at + 7 days)
-- Diagnostics (2026-04-20): no expiry cron existed for job_postings

-- Daily cleanup at 3am UTC: delete expired job_postings
SELECT cron.schedule(
  'delete-expired-job-postings',
  '0 3 * * *',
  $$DELETE FROM public.job_postings WHERE expires_at < now()$$
);

-- 3:30am UTC: delete stale discovery_jobs staging rows (30-day retention)
SELECT cron.schedule(
  'delete-stale-discovery-jobs',
  '30 3 * * *',
  $$DELETE FROM public.discovery_jobs WHERE scraped_at < now() - interval '30 days'$$
);

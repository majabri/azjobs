-- ============================================================================
-- Add scraper columns to job_postings + update scraped_jobs VIEW
--
-- Root cause: the April 13 migration (CREATE TABLE IF NOT EXISTS job_postings)
-- was silently skipped because the March 25 employer-postings table already
-- existed. So job_postings has the March 25 schema (user_id, status, etc.)
-- but lacks external_id and scraped_at, causing the Python scraper and
-- job-feeds edge function to fail on upsert.
--
-- This migration:
--   1. Adds the missing scraper columns (external_id, scraped_at, apply_url,
--      remote_type, experience_level) to the existing table
--   2. Updates scraped_jobs VIEW so scraped jobs (external_id IS NOT NULL)
--      show up alongside active employer postings
-- ============================================================================

-- 1. Add scraper columns (IF NOT EXISTS — idempotent)
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS external_id     text,
  ADD COLUMN IF NOT EXISTS scraped_at      timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS apply_url       text,
  ADD COLUMN IF NOT EXISTS remote_type     text,
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS date_posted     timestamptz;

-- Unique constraint on external_id for scraper dedup (ignore if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_postings_external_id_key'
  ) THEN
    ALTER TABLE public.job_postings
      ADD CONSTRAINT job_postings_external_id_key UNIQUE (external_id);
  END IF;
END
$$;

-- Index for scraper freshness queries
CREATE INDEX IF NOT EXISTS idx_job_postings_scraped_at
  ON public.job_postings(scraped_at DESC)
  WHERE external_id IS NOT NULL;

-- 2. Re-create scraped_jobs VIEW to include both employer postings AND scraped jobs
CREATE OR REPLACE VIEW public.scraped_jobs AS
SELECT
  jp.id,
  jp.title,
  jp.company,
  jp.location,
  COALESCE(jp.job_type, jp.remote_type)  AS job_type,
  jp.description,
  jp.external_id                          AS source_id,
  COALESCE(jp.is_remote, jp.remote_type IN ('remote', 'hybrid')) AS is_remote,
  jp.experience_level                     AS seniority,
  CASE
    WHEN jp.salary_min IS NOT NULL AND jp.salary_max IS NOT NULL
      THEN (jp.salary_min + jp.salary_max) / 2
    WHEN jp.salary_max IS NOT NULL THEN jp.salary_max
    WHEN jp.salary_min IS NOT NULL THEN jp.salary_min
    ELSE NULL
  END                                     AS market_rate,
  CASE
    WHEN jp.salary_min IS NOT NULL AND jp.salary_max IS NOT NULL
      THEN '$' || to_char(jp.salary_min, 'FM999,999') || ' - $' || to_char(jp.salary_max, 'FM999,999')
    WHEN jp.salary_max IS NOT NULL THEN 'Up to $' || to_char(jp.salary_max, 'FM999,999')
    WHEN jp.salary_min IS NOT NULL THEN 'From $' || to_char(jp.salary_min, 'FM999,999')
    ELSE NULL
  END                                     AS salary,
  50                                      AS quality_score,
  false                                   AS is_flagged,
  NULL::jsonb                             AS flag_reasons,
  NULL::jsonb                             AS compensation_breakdown,
  NULL::jsonb                             AS salary_range_estimated,
  NULL::text                              AS industry,
  jp.created_at,
  COALESCE(jp.scraped_at, jp.created_at)  AS first_seen_at,
  jp.updated_at                           AS last_seen_at,
  COALESCE(jp.job_url, jp.apply_url)      AS job_url,
  COALESCE(jp.source, 'internal')         AS source
FROM public.job_postings jp
WHERE jp.status = 'active'       -- employer-posted jobs
   OR jp.external_id IS NOT NULL -- scraped / feed-ingested jobs
;

GRANT SELECT ON public.scraped_jobs TO anon, authenticated;

COMMENT ON VIEW public.scraped_jobs IS
  'Unified job feed: active employer postings + externally scraped jobs. '
  'Use external_id IS NOT NULL to identify feed-ingested rows.';

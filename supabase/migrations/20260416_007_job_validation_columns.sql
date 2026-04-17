-- ============================================================================
-- Add real validation columns to job_postings and update scraped_jobs view
--
-- Previously quality_score, is_flagged, flag_reasons were hardcoded constants
-- in the VIEW. This migration promotes them to real columns so the scraper
-- and daily revalidation job can write actual results per job.
--
-- New columns:
--   quality_score   integer      0-100, starts at 50; computed by validator
--   is_flagged      boolean      true when quality_score < 40 (risky job)
--   flag_reasons    text[]       human-readable reasons (e.g. "Scam keyword: commission only")
--   validated_at    timestamptz  last time this job was run through the validator
--   url_valid       boolean      null=unchecked, true=URL responds, false=404/gone
-- ============================================================================

-- 1. Add validation columns (idempotent)
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS quality_score  integer     DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_flagged     boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reasons   text[],
  ADD COLUMN IF NOT EXISTS validated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS url_valid      boolean;

-- 2. Index for daily revalidation query (find jobs not validated in last 24h)
CREATE INDEX IF NOT EXISTS idx_job_postings_validated_at
  ON public.job_postings(validated_at ASC NULLS FIRST)
  WHERE external_id IS NOT NULL;

-- 3. Index for filtering out flagged jobs efficiently
CREATE INDEX IF NOT EXISTS idx_job_postings_flagged
  ON public.job_postings(is_flagged)
  WHERE external_id IS NOT NULL;

-- 4. Rebuild scraped_jobs view to read validation state from real columns
DROP VIEW IF EXISTS public.scraped_jobs CASCADE;

CREATE VIEW public.scraped_jobs AS
SELECT
  jp.id,
  jp.title,
  jp.company,
  jp.location,
  COALESCE(jp.job_type, jp.remote_type)                           AS job_type,

  -- Decode HTML entities and strip tags from scraped descriptions
  trim(regexp_replace(
    regexp_replace(
      replace(replace(replace(replace(replace(replace(replace(
        COALESCE(jp.description, ''),
        '&lt;',  '<'),
        '&gt;',  '>'),
        '&amp;', '&'),
        '&quot;', '"'),
        '&#39;', ''''),
        '&nbsp;', ' '),
        '&#x27;', ''''),
      '<[^>]+>', ' ', 'g'),
    '\s+', ' ', 'g'))                                             AS description,

  jp.external_id                                                  AS source_id,
  COALESCE(jp.is_remote, false)                                   AS is_remote,
  jp.experience_level                                             AS seniority,

  -- Numeric salary midpoint for filtering
  CASE
    WHEN jp.salary_min IS NOT NULL AND jp.salary_max IS NOT NULL
      THEN (jp.salary_min + jp.salary_max) / 2
    WHEN jp.salary_max IS NOT NULL THEN jp.salary_max
    WHEN jp.salary_min IS NOT NULL THEN jp.salary_min
    ELSE NULL
  END                                                             AS market_rate,

  -- Human-readable salary string
  CASE
    WHEN jp.salary_min IS NOT NULL AND jp.salary_max IS NOT NULL
      THEN '$' || to_char(jp.salary_min, 'FM999,999') || ' – $' || to_char(jp.salary_max, 'FM999,999')
    WHEN jp.salary_max IS NOT NULL
      THEN 'Up to $' || to_char(jp.salary_max, 'FM999,999')
    WHEN jp.salary_min IS NOT NULL
      THEN 'From $' || to_char(jp.salary_min, 'FM999,999')
    ELSE NULL
  END                                                             AS salary,

  -- Real validation columns (no longer hardcoded constants)
  COALESCE(jp.quality_score, 50)                                  AS quality_score,
  COALESCE(jp.is_flagged, false)                                  AS is_flagged,
  jp.flag_reasons                                                 AS flag_reasons,
  jp.validated_at,
  jp.url_valid,

  jp.created_at,
  COALESCE(jp.scraped_at, jp.created_at)                         AS first_seen_at,
  COALESCE(jp.job_url, jp.apply_url)                             AS job_url,
  COALESCE(jp.source, 'scraped')                                 AS source

FROM public.job_postings jp
WHERE jp.status = 'active'          -- employer-posted jobs
   OR jp.external_id IS NOT NULL    -- scraper-ingested jobs
;

GRANT SELECT ON public.scraped_jobs TO anon, authenticated;

-- Fix scraped_jobs VIEW to read from job_postings (where the scraper actually writes)
-- and add HTML entity decode + tag strip to description.
--
-- Previous session accidentally pointed the view at the `jobs` table instead of
-- `job_postings`. The Python scraper (job-scraper.yml) inserts into `job_postings`;
-- `jobs` is the Phase-0 ingestion table populated by a different pipeline.
--
-- This restores the correct source while keeping HTML cleanup.

CREATE OR REPLACE VIEW public.scraped_jobs AS
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

  50                                                              AS quality_score,
  false                                                           AS is_flagged,
  NULL::text[]                                                    AS flag_reasons,

  jp.created_at,
  COALESCE(jp.scraped_at, jp.created_at)                         AS first_seen_at,
  COALESCE(jp.job_url, jp.apply_url)                             AS job_url,
  COALESCE(jp.source, 'scraped')                                 AS source

FROM public.job_postings jp
WHERE jp.status = 'active'          -- employer-posted jobs
   OR jp.external_id IS NOT NULL    -- scraper-ingested jobs (external_id set by scraper)
;

GRANT SELECT ON public.scraped_jobs TO anon, authenticated;

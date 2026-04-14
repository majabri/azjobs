-- ============================================================
-- Fix: scraped_jobs view — computed market_rate + seniority
-- ============================================================
-- Context: the previous hotfix created a VIEW named scraped_jobs
-- on top of job_postings to surface employer postings to job seekers.
-- That view left market_rate and seniority as NULL because it did not
-- map salary_min/salary_max to market_rate or experience_level to seniority.
-- This migration re-creates the view with those columns computed.
-- ============================================================

CREATE OR REPLACE VIEW public.scraped_jobs AS
SELECT
  jp.id,
  jp.title,
  jp.company,
  jp.location,

  -- job_type: use job_type column; fall back to remote_type for older rows
  COALESCE(jp.job_type, jp.remote_type) AS job_type,

  jp.description,
  NULL::text  AS source_id,

  -- is_remote: explicit flag takes priority, then infer from remote_type
  COALESCE(
    jp.is_remote,
    jp.remote_type IN ('remote', 'hybrid')
  )           AS is_remote,

  -- FIX: map experience_level to seniority so the career-level filter works
  jp.experience_level AS seniority,

  -- FIX: compute market_rate from salary_min/max so the salary filter works
  CASE
    WHEN jp.salary_min IS NOT NULL AND jp.salary_max IS NOT NULL
      THEN (jp.salary_min + jp.salary_max) / 2
    WHEN jp.salary_max IS NOT NULL THEN jp.salary_max
    WHEN jp.salary_min IS NOT NULL THEN jp.salary_min
    ELSE NULL
  END         AS market_rate,

  -- Human-readable salary string for display
  CASE
    WHEN jp.salary_min IS NOT NULL AND jp.salary_max IS NOT NULL
      THEN '$' || to_char(jp.salary_min, 'FM999,999')
        || ' - $' || to_char(jp.salary_max, 'FM999,999')
    WHEN jp.salary_max IS NOT NULL
      THEN 'Up to $' || to_char(jp.salary_max, 'FM999,999')
    WHEN jp.salary_min IS NOT NULL
      THEN 'From $' || to_char(jp.salary_min, 'FM999,999')
    ELSE NULL
  END         AS salary,

  -- Employer postings start at quality_score 50; no fake-job flags
  50           AS quality_score,
  false        AS is_flagged,
  NULL::jsonb  AS flag_reasons,
  NULL::jsonb  AS compensation_breakdown,
  NULL::jsonb  AS salary_range_estimated,
  NULL::text   AS industry,

  jp.created_at,
  jp.created_at  AS first_seen_at,
  jp.updated_at  AS last_seen_at,
  NULL::text     AS job_url,
  'internal'     AS source

FROM public.job_postings jp
WHERE jp.status = 'active';

-- Grant read access to authenticated users and anon
GRANT SELECT ON public.scraped_jobs TO anon, authenticated;

COMMENT ON VIEW public.scraped_jobs IS
  'Unified job feed: surfaces active employer postings with computed market_rate and seniority for job-seeker search filters.';

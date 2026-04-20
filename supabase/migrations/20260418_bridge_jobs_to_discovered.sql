-- =============================================================================
-- Bridge scraped_jobs + job_postings → discovered_jobs
-- Migration: 20260418_bridge_jobs_to_discovered.sql
--
-- WHY THIS EXISTS:
--   The frontend (OpportunityRadar, job-service.ts) reads ONLY from
--   `discovered_jobs` (per-user, relevance-scored table).
--
--   Two pipelines populate upstream tables but have no path to users:
--     1. GitHub Actions scraper  → job_postings  (every 2h, runs fine)
--     2. Discovery Agent TS fn   → scraped_jobs  (multi-board ATS adapters)
--
--   This migration creates a bridge function that:
--     a. Reads from BOTH job_postings and scraped_jobs
--     b. Matches jobs against each user's target_titles preferences
--     c. Scores matches with a heuristic (title + recency + remote + salary)
--     d. Upserts into discovered_jobs so users immediately see results
--
--   A pg_cron job runs the bridge every 30 minutes.
--   A one-time backfill runs immediately on migration deploy.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Register board/scraper sources missing from job_source_config
--    (FK constraint on discovered_jobs.source_name requires these rows)
-- ---------------------------------------------------------------------------
INSERT INTO job_source_config (source_name, source_type, base_url, priority, is_aggregator)
VALUES
  ('google',         'scrape', 'https://www.google.com/jobs', 75, true),
  ('zip_recruiter',  'scrape', 'https://www.ziprecruiter.com', 70, false),
  ('remoteok',       'scrape', 'https://remoteok.com',        80, false),
  ('greenhouse',     'scrape', NULL,                          85, false),
  ('lever',          'scrape', NULL,                          85, false),
  ('usajobs',        'api',    'https://data.usajobs.gov',    90, false),
  ('adzuna',         'api',    'https://api.adzuna.com',      75, false),
  ('scraper',        'scrape', NULL,                          60, false)
ON CONFLICT (source_name) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. Helpers shared by both bridge sources
-- ---------------------------------------------------------------------------

-- Map job_postings.job_type → discovered_jobs.employment_type
CREATE OR REPLACE FUNCTION _map_job_type(p text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE lower(trim(p))
    WHEN 'fulltime'  THEN 'full_time'  WHEN 'full-time'  THEN 'full_time'
    WHEN 'full_time' THEN 'full_time'  WHEN 'parttime'   THEN 'part_time'
    WHEN 'part-time' THEN 'part_time'  WHEN 'part_time'  THEN 'part_time'
    WHEN 'contract'  THEN 'contract'   WHEN 'contractor' THEN 'contract'
    WHEN 'internship' THEN 'internship' WHEN 'intern'    THEN 'internship'
    WHEN 'temporary' THEN 'temporary'  WHEN 'temp'       THEN 'temporary'
    ELSE 'unknown'
  END;
$$;

-- Map boolean is_remote → location_type
CREATE OR REPLACE FUNCTION _map_location_type(p_remote boolean)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_remote IS TRUE THEN 'remote'
              WHEN p_remote IS FALSE THEN 'onsite'
              ELSE 'unknown' END;
$$;

-- Normalise scraper source string → valid job_source_config.source_name
CREATE OR REPLACE FUNCTION _norm_source(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(trim(p))
    WHEN 'indeed'         THEN 'indeed'
    WHEN 'google'         THEN 'google'
    WHEN 'zip_recruiter'  THEN 'zip_recruiter'
    WHEN 'ziprecruiter'   THEN 'zip_recruiter'
    WHEN 'linkedin'       THEN 'linkedin'
    WHEN 'glassdoor'      THEN 'glassdoor'
    WHEN 'dice'           THEN 'dice'
    WHEN 'remoteok'       THEN 'remoteok'
    WHEN 'greenhouse'     THEN 'greenhouse'
    WHEN 'lever'          THEN 'lever'
    WHEN 'usajobs'        THEN 'usajobs'
    WHEN 'adzuna'         THEN 'adzuna'
    ELSE 'scraper'
  END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Core bridge function
--    Processes both job_postings (Python scraper) and scraped_jobs (TS agent).
--    For each active user: matches title, scores, upserts to discovered_jobs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bridge_jobs_to_discovered(
  p_user_id        uuid    DEFAULT NULL,
  p_max_per_user   integer DEFAULT 200,
  p_lookback_hours integer DEFAULT 48     -- how far back to look in source tables
)
RETURNS TABLE (
  out_user_id  uuid,
  from_postings  integer,
  from_scraped   integer,
  skipped        integer
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefs         RECORD;
  v_job           RECORD;
  v_score         numeric;
  v_days_old      numeric;
  v_dedup_hash    text;
  v_batch_id      uuid;
  v_cnt_postings  integer;
  v_cnt_scraped   integer;
  v_cnt_skipped   integer;
  v_tsquery       tsquery;
  v_source_norm   text;
  v_cutoff        timestamptz;
BEGIN
  v_cutoff := now() - (p_lookback_hours || ' hours')::interval;

  FOR v_prefs IN
    SELECT
      usp.user_id,
      COALESCE(usp.target_titles, ARRAY[]::text[])              AS titles,
      usp.remote_preference,
      usp.salary_min                                             AS u_sal_min,
      usp.salary_max                                             AS u_sal_max
    FROM user_search_preferences usp
    WHERE usp.alerts_enabled = true
      AND (p_user_id IS NULL OR usp.user_id = p_user_id)
  LOOP
    v_cnt_postings := 0;
    v_cnt_scraped  := 0;
    v_cnt_skipped  := 0;
    v_batch_id     := gen_random_uuid();

    -- Build tsquery (best effort; fall back to NULL = accept all)
    BEGIN
      IF array_length(v_prefs.titles, 1) > 0 THEN
        v_tsquery := to_tsquery('english',
          array_to_string(
            ARRAY(SELECT DISTINCT
              regexp_replace(regexp_replace(unnest(v_prefs.titles), '[^a-zA-Z0-9 ]', '', 'g'), '\s+', ' | ', 'g')
            ), ' | '));
      ELSE
        v_tsquery := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN v_tsquery := NULL;
    END;

    -- ---- SOURCE 1: job_postings (GitHub Actions Python scraper) ----
    FOR v_job IN
      SELECT
        j.external_id,
        j.title,
        j.company,
        j.location,
        j.is_remote,
        j.job_type,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.description,
        j.job_url      AS source_url,
        j.source,
        j.date_posted,
        j.scraped_at
      FROM job_postings j
      WHERE j.scraped_at > v_cutoff
        AND (j.expires_at IS NULL OR j.expires_at > now())
        AND (
          array_length(v_prefs.titles, 1) IS NULL
          OR array_length(v_prefs.titles, 1) = 0
          OR (v_tsquery IS NOT NULL
              AND to_tsvector('english', coalesce(j.title,'') || ' ' || coalesce(j.description,''))
                  @@ v_tsquery)
          OR EXISTS (
            SELECT 1 FROM unnest(v_prefs.titles) t(tit)
            WHERE j.title ILIKE '%' || t.tit || '%'
               OR t.tit  ILIKE '%' || j.title || '%'
          )
        )
      ORDER BY j.scraped_at DESC, j.date_posted DESC NULLS LAST
      LIMIT p_max_per_user
    LOOP
      v_days_old    := EXTRACT(EPOCH FROM (now() - COALESCE(v_job.date_posted, v_job.scraped_at))) / 86400.0;
      v_score       := _score_job(v_job.title, v_days_old, v_job.is_remote::boolean,
                                   v_job.salary_min, v_job.salary_max,
                                   v_prefs.titles, v_prefs.remote_preference,
                                   v_prefs.u_sal_min, v_prefs.u_sal_max,
                                   _norm_source(v_job.source));
      v_source_norm := _norm_source(v_job.source);
      BEGIN
        INSERT INTO discovered_jobs (
          user_id, external_id, source_name, source_url, title, title_normalized,
          company_name, description, location, location_type, salary_min, salary_max,
          salary_currency, employment_type, experience_level, posted_at,
          relevance_score, score_breakdown, score_explanation, trust_score, status,
          discovery_batch_id, first_seen_at, last_seen_at, raw_data
        ) VALUES (
          v_prefs.user_id, v_job.external_id, v_source_norm, v_job.source_url,
          v_job.title, lower(trim(v_job.title)), v_job.company, v_job.description,
          v_job.location, _map_location_type(v_job.is_remote), v_job.salary_min,
          v_job.salary_max, COALESCE(v_job.salary_currency,'USD'),
          _map_job_type(v_job.job_type), 'unknown', v_job.date_posted,
          v_score, '{}'::jsonb,
          'Score '||round(v_score)||' via scraper ('||v_source_norm||')',
          75.0, 'scored', v_batch_id, now(), now(),
          jsonb_build_object('source','job_postings','scraped_at',v_job.scraped_at)
        )
        ON CONFLICT (user_id, dedup_hash) DO UPDATE
          SET relevance_score = GREATEST(discovered_jobs.relevance_score, EXCLUDED.relevance_score),
              last_seen_at    = now();
        v_cnt_postings := v_cnt_postings + 1;
      EXCEPTION WHEN OTHERS THEN
        v_cnt_skipped := v_cnt_skipped + 1;
      END;
    END LOOP;

    -- ---- SOURCE 2: discovery_jobs (Discovery Agent TS board adapters) ----
    -- NOTE: scraped_jobs is a VIEW over job_postings (Python scraper) and must
    -- not be touched. Discovery Agent writes to discovery_jobs (real table).
    FOR v_job IN
      SELECT
        s.external_id,
        s.title,
        s.company,
        s.location,
        (s.remote_type = 'remote')                 AS is_remote,
        s.employment_type                           AS job_type,
        s.salary_min,
        s.salary_max,
        s.salary_currency,
        s.description,
        s.source_url,
        s.source_board                              AS source,
        s.posted_at                                 AS date_posted,
        s.scraped_at
      FROM discovery_jobs s
      WHERE s.scraped_at > v_cutoff
        AND (
          array_length(v_prefs.titles, 1) IS NULL
          OR array_length(v_prefs.titles, 1) = 0
          OR (v_tsquery IS NOT NULL
              AND to_tsvector('english', coalesce(s.title,'') || ' ' || coalesce(s.description,''))
                  @@ v_tsquery)
          OR EXISTS (
            SELECT 1 FROM unnest(v_prefs.titles) t(tit)
            WHERE s.title ILIKE '%' || t.tit || '%'
               OR t.tit  ILIKE '%' || s.title || '%'
          )
        )
      ORDER BY s.scraped_at DESC, s.posted_at DESC NULLS LAST
      LIMIT p_max_per_user
    LOOP
      v_days_old    := EXTRACT(EPOCH FROM (now() - COALESCE(v_job.date_posted, v_job.scraped_at))) / 86400.0;
      v_score       := _score_job(v_job.title, v_days_old, v_job.is_remote,
                                   v_job.salary_min, v_job.salary_max,
                                   v_prefs.titles, v_prefs.remote_preference,
                                   v_prefs.u_sal_min, v_prefs.u_sal_max,
                                   _norm_source(v_job.source));
      v_source_norm := _norm_source(v_job.source);
      BEGIN
        INSERT INTO discovered_jobs (
          user_id, external_id, source_name, source_url, title, title_normalized,
          company_name, description, location, location_type, salary_min, salary_max,
          salary_currency, employment_type, experience_level, posted_at,
          relevance_score, score_breakdown, score_explanation, trust_score, status,
          discovery_batch_id, first_seen_at, last_seen_at, raw_data
        ) VALUES (
          v_prefs.user_id, v_job.external_id, v_source_norm, v_job.source_url,
          v_job.title, lower(trim(v_job.title)), v_job.company, v_job.description,
          v_job.location,
          COALESCE(CASE WHEN v_job.is_remote THEN 'remote' ELSE 'onsite' END, 'unknown'),
          v_job.salary_min, v_job.salary_max, COALESCE(v_job.salary_currency,'USD'),
          COALESCE(v_job.job_type, 'unknown'), 'unknown', v_job.date_posted,
          v_score, '{}'::jsonb,
          'Score '||round(v_score)||' via discovery-agent ('||v_source_norm||')',
          85.0, 'scored', v_batch_id, now(), now(),
          jsonb_build_object('source','discovery_jobs','scraped_at',v_job.scraped_at)
        )
        ON CONFLICT (user_id, dedup_hash) DO UPDATE
          SET relevance_score = GREATEST(discovered_jobs.relevance_score, EXCLUDED.relevance_score),
              last_seen_at    = now();
        v_cnt_scraped := v_cnt_scraped + 1;
      EXCEPTION WHEN OTHERS THEN
        v_cnt_skipped := v_cnt_skipped + 1;
      END;
    END LOOP;

    out_user_id   := v_prefs.user_id;
    from_postings := v_cnt_postings;
    from_scraped  := v_cnt_scraped;
    skipped       := v_cnt_skipped;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Inline scoring helper (extracted so bridge body stays readable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _score_job(
  p_title          text,
  p_days_old       numeric,
  p_is_remote      boolean,
  p_sal_min        numeric,
  p_sal_max        numeric,
  p_target_titles  text[],
  p_remote_pref    text,
  p_u_sal_min      numeric,
  p_u_sal_max      numeric,
  p_source         text
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_title_score  numeric := 10;
  v_recency      numeric;
  v_remote       numeric := 0;
  v_salary       numeric := 0;
  v_src          numeric;
BEGIN
  -- Title match (0–40)
  IF EXISTS (SELECT 1 FROM unnest(p_target_titles) t(tit) WHERE lower(p_title) = lower(t.tit)) THEN
    v_title_score := 40;
  ELSIF EXISTS (SELECT 1 FROM unnest(p_target_titles) t(tit) WHERE lower(p_title) ILIKE '%' || lower(t.tit) || '%') THEN
    v_title_score := 30;
  ELSIF array_length(p_target_titles, 1) IS NULL OR array_length(p_target_titles, 1) = 0 THEN
    v_title_score := 20;
  END IF;

  -- Recency (0–20)
  v_recency := GREATEST(0, 20.0 * (1.0 - (COALESCE(p_days_old, 30) / 30.0)));

  -- Remote match (0–15)
  v_remote := CASE
    WHEN p_remote_pref = 'remote'  AND p_is_remote = true  THEN 15
    WHEN p_remote_pref = 'onsite'  AND p_is_remote = false THEN 15
    WHEN p_remote_pref = 'any'                              THEN  8
    ELSE 5
  END;

  -- Salary (0–15)
  IF p_u_sal_min IS NOT NULL AND p_sal_max IS NOT NULL AND p_sal_max >= p_u_sal_min THEN
    v_salary := 15;
  ELSIF p_u_sal_min IS NULL THEN
    v_salary := 5;
  END IF;

  -- Source quality (0–10)
  v_src := CASE p_source
    WHEN 'greenhouse' THEN 10  WHEN 'lever'    THEN 10
    WHEN 'usajobs'    THEN 10  WHEN 'linkedin' THEN 10
    WHEN 'indeed'     THEN  9  WHEN 'remoteok' THEN  8
    WHEN 'adzuna'     THEN  7  ELSE 4
  END;

  RETURN LEAST(100, v_title_score + v_recency + v_remote + v_salary + v_src);
END;
$$;

COMMENT ON FUNCTION bridge_jobs_to_discovered IS
  'Bridges job_postings (scraper) and scraped_jobs (discovery-agent) into '
  'discovered_jobs (user-facing feed). Run every 30 min via pg_cron.';

REVOKE EXECUTE ON FUNCTION bridge_jobs_to_discovered FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION bridge_jobs_to_discovered TO service_role;


-- ---------------------------------------------------------------------------
-- 5. pg_cron: run bridge every 30 minutes
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'bridge-jobs-to-discovered',
  '*/30 * * * *',
  $$SELECT bridge_jobs_to_discovered()$$
);


-- ---------------------------------------------------------------------------
-- 6. Immediate backfill: run now so users see jobs without waiting
--    Uses 30-day lookback so ALL existing scraper data is surfaced.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  total_postings integer := 0;
  total_scraped  integer := 0;
BEGIN
  FOR r IN SELECT * FROM bridge_jobs_to_discovered(NULL, 200, 720) LOOP
    total_postings := total_postings + r.from_postings;
    total_scraped  := total_scraped  + r.from_scraped;
  END LOOP;
  RAISE NOTICE 'Backfill complete: % from job_postings + % from scraped_jobs across all users',
    total_postings, total_scraped;
END;
$$;

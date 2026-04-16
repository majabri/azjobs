-- =============================================================================
-- iCareerOS — Migration 003: Phase 0 Job Ingestion Infrastructure
--
-- Adds the ingestion-specific tables required by the Phase 0 pipeline:
--   jobs              — unified output of all 12 source adapters
--   ingestion_runs    — audit log of every scrape run
--   ingestion_sources — registry of active sources with health stats
--
-- COMPATIBILITY: Additive only. Existing raw_jobs / extracted_jobs tables
-- are untouched. The `jobs` table here feeds raw_jobs via the sourcing bridge.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. jobs — unified ingestion output (all 12 free sources)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                text        NOT NULL,                -- source-native ID
  source_name           text        NOT NULL,                -- 'greenhouse','lever','himalayas', …
  source_type           text        NOT NULL,                -- 'ats_api','aggregator','remote_api','rss_feed','career_page'
  company               text        NOT NULL,
  title                 text        NOT NULL,
  location              text,
  remote_type           text        CHECK (remote_type IN ('remote','hybrid','onsite','unknown')),
  employment_type       text,
  salary_min            numeric,
  salary_max            numeric,
  salary_currency       text        DEFAULT 'USD',
  date_posted           timestamptz,
  date_scraped          timestamptz DEFAULT now() NOT NULL,
  date_last_seen        timestamptz DEFAULT now() NOT NULL,
  application_url       text,
  description           text,
  description_normalized text,
  skills                text[]      DEFAULT '{}',
  job_category          text,
  status                text        DEFAULT 'active'
                          CHECK (status IN ('active','stale','closed')),
  attribution_req       text,                                -- e.g. "Jobs via RemoteOK"
  dedupe_key            text        UNIQUE,                  -- SHA256(title+company+location)
  confidence_score      numeric     DEFAULT 1.0
                          CHECK (confidence_score BETWEEN 0.0 AND 1.0),
  raw_source_reference  jsonb,                               -- full original payload
  created_at            timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status      ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company     ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_date_posted ON jobs(date_posted DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source      ON jobs(source_name);
CREATE INDEX IF NOT EXISTS idx_jobs_remote_type ON jobs(remote_type);
CREATE INDEX IF NOT EXISTS idx_jobs_skills      ON jobs USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_jobs_last_seen   ON jobs(date_last_seen DESC);

-- ---------------------------------------------------------------------------
-- 2. ingestion_runs — audit log for every fetch run
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name     text        NOT NULL,
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  jobs_fetched    integer     DEFAULT 0,
  jobs_inserted   integer     DEFAULT 0,
  jobs_updated    integer     DEFAULT 0,
  jobs_closed     integer     DEFAULT 0,
  errors          jsonb       DEFAULT '[]',
  status          text        DEFAULT 'running'
                    CHECK (status IN ('running','success','failed','partial'))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON ingestion_runs(source_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON ingestion_runs(status, started_at DESC);

-- ---------------------------------------------------------------------------
-- 3. ingestion_sources — registry of all 12 active sources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_sources (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name           text        UNIQUE NOT NULL,
  source_type           text        NOT NULL,
  tier                  integer     NOT NULL,              -- 1=fastest/best, 5=slowest/fallback
  base_url              text,
  requires_key          boolean     DEFAULT false,
  attribution_req       text,
  refresh_hours         integer     DEFAULT 6,
  is_active             boolean     DEFAULT true,
  consecutive_failures  integer     DEFAULT 0,
  last_success_at       timestamptz,
  created_at            timestamptz DEFAULT now()
);

-- Seed all 12 free sources
INSERT INTO ingestion_sources
  (source_name, source_type, tier, refresh_hours, requires_key, attribution_req)
VALUES
  ('greenhouse',      'ats_api',      1,  6,   false, NULL),
  ('lever',           'ats_api',      1,  6,   false, NULL),
  ('ashby',           'ats_api',      1,  6,   false, NULL),
  ('adzuna',          'aggregator',   2,  12,  true,  NULL),
  ('jooble',          'aggregator',   2,  24,  true,  NULL),
  ('himalayas',       'remote_api',   3,  6,   false, 'Jobs via Himalayas'),
  ('remoteok',        'remote_api',   3,  6,   false, 'Jobs via RemoteOK'),
  ('remotive',        'remote_api',   3,  6,   false, 'Jobs via Remotive'),
  ('jobicy',          'remote_api',   3,  12,  false, 'Jobs via Jobicy'),
  ('arbeitnow',       'remote_api',   3,  12,  false, NULL),
  ('weworkremotely',  'rss_feed',     4,  24,  false, NULL),
  ('jsonld_crawl',    'career_page',  5,  24,  false, NULL)
ON CONFLICT (source_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Stale detection function — called by pg_cron nightly
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_stale_jobs()
RETURNS void AS $$
BEGIN
  -- Mark stale (48h unseen)
  UPDATE jobs
  SET status = 'stale'
  WHERE status = 'active'
    AND date_last_seen < now() - INTERVAL '48 hours';

  -- Mark closed (7 days unseen)
  UPDATE jobs
  SET status = 'closed'
  WHERE status IN ('active', 'stale')
    AND date_last_seen < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 5. Reset consecutive_failures when source succeeds
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_source_success(p_source_name text)
RETURNS void AS $$
BEGIN
  UPDATE ingestion_sources
  SET consecutive_failures = 0,
      last_success_at = now()
  WHERE source_name = p_source_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_source_failure(p_source_name text)
RETURNS void AS $$
BEGIN
  UPDATE ingestion_sources
  SET consecutive_failures = consecutive_failures + 1,
      is_active = CASE WHEN consecutive_failures + 1 >= 3 THEN false ELSE is_active END
  WHERE source_name = p_source_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 6. Schedule stale detection via pg_cron (runs at 01:00 UTC daily)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'mark-stale-jobs',
      '0 1 * * *',
      'SELECT mark_stale_jobs()'
    );
  END IF;
END $$;

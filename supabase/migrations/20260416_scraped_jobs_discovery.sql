-- =============================================================================
-- Discovery Agent: staging table + scraper run log
-- Migration: 20260416_scraped_jobs_discovery.sql
--
-- WHY a new table instead of touching scraped_jobs:
--   `scraped_jobs` is an active VIEW over `job_postings` (the Python scraper
--   table). The frontend queries it directly; the bridge cron reads it.
--   Dropping it would break both. Instead we create `discovery_jobs` as a
--   clean staging table for the TS board adapters. The existing
--   bridge_jobs_to_discovered() function is extended (in
--   20260418_bridge_jobs_to_discovered.sql) to also read discovery_jobs.
--
-- Tables created here:
--   discovery_jobs  — one row per job fetched by a board adapter
--   scraper_runs    — one row per adapter invocation (observability)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. discovery_jobs — staging table written by the Discovery Agent adapters.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discovery_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz DEFAULT now(),
  source_board     text        NOT NULL,   -- 'remoteok', 'greenhouse', 'lever', etc.
  source_url       text,
  external_id      text,
  title            text,
  company          text,
  location         text,
  remote_type      text,                   -- 'remote' | 'hybrid' | 'onsite' | null
  employment_type  text,                   -- 'full_time' | 'part_time' | 'contract' | 'internship'
  salary_min       integer,
  salary_max       integer,
  salary_currency  text        DEFAULT 'USD',
  description      text,
  description_html text,
  posted_at        timestamptz,
  scraped_at       timestamptz DEFAULT now(),
  dedupe_hash      text,
  raw_payload      jsonb
);

-- Dedupe: same job on the same board never inserted twice across runs.
CREATE UNIQUE INDEX IF NOT EXISTS discovery_jobs_dedupe_hash_idx
  ON discovery_jobs (dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;

-- Common query patterns.
CREATE INDEX IF NOT EXISTS discovery_jobs_source_board_scraped_at_idx
  ON discovery_jobs (source_board, scraped_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS discovery_jobs_title_trgm_idx
  ON discovery_jobs USING gin (title gin_trgm_ops);

-- RLS: authenticated users can read; only service role may write.
ALTER TABLE discovery_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discovery_jobs readable by authenticated users" ON discovery_jobs;
CREATE POLICY "discovery_jobs readable by authenticated users"
  ON discovery_jobs FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 2. scraper_runs — audit log for every adapter invocation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scraper_runs (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_board              text        NOT NULL,
  search_term               text,
  location                  text,
  started_at                timestamptz DEFAULT now(),
  finished_at               timestamptz,
  status                    text        CHECK (status IN ('running','success','partial','failed')),
  jobs_found                integer     DEFAULT 0,
  jobs_inserted             integer     DEFAULT 0,
  jobs_skipped_duplicate    integer     DEFAULT 0,
  error_message             text,
  http_status               integer
);

CREATE INDEX IF NOT EXISTS scraper_runs_board_started_idx
  ON scraper_runs (source_board, started_at DESC);

ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scraper_runs readable by admins" ON scraper_runs;
CREATE POLICY "scraper_runs readable by admins"
  ON scraper_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- =============================================================================
-- iCareerOS v5 — Job Discovery Microservices
-- Migration 001: Core schema for 6-service pipeline
-- Tables: raw_jobs, extracted_jobs, deduplicated_jobs, job_scores,
--         extraction_feedback, extraction_accuracy, platform_events
--
-- COMPATIBILITY: These are net-new tables. Existing job_postings,
-- discovered_jobs, user_search_preferences are NOT modified.
--
-- BRIDGE NOTE: The job-spy-adapter reads from the existing `job_postings`
-- table (populated by GitHub Actions every 2h) and feeds raw_jobs here.
-- No duplicate scraping. Zero cost increase.
-- =============================================================================

-- Raw jobs (sourced from fetchers — JobSpy bridge + Cowork APIs)
CREATE TABLE IF NOT EXISTS raw_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text        NOT NULL,             -- 'indeed','linkedin','greenhouse','lever', etc
  source_job_id   text        NOT NULL,             -- Original ID from source
  title           text,
  company         text,
  location        text,
  remote_type     text        CHECK (remote_type IN ('remote','hybrid','onsite','unknown')),
  salary_min      integer,
  salary_max      integer,
  url             text        UNIQUE NOT NULL,
  raw_html        text,                             -- HTML from Puppeteer/Cheerio (Cowork APIs)
  raw_json        jsonb,                            -- JSON from API responses
  fetch_method    text        CHECK (fetch_method IN ('jobspy_bridge','cowork_api','puppeteer','cheerio','rss')),
  fetched_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_jobs_source     ON raw_jobs(source);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_url        ON raw_jobs(url);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_fetched    ON raw_jobs(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_source_id  ON raw_jobs(source, source_job_id);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_created ON raw_jobs(created_at DESC);


-- Extracted jobs (structured data parsed by Mistral 7B or Claude)
CREATE TABLE IF NOT EXISTS extracted_jobs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_job_id              uuid        REFERENCES raw_jobs(id) ON DELETE CASCADE,
  source                  text        NOT NULL,
  source_job_id           text,
  title                   text        NOT NULL,
  company                 text        NOT NULL,
  location                text,
  remote_type             text        CHECK (remote_type IN ('remote','hybrid','onsite','unknown')),
  required_skills         text[]      DEFAULT '{}',
  experience_level        text        CHECK (experience_level IN ('entry','mid','senior','executive','unknown')),
  employment_type         text        CHECK (employment_type IN ('full-time','contract','part-time','intern','unknown')),
  job_description_clean   text,                     -- Marketing/boilerplate stripped
  salary_min              integer,
  salary_max              integer,
  currency                text        DEFAULT 'USD',
  confidence_score        float       DEFAULT 0.5   CHECK (confidence_score BETWEEN 0.0 AND 1.0),
  extraction_method       text        CHECK (extraction_method IN ('mistral','claude','fallback_manual')),
  extracted_at            timestamptz,
  created_at              timestamptz DEFAULT now(),

  UNIQUE(raw_job_id)
);

CREATE INDEX IF NOT EXISTS idx_extracted_company    ON extracted_jobs(company);
CREATE INDEX IF NOT EXISTS idx_extracted_skills     ON extracted_jobs USING GIN(required_skills);
CREATE INDEX IF NOT EXISTS idx_extracted_confidence ON extracted_jobs(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_source     ON extracted_jobs(source, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_created ON extracted_jobs(created_at DESC);


-- Deduplicated jobs (1 record per unique title+company+location)
CREATE TABLE IF NOT EXISTS deduplicated_jobs (
  id                        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  title                     text    NOT NULL,
  company                   text    NOT NULL,
  location                  text,
  job_hash                  text    UNIQUE NOT NULL,  -- SHA256(lower(title)||lower(company)||lower(location))
  sources                   jsonb   NOT NULL DEFAULT '[]',
                            -- [{"source":"indeed","job_id":"...","url":"...","seen_at":"..."}]
  source_count              integer GENERATED ALWAYS AS (jsonb_array_length(sources)) STORED,
  primary_extracted_job_id  uuid    REFERENCES extracted_jobs(id),
  deduped_at                timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dedup_hash    ON deduplicated_jobs(job_hash);
CREATE INDEX IF NOT EXISTS idx_dedup_company ON deduplicated_jobs(company);
CREATE INDEX IF NOT EXISTS idx_dedup_title   ON deduplicated_jobs(lower(title));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_dedup_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dedup_updated_at ON deduplicated_jobs;
CREATE TRIGGER trg_dedup_updated_at
  BEFORE UPDATE ON deduplicated_jobs
  FOR EACH ROW EXECUTE FUNCTION update_dedup_jobs_updated_at();


-- Job scores (profile fit — user × deduped job)
CREATE TABLE IF NOT EXISTS job_scores (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  deduplicated_job_id     uuid    REFERENCES deduplicated_jobs(id) ON DELETE CASCADE,
  profile_id              uuid    REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_match_pct         integer CHECK (skill_match_pct BETWEEN 0 AND 100),
  experience_match_pct    integer CHECK (experience_match_pct BETWEEN 0 AND 100),
  location_match_pct      integer CHECK (location_match_pct BETWEEN 0 AND 100),
  salary_match_pct        integer CHECK (salary_match_pct BETWEEN 0 AND 100),
  fit_score               integer CHECK (fit_score BETWEEN 0 AND 100),
  fit_reasoning           text,
  scored_at               timestamptz,
  created_at              timestamptz DEFAULT now(),

  UNIQUE(deduplicated_job_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_profile ON job_scores(profile_id, fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_dedup   ON job_scores(deduplicated_job_id);
CREATE INDEX IF NOT EXISTS idx_scores_top     ON job_scores(profile_id, fit_score DESC) WHERE fit_score >= 60;


-- Extraction feedback (user corrections → learning loop)
CREATE TABLE IF NOT EXISTS extraction_feedback (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  extracted_job_id    uuid    REFERENCES extracted_jobs(id) ON DELETE CASCADE,
  profile_id          uuid    REFERENCES auth.users(id) ON DELETE CASCADE,
  is_correct          boolean,
  corrections         jsonb,  -- {"required_skills": ["actual","skills"], "experience_level": "senior"}
  confidence_before   float,
  feedback_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_job     ON extraction_feedback(extracted_job_id);
CREATE INDEX IF NOT EXISTS idx_feedback_profile ON extraction_feedback(profile_id);
CREATE INDEX IF NOT EXISTS idx_feedback_recent  ON extraction_feedback(feedback_at DESC);


-- Extraction accuracy (per-source learning metrics)
CREATE TABLE IF NOT EXISTS extraction_accuracy (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  source              text    UNIQUE NOT NULL,
  accuracy_7d         float   DEFAULT 0.75,
  accuracy_30d        float   DEFAULT 0.75,
  total_extractions   integer DEFAULT 0,
  total_corrections   integer DEFAULT 0,
  last_retrain        timestamptz,
  prompt_version      integer DEFAULT 1,
  prompt_override     text,   -- Custom prompt for this source when accuracy < 0.80
  updated_at          timestamptz DEFAULT now()
);

-- Seed known sources
INSERT INTO extraction_accuracy (source) VALUES
  ('indeed'),('linkedin'),('greenhouse'),('lever'),('smartrecruiters'),
  ('remotive'),('weworkremotely'),('wellfound'),('ziprecruiter'),
  ('google'),('glassdoor'),('dice')
ON CONFLICT (source) DO NOTHING;


-- Platform events (event bus — services communicate through this table)
CREATE TABLE IF NOT EXISTS platform_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text        NOT NULL,
                            -- 'job.fetched' | 'job.extracted' | 'job.deduped' | 'job.scored'
                            -- | 'extraction.low_confidence' | 'accuracy.degraded'
                            -- | 'batch.fetch_started' | 'batch.extract_started'
  payload       jsonb       NOT NULL DEFAULT '{}',
  consumed_by   text[]      DEFAULT '{}',
  published_at  timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type      ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_published ON platform_events(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_unconsumed
  ON platform_events(event_type, published_at)
  WHERE consumed_by = '{}';

-- Auto-purge events older than 7 days to keep table lean
CREATE OR REPLACE FUNCTION purge_old_platform_events()
RETURNS integer AS $$
DECLARE rows_deleted integer;
BEGIN
  DELETE FROM platform_events WHERE published_at < now() - interval '7 days';
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE raw_jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deduplicated_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_scores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_accuracy  ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_events      ENABLE ROW LEVEL SECURITY;

-- Service role has full access to everything (scrapers, batch jobs)
CREATE POLICY "service_full_raw_jobs"           ON raw_jobs           FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_extracted_jobs"     ON extracted_jobs     FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_deduplicated_jobs"  ON deduplicated_jobs  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_job_scores"         ON job_scores         FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_feedback"           ON extraction_feedback FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_accuracy"           ON extraction_accuracy FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_events"             ON platform_events    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read deduplicated jobs and their own scores
CREATE POLICY "auth_read_dedup_jobs"    ON deduplicated_jobs  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_own_scores"         ON job_scores         FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "auth_own_feedback"       ON extraction_feedback FOR ALL  USING (auth.uid() = profile_id);
CREATE POLICY "auth_read_accuracy"      ON extraction_accuracy FOR SELECT USING (auth.role() = 'authenticated');


-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- Top jobs per user (score >= 60, last 30 days)
CREATE OR REPLACE VIEW user_job_feed AS
SELECT
  dj.id, dj.title, dj.company, dj.location, dj.job_hash,
  ej.remote_type, ej.required_skills, ej.experience_level,
  ej.employment_type, ej.salary_min, ej.salary_max, ej.currency,
  ej.job_description_clean,
  dj.source_count,
  js.fit_score, js.skill_match_pct, js.experience_match_pct,
  js.salary_match_pct, js.fit_reasoning, js.profile_id
FROM deduplicated_jobs dj
JOIN extracted_jobs     ej ON ej.id = dj.primary_extracted_job_id
JOIN job_scores         js ON js.deduplicated_job_id = dj.id
WHERE js.fit_score >= 60
  AND dj.created_at > now() - interval '30 days'
ORDER BY js.fit_score DESC;

-- Pipeline stats (last 24 hours)
CREATE OR REPLACE VIEW pipeline_stats_24h AS
SELECT
  (SELECT count(*) FROM raw_jobs       WHERE created_at   > now() - interval '24h') AS raw_fetched,
  (SELECT count(*) FROM extracted_jobs WHERE extracted_at > now() - interval '24h') AS extracted,
  (SELECT count(*) FROM deduplicated_jobs WHERE created_at > now() - interval '24h') AS deduped,
  (SELECT count(*) FROM job_scores     WHERE scored_at    > now() - interval '24h') AS scored,
  (SELECT count(*) FROM platform_events WHERE published_at > now() - interval '24h') AS events_published,
  (SELECT avg(confidence_score) FROM extracted_jobs WHERE extracted_at > now() - interval '24h') AS avg_confidence;

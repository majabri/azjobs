-- iCareerOS v5 — job_postings table
-- Stores jobs scraped by GitHub Actions every 2 hours.
-- All search queries read from this table. No external API calls at query time.

CREATE TABLE IF NOT EXISTS job_postings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     text        UNIQUE NOT NULL,
  title           text        NOT NULL,
  company         text,
  location        text,
  is_remote       boolean     DEFAULT false,
  job_type        text        CHECK (job_type IN ('fulltime','parttime','contract','internship') OR job_type IS NULL),
  salary_min      integer,
  salary_max      integer,
  salary_currency text        DEFAULT 'USD',
  description     text,
  job_url         text        NOT NULL,
  apply_url       text,
  source          text        NOT NULL,
  date_posted     timestamptz,
  scraped_at      timestamptz DEFAULT now(),
  expires_at      timestamptz GENERATED ALWAYS AS (scraped_at + interval '7 days') STORED
);

CREATE INDEX IF NOT EXISTS idx_job_postings_fts
  ON job_postings USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(company,'') || ' ' || coalesce(description,'')));
CREATE INDEX IF NOT EXISTS idx_job_postings_scraped   ON job_postings(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_expires   ON job_postings(expires_at);
CREATE INDEX IF NOT EXISTS idx_job_postings_source    ON job_postings(source);
CREATE INDEX IF NOT EXISTS idx_job_postings_remote    ON job_postings(is_remote) WHERE is_remote = true;

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read job_postings"   ON job_postings FOR SELECT USING (true);
CREATE POLICY "service write job_postings" ON job_postings FOR ALL   USING (auth.role() = 'service_role');

-- ============================================================================
-- domain_extraction_hints
--
-- Persistent learning table for the adaptive scrape-url agent.
-- Each row represents one domain and records which extraction strategy
-- worked best, how many times, and any learned CSS selectors.
--
-- The edge function reads this on each request to skip failed strategies
-- and try winners first. It writes back outcomes after every extraction.
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_extraction_hints (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain         text        NOT NULL,

  -- Best strategy that succeeded most recently
  -- Values: 'greenhouse-api' | 'lever-api' | 'smartrecruiters-api' |
  --         'breezy-api' | 'ashby-ssr' | 'cheerio:{selector}' |
  --         'login-wall' | 'ip-blocked' | 'html-fetch'
  best_strategy  text,

  -- Learned CSS selector (if cheerio strategy)
  best_selector  text,

  -- Outcome counters
  success_count  integer     NOT NULL DEFAULT 0,
  failure_count  integer     NOT NULL DEFAULT 0,

  -- Timestamps
  last_success_at  timestamptz,
  last_failure_at  timestamptz,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),

  -- Freeform notes from the agent (e.g. "js-rendered", "requires-login")
  notes          text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One row per domain
CREATE UNIQUE INDEX IF NOT EXISTS domain_extraction_hints_domain_idx
  ON domain_extraction_hints(domain);

-- Fast lookups
CREATE INDEX IF NOT EXISTS domain_extraction_hints_strategy_idx
  ON domain_extraction_hints(best_strategy);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_domain_extraction_hints_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_domain_extraction_hints_updated_at ON domain_extraction_hints;
CREATE TRIGGER trg_domain_extraction_hints_updated_at
  BEFORE UPDATE ON domain_extraction_hints
  FOR EACH ROW EXECUTE FUNCTION update_domain_extraction_hints_updated_at();

-- RLS: edge functions use service role key (bypasses RLS)
-- Admins can view via dashboard; users cannot access this table.
ALTER TABLE domain_extraction_hints ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions)
CREATE POLICY "service_role_full_access" ON domain_extraction_hints
  TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated admins to read (for observability dashboard)
CREATE POLICY "admin_read" ON domain_extraction_hints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'support_agent'
    )
  );

COMMENT ON TABLE domain_extraction_hints IS
  'Adaptive learning table for scrape-url. Tracks which strategy + selector '
  'succeeded for each domain so the agent prioritizes winners on future runs.';

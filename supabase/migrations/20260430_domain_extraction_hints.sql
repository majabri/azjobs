-- domain_extraction_hints
-- Adaptive learning table for scrape-url agent.

CREATE TABLE IF NOT EXISTS domain_extraction_hints (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain         text        NOT NULL,
  best_strategy  text,
  best_selector  text,
  success_count  integer     NOT NULL DEFAULT 0,
  failure_count  integer     NOT NULL DEFAULT 0,
  last_success_at  timestamptz,
  last_failure_at  timestamptz,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS domain_extraction_hints_domain_idx
  ON domain_extraction_hints(domain);

CREATE INDEX IF NOT EXISTS domain_extraction_hints_strategy_idx
  ON domain_extraction_hints(best_strategy);

ALTER TABLE domain_extraction_hints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON domain_extraction_hints;
CREATE POLICY "service_role_full_access" ON domain_extraction_hints
  TO service_role USING (true) WITH CHECK (true);

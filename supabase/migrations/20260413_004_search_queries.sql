-- iCareerOS v5 — search_queries table
-- Records every search to power the scraper's dynamic SEARCH_CONFIGS.
-- Top searched terms get added to the scraper automatically.

CREATE TABLE IF NOT EXISTS search_queries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  search_term text        NOT NULL,
  location    text,
  is_remote   boolean,
  result_count integer,
  queried_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_queries_term ON search_queries(search_term);
CREATE INDEX IF NOT EXISTS idx_search_queries_time ON search_queries(queried_at DESC);

ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service write search_queries" ON search_queries FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "users read own queries"       ON search_queries FOR SELECT USING (user_id = auth.uid());

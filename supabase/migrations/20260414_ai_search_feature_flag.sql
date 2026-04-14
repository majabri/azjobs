-- Feature flag to control AI-powered job search (Firecrawl)
-- Currently OFF — operating in database-only mode at zero cost
-- Turn ON when ready to re-enable AI search with a Firecrawl API key
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('ai_search', false, 'Enable AI-powered web search via Firecrawl API (adds external cost)')
ON CONFLICT (key) DO NOTHING;

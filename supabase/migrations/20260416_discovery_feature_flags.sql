-- =============================================================================
-- Discovery Agent: per-board feature flags
-- Migration: 20260416_discovery_feature_flags.sql
--
-- Master switch + one flag per board adapter.
-- All board flags default to false — flip them ON one at a time from
-- /admin/settings after verifying each adapter's data quality.
-- =============================================================================

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('discovery_agent',              true,  'Master switch for Discovery Agent and all board adapters'),
  ('discovery_board_remoteok',     false, 'Enable RemoteOK job board adapter'),
  ('discovery_board_weworkremotely', false, 'Enable WeWorkRemotely adapter'),
  ('discovery_board_greenhouse',   false, 'Enable Greenhouse (employer ATS) adapter'),
  ('discovery_board_lever',        false, 'Enable Lever (employer ATS) adapter'),
  ('discovery_board_usajobs',      false, 'Enable USAJobs.gov official API adapter'),
  ('discovery_board_adzuna',       false, 'Enable Adzuna official API adapter'),
  ('discovery_cache_enabled',      true,  'Cache scraper results for 6 hours to protect upstream boards')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

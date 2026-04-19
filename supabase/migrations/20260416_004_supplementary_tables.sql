-- =============================================================================
-- iCareerOS — Migration 004: Supplementary Tables & Functions
-- Run after: 20260415_001_job_discovery_schema.sql
--
-- Adds tables and functions referenced by TypeScript services but not
-- included in earlier migrations:
--   1. query_cache        — used by cache-service/index.ts (SupabaseCache)
--   2. benchmark_reports  — used by benchmarks/index.ts
--   3. mark_events_consumed() — used by event-bus.ts
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. QUERY CACHE TABLE
-- SupabaseCache class in cache-service/index.ts reads/writes this table.
-- TTL-based: expired rows are deleted on next read (lazy expiry).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS query_cache (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   text        UNIQUE NOT NULL,
  data        jsonb       NOT NULL,
  cached_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  hit_count   integer     NOT NULL DEFAULT 0
);

-- Fast lookup by key (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_query_cache_key
  ON query_cache (cache_key);

-- Enables efficient TTL sweeps and ORDER BY expires_at
CREATE INDEX IF NOT EXISTS idx_query_cache_expires
  ON query_cache (expires_at);

COMMENT ON TABLE query_cache IS
  'Persistent query result cache. TTL enforced lazily on read. Used by SupabaseCache class.';

-- RLS: service role only (no user-facing access)
ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_cache"
  ON query_cache
  USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BENCHMARK REPORTS TABLE
-- BenchmarksService.saveReport() writes daily snapshots here.
-- UNIQUE on report_date prevents duplicate daily runs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date  date        UNIQUE NOT NULL,
  performance  jsonb       NOT NULL,   -- PerformanceMetrics
  coverage     jsonb       NOT NULL,   -- CoverageMetrics
  accuracy     jsonb       NOT NULL,   -- AccuracyMetrics
  cost         jsonb       NOT NULL,   -- CostMetrics
  health       jsonb       NOT NULL,   -- HealthMetrics
  created_at   timestamptz DEFAULT now()
);

-- Fast look up of recent reports (dashboard + alerts)
CREATE INDEX IF NOT EXISTS idx_benchmark_reports_date
  ON benchmark_reports (report_date DESC);

COMMENT ON TABLE benchmark_reports IS
  'Daily pipeline health snapshots written by BenchmarksService.generateReport().';

-- RLS: service role writes, authenticated reads for admin dashboard
ALTER TABLE benchmark_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_write_benchmarks"
  ON benchmark_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_update_benchmarks"
  ON benchmark_reports
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_read_benchmarks"
  ON benchmark_reports
  FOR SELECT
  USING (auth.role() IN ('service_role', 'authenticated'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. mark_events_consumed() FUNCTION
-- Called by EventBus.markConsumed() in event-bus.ts.
-- Appends consumer name to consumed_by array, idempotent.
-- SECURITY DEFINER so it can bypass RLS on platform_events.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_events_consumed(
  p_event_ids uuid[],
  p_consumer  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE platform_events
  SET consumed_by = array_append(consumed_by, p_consumer)
  WHERE id = ANY(p_event_ids)
    AND NOT (p_consumer = ANY(consumed_by));
END;
$$;

COMMENT ON FUNCTION mark_events_consumed IS
  'Marks events as consumed by the given consumer. Idempotent — safe to call multiple times.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. EXPIRED CACHE CLEANUP FUNCTION
-- Called periodically to purge expired cache rows and keep the table lean.
-- Scheduled below via pg_cron.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM query_cache
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_cache IS
  'Deletes expired rows from query_cache. Returns number of rows deleted.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. pg_cron: nightly cache cleanup at 03:00 UTC
-- Runs after stale detection (01:00 UTC) and before benchmarks (07:30 UTC).
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'cleanup-expired-cache',
  '0 3 * * *',  -- 03:00 UTC nightly
  $$SELECT cleanup_expired_cache()$$
);


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- Run after applying migration to confirm all objects were created.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'query_cache' AND table_schema = 'public'
  ), 'query_cache table missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'benchmark_reports' AND table_schema = 'public'
  ), 'benchmark_reports table missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'mark_events_consumed' AND routine_schema = 'public'
  ), 'mark_events_consumed function missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'cleanup_expired_cache' AND routine_schema = 'public'
  ), 'cleanup_expired_cache function missing';

  RAISE NOTICE '✅ Migration 004 verified — all objects created successfully';
END;
$$;

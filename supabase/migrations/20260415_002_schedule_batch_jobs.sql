-- =============================================================================
-- iCareerOS v5 — Job Discovery Microservices
-- Migration 002: pg_cron batch scheduling (SQL-only, no edge function HTTP calls)
--
-- Pipeline schedule (UTC):
--   02:00  → Scraping via GitHub Actions (every 2h, free)
--   03:00  → Fire extraction batch event (GitHub Actions picks up + processes)
--   04:00  → Fire dedup batch event (GitHub Actions picks up + processes)
--   05:00  → Fire score batch event (GitHub Actions picks up + processes)
--   06:00  → Recalculate extraction accuracy stats (pure SQL)
--   Sun 00:00  → Archive stale jobs + purge old events (pure SQL)
--
-- All schedules use pure SQL functions — no HTTP calls, no secrets needed.
-- GitHub Actions workflows run on their own schedule and also react to
-- platform_events via the event-listeners service.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- BATCH TRIGGER FUNCTIONS
-- These insert events into platform_events; TypeScript services react.
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_extract_batch()
RETURNS void AS $$
BEGIN
  INSERT INTO platform_events (event_type, payload)
  VALUES (
    'batch.extract_started',
    jsonb_build_object(
      'triggered_at', now(),
      'source', 'pg_cron',
      'pending_count', (
        SELECT count(*) FROM raw_jobs r
        WHERE NOT EXISTS (
          SELECT 1 FROM extracted_jobs e WHERE e.raw_job_id = r.id
        )
        AND r.created_at > now() - interval '48 hours'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_dedup_batch()
RETURNS void AS $$
BEGIN
  INSERT INTO platform_events (event_type, payload)
  VALUES (
    'batch.dedup_started',
    jsonb_build_object(
      'triggered_at', now(),
      'source', 'pg_cron',
      'pending_count', (
        SELECT count(*) FROM extracted_jobs ej
        WHERE NOT EXISTS (
          SELECT 1 FROM deduplicated_jobs dj
          WHERE dj.primary_extracted_job_id = ej.id
        )
        AND ej.created_at > now() - interval '48 hours'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_score_batch()
RETURNS void AS $$
BEGIN
  INSERT INTO platform_events (event_type, payload)
  VALUES (
    'batch.score_started',
    jsonb_build_object(
      'triggered_at', now(),
      'source', 'pg_cron',
      'unscored_jobs', (
        SELECT count(*) FROM deduplicated_jobs dj
        WHERE dj.created_at > now() - interval '48 hours'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_extraction_accuracy_stats()
RETURNS void AS $$
BEGIN
  -- Recalculate accuracy per source from feedback table
  UPDATE extraction_accuracy ea
  SET
    accuracy_7d = COALESCE((
      SELECT
        sum(CASE WHEN ef.is_correct THEN 1 ELSE 0 END)::float
        / NULLIF(count(*), 0)
      FROM extraction_feedback ef
      JOIN extracted_jobs ej ON ej.id = ef.extracted_job_id
      WHERE ej.source = ea.source
        AND ef.feedback_at > now() - interval '7 days'
    ), ea.accuracy_7d),
    accuracy_30d = COALESCE((
      SELECT
        sum(CASE WHEN ef.is_correct THEN 1 ELSE 0 END)::float
        / NULLIF(count(*), 0)
      FROM extraction_feedback ef
      JOIN extracted_jobs ej ON ej.id = ef.extracted_job_id
      WHERE ej.source = ea.source
        AND ef.feedback_at > now() - interval '30 days'
    ), ea.accuracy_30d),
    total_extractions = (
      SELECT count(*) FROM extracted_jobs WHERE source = ea.source
    ),
    total_corrections = (
      SELECT count(*) FROM extraction_feedback ef
      JOIN extracted_jobs ej ON ej.id = ef.extracted_job_id
      WHERE ej.source = ea.source AND ef.is_correct = false
    ),
    updated_at = now();

  -- Flag sources with accuracy < 80% by publishing an event
  INSERT INTO platform_events (event_type, payload)
  SELECT
    'accuracy.degraded',
    jsonb_build_object(
      'source', source,
      'accuracy_7d', accuracy_7d,
      'prompt_version', prompt_version
    )
  FROM extraction_accuracy
  WHERE accuracy_7d < 0.80
    AND total_extractions > 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION archive_stale_jobs()
RETURNS integer AS $$
DECLARE
  rows_deleted integer := 0;
  n integer;
BEGIN
  -- Nullify raw_html on raw_jobs > 7 days (save storage, keep metadata)
  UPDATE raw_jobs SET raw_html = NULL
  WHERE raw_html IS NOT NULL AND created_at < now() - interval '7 days';

  -- Archive raw_jobs older than 30 days (keep extracted data)
  DELETE FROM raw_jobs WHERE created_at < now() - interval '30 days' AND raw_html IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  rows_deleted := rows_deleted + n;

  -- Purge old platform events (> 7 days)
  SELECT purge_old_platform_events() INTO n;
  rows_deleted := rows_deleted + n;

  -- Purge job_scores for users who haven't logged in in 90 days
  DELETE FROM job_scores
  WHERE profile_id IN (
    SELECT id FROM auth.users
    WHERE last_sign_in_at < now() - interval '90 days'
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  rows_deleted := rows_deleted + n;

  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- pg_cron SCHEDULES (SQL-only — no HTTP calls, no secrets required)
-- =============================================================================

-- 03:00 UTC — fire extraction batch event (GHA job-extractor.yml picks up)
SELECT cron.schedule(
  'jd-extract-batch',
  '0 3 * * *',
  'SELECT trigger_extract_batch()'
);

-- 04:00 UTC — fire dedup batch event (GHA job-deduplicator.yml picks up)
SELECT cron.schedule(
  'jd-dedup-batch',
  '0 4 * * *',
  'SELECT trigger_dedup_batch()'
);

-- 05:00 UTC — fire score/match batch event (GHA job-matcher.yml picks up)
SELECT cron.schedule(
  'jd-score-batch',
  '0 5 * * *',
  'SELECT trigger_score_batch()'
);

-- 06:00 UTC — recalculate extraction accuracy (pure SQL, no service needed)
SELECT cron.schedule(
  'jd-accuracy-update',
  '0 6 * * *',
  'SELECT update_extraction_accuracy_stats()'
);

-- 00:00 UTC Sunday — archive stale data + purge old events
SELECT cron.schedule(
  'jd-archive-stale',
  '0 0 * * 0',
  'SELECT archive_stale_jobs()'
);


-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jd-extract-batch'),
    'jd-extract-batch cron job must exist';
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jd-dedup-batch'),
    'jd-dedup-batch cron job must exist';
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jd-score-batch'),
    'jd-score-batch cron job must exist';
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jd-accuracy-update'),
    'jd-accuracy-update cron job must exist';
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jd-archive-stale'),
    'jd-archive-stale cron job must exist';
  RAISE NOTICE '✅ Migration 002 verified: all 5 pg_cron jobs scheduled';
END $$;


-- =============================================================================
-- MANUAL TEST HELPERS (run from SQL editor to test each stage)
-- =============================================================================

-- Test extraction trigger:
-- SELECT trigger_extract_batch();

-- Test dedup trigger:
-- SELECT trigger_dedup_batch();

-- Test score trigger:
-- SELECT trigger_score_batch();

-- Check pipeline stats:
-- SELECT * FROM pipeline_stats_24h;

-- Check all scheduled jobs:
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;

-- Remove all scheduled jobs (if needed):
-- SELECT cron.unschedule('jd-extract-batch');
-- SELECT cron.unschedule('jd-dedup-batch');
-- SELECT cron.unschedule('jd-score-batch');
-- SELECT cron.unschedule('jd-accuracy-update');
-- SELECT cron.unschedule('jd-archive-stale');

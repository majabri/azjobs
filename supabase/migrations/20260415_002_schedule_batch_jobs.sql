-- =============================================================================
-- iCareerOS v5 — Job Discovery Microservices
-- Migration 002: pg_cron batch scheduling
--
-- Pipeline schedule (UTC):
--   02:00  → Scraping already running via GitHub Actions (every 2h, free)
--   03:00  → Extract: raw_jobs → extracted_jobs (Mistral batch)
--   04:00  → Deduplicate: extracted_jobs → deduplicated_jobs
--   05:00  → Score: deduplicated_jobs × user_profiles → job_scores
--   06:00  → Accuracy update: recalculate extraction_accuracy per source
--   08:00  → Daily job alerts (existing job-alerts edge function)
--   00:00  → Weekly: purge old events + archive stale data
--
-- HOW TO DEPLOY:
--   1. Replace <SUPABASE_URL> with: https://bryoehuhhhjqcueomgev.supabase.co
--   2. Replace <SERVICE_ROLE_KEY> with your actual service_role key
--   3. Run from Supabase dashboard SQL editor
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;  -- Required for HTTP calls from pg_cron

-- =============================================================================
-- BATCH TRIGGER FUNCTIONS
-- These fire events into platform_events; the TypeScript services poll/react.
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
    AND total_extractions > 10;  -- Only flag if we have enough data
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION archive_stale_jobs()
RETURNS integer AS $$
DECLARE
  rows_deleted integer := 0;
  n integer;
BEGIN
  -- Archive raw_jobs older than 30 days (keep extracted data)
  DELETE FROM raw_jobs WHERE created_at < now() - interval '30 days' AND raw_html IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  rows_deleted := rows_deleted + n;

  -- Nullify raw_html on raw_jobs > 7 days (save storage, keep metadata)
  UPDATE raw_jobs SET raw_html = NULL
  WHERE raw_html IS NOT NULL AND created_at < now() - interval '7 days';

  -- Purge old platform events
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
-- EDGE FUNCTION TRIGGERS (via pg_net HTTP calls)
-- Replace <SUPABASE_URL> and <SERVICE_ROLE_KEY> before running
-- =============================================================================

-- 03:00 UTC — Trigger extraction batch via Edge Function
SELECT cron.schedule(
  'jd-extract-batch',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := '<SUPABASE_URL>/functions/v1/jd-extraction-runner',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type',  'application/json'
    ),
    body    := '{"mode":"batch","limit":500}'::jsonb
  );
  $$
);

-- 04:00 UTC — Trigger deduplication
SELECT cron.schedule(
  'jd-dedup-batch',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := '<SUPABASE_URL>/functions/v1/jd-dedup-runner',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type',  'application/json'
    ),
    body    := '{"mode":"batch"}'::jsonb
  );
  $$
);

-- 05:00 UTC — Trigger profile matching / scoring
SELECT cron.schedule(
  'jd-score-batch',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url     := '<SUPABASE_URL>/functions/v1/jd-matching-runner',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type',  'application/json'
    ),
    body    := '{"mode":"batch"}'::jsonb
  );
  $$
);

-- 06:00 UTC — Recalculate extraction accuracy stats (pure SQL, no edge fn needed)
SELECT cron.schedule(
  'jd-accuracy-update',
  '0 6 * * *',
  'SELECT update_extraction_accuracy_stats()'
);

-- 00:00 UTC Sunday — Archive stale data
SELECT cron.schedule(
  'jd-archive-stale',
  '0 0 * * 0',
  'SELECT archive_stale_jobs()'
);


-- =============================================================================
-- MANUAL BATCH TRIGGERS (for testing without waiting for cron)
-- Run these from Supabase SQL editor to test each stage
-- =============================================================================

-- Test extraction trigger:
-- SELECT trigger_extract_batch();

-- Test dedup trigger:
-- SELECT trigger_dedup_batch();

-- Test score trigger:
-- SELECT trigger_score_batch();

-- Check pipeline stats:
-- SELECT * FROM pipeline_stats_24h;

-- Check scheduled jobs:
-- SELECT * FROM cron.job;

-- Remove all scheduled jobs (if needed):
-- SELECT cron.unschedule('jd-extract-batch');
-- SELECT cron.unschedule('jd-dedup-batch');
-- SELECT cron.unschedule('jd-score-batch');
-- SELECT cron.unschedule('jd-accuracy-update');
-- SELECT cron.unschedule('jd-archive-stale');

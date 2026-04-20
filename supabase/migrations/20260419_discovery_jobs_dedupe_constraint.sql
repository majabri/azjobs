-- 20260419_discovery_jobs_dedupe_constraint.sql
-- Replace partial unique index on discovery_jobs.dedupe_hash with a full unique
-- constraint so that PostgREST ON CONFLICT (col) DO NOTHING works correctly.
-- (PostgREST requires a non-partial, non-filtered unique index for the upsert
--  onConflict path — a WHERE clause in the index definition breaks it.)

-- Drop the partial index created in the initial migration
DROP INDEX IF EXISTS discovery_jobs_dedupe_hash_idx;

-- Add a proper full unique constraint
ALTER TABLE discovery_jobs
  ADD CONSTRAINT discovery_jobs_dedupe_hash_key UNIQUE (dedupe_hash);

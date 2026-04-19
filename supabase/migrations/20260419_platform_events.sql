-- Platform Events — append-only audit log for the iCareerOS agent pipeline
-- Created for HIGH-008 Phase 2: Event Logging
--
-- This table records every significant action taken by the orchestrator,
-- providing a full audit trail and the foundation for async event coordination
-- in Phase 3.  Consumers never DELETE from this table — set processed = true
-- or archive rows instead.

CREATE TABLE IF NOT EXISTS platform_events (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type   text        NOT NULL,                          -- e.g. 'job.search.completed'
  event_data   jsonb       NOT NULL DEFAULT '{}',             -- structured payload
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  processed    boolean     NOT NULL DEFAULT false,            -- for Phase 3 async subscribers
  source       text        NOT NULL DEFAULT 'frontend'        -- 'frontend' | 'edge-function' | 'cron'
    CHECK (source IN ('frontend', 'edge-function', 'cron'))
);

-- Query patterns: by type + time, by user + time
CREATE INDEX IF NOT EXISTS platform_events_type_published_at
  ON platform_events (event_type, published_at DESC);

CREATE INDEX IF NOT EXISTS platform_events_user_published_at
  ON platform_events (user_id, published_at DESC)
  WHERE user_id IS NOT NULL;

-- Partial index for Phase 3: quickly find events awaiting processing
CREATE INDEX IF NOT EXISTS platform_events_unprocessed
  ON platform_events (published_at ASC)
  WHERE processed = false;

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by edge functions + cron)
CREATE POLICY "Service role full access platform_events"
  ON platform_events FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can insert their own events (frontend publisher)
CREATE POLICY "Authenticated users insert own events"
  ON platform_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Authenticated users can read their own events
CREATE POLICY "Authenticated users read own events"
  ON platform_events FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all events
CREATE POLICY "Admin read all platform_events"
  ON platform_events FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

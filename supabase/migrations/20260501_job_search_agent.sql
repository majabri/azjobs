-- ============================================================================
-- Job Search Agent Infrastructure
--
-- Tables:
--   user_job_matches  — AI-scored fit results per user/job
--   job_alerts        — User alert subscriptions
--   job_feed_log      — Audit log of live feed fetches
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_job_matches
-- Stores Claude AI match scores for every user/job pair.
-- Populated by match-jobs edge function; read by discover-jobs for enrichment.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_job_matches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id          uuid        NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,

  -- AI-computed fit score 0–100
  fit_score       integer     NOT NULL CHECK (fit_score BETWEEN 0 AND 100),

  -- Matched skills (subset of user's skills found in job description)
  matched_skills  text[]      NOT NULL DEFAULT '{}',

  -- Skills the job requires that the user lacks
  skill_gaps      text[]      NOT NULL DEFAULT '{}',

  -- Top strengths and red flags from Claude
  strengths       text[]      NOT NULL DEFAULT '{}',
  red_flags       text[]      NOT NULL DEFAULT '{}',

  -- One-line match summary
  match_summary   text,

  -- Effort estimate: 'easy' | 'moderate' | 'hard'
  effort_level    text        CHECK (effort_level IN ('easy','moderate','hard')),

  -- Response probability estimate 0–100
  response_prob   integer     CHECK (response_prob BETWEEN 0 AND 100),

  -- Smart tag: 'hot_match' | 'stretch' | 'apply_fast' | 'low_roi' | 'good_fit' | 'reach'
  smart_tag       text,

  -- User interaction
  is_seen         boolean     NOT NULL DEFAULT false,
  is_saved        boolean     NOT NULL DEFAULT false,
  is_ignored      boolean     NOT NULL DEFAULT false,
  is_applied      boolean     NOT NULL DEFAULT false,

  scored_at       timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS user_job_matches_user_score_idx
  ON user_job_matches(user_id, fit_score DESC);

CREATE INDEX IF NOT EXISTS user_job_matches_user_seen_idx
  ON user_job_matches(user_id, is_seen, is_ignored);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_user_job_matches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_job_matches_updated_at ON user_job_matches;
CREATE TRIGGER trg_user_job_matches_updated_at
  BEFORE UPDATE ON user_job_matches
  FOR EACH ROW EXECUTE FUNCTION update_user_job_matches_updated_at();

-- RLS
ALTER TABLE user_job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_matches" ON user_job_matches
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_full" ON user_job_matches
  TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- job_alerts
-- User subscriptions: "notify me when new {query} jobs appear"
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS job_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert criteria (any combination)
  name            text        NOT NULL DEFAULT 'Job Alert',
  search_query    text,               -- free-text keywords
  location        text,
  is_remote       boolean,
  job_type        text,
  min_fit_score   integer     DEFAULT 70 CHECK (min_fit_score BETWEEN 0 AND 100),
  salary_min      integer,

  -- Delivery settings
  frequency       text        NOT NULL DEFAULT 'daily'
                              CHECK (frequency IN ('realtime','daily','weekly')),
  is_active       boolean     NOT NULL DEFAULT true,

  -- Tracking
  last_sent_at    timestamptz,
  match_count     integer     NOT NULL DEFAULT 0,  -- total jobs sent via this alert

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_alerts_user_active_idx
  ON job_alerts(user_id, is_active);

CREATE INDEX IF NOT EXISTS job_alerts_frequency_idx
  ON job_alerts(frequency, is_active, last_sent_at);

ALTER TABLE job_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_alerts" ON job_alerts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_full_alerts" ON job_alerts
  TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- job_feed_log
-- Audit log of every live feed fetch (how many jobs ingested, errors, etc.)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS job_feed_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text        NOT NULL,    -- 'remotive' | 'weworkremotely' | 'greenhouse:{board}' | etc.
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  jobs_found    integer     NOT NULL DEFAULT 0,
  jobs_new      integer     NOT NULL DEFAULT 0,
  jobs_updated  integer     NOT NULL DEFAULT 0,
  error         text,
  duration_ms   integer
);

CREATE INDEX IF NOT EXISTS job_feed_log_source_idx ON job_feed_log(source, fetched_at DESC);

ALTER TABLE job_feed_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON job_feed_log TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_feed_log" ON job_feed_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'support_agent'
  ));

-- ----------------------------------------------------------------------------
-- RPC: mark jobs as seen / saved / ignored
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mark_job_interaction(
  p_user_id  uuid,
  p_job_id   uuid,
  p_action   text  -- 'seen' | 'saved' | 'ignored' | 'applied'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_job_matches (user_id, job_id, fit_score, is_seen, is_saved, is_ignored, is_applied)
    VALUES (
      p_user_id, p_job_id, 0,
      p_action = 'seen',
      p_action = 'saved',
      p_action = 'ignored',
      p_action = 'applied'
    )
  ON CONFLICT (user_id, job_id)
  DO UPDATE SET
    is_seen    = CASE WHEN p_action = 'seen'    THEN true ELSE user_job_matches.is_seen END,
    is_saved   = CASE WHEN p_action = 'saved'   THEN true ELSE user_job_matches.is_saved END,
    is_ignored = CASE WHEN p_action = 'ignored' THEN true ELSE user_job_matches.is_ignored END,
    is_applied = CASE WHEN p_action = 'applied' THEN true ELSE user_job_matches.is_applied END,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION mark_job_interaction(uuid, uuid, text) TO authenticated, service_role;

COMMENT ON TABLE user_job_matches IS
  'AI-scored fit results per user/job. Populated by match-jobs edge function. '
  'Read by discover-jobs for enriched search results.';

COMMENT ON TABLE job_alerts IS
  'User job alert subscriptions. Processed by job-alerts edge function on schedule.';

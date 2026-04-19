-- Job Search Agent Infrastructure
-- Tables: user_job_matches, job_alerts, job_feed_log
-- RPC:    mark_job_interaction

-- user_job_matches — AI fit scores per user/job
CREATE TABLE IF NOT EXISTS user_job_matches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id          uuid        NOT NULL,
  fit_score       integer     NOT NULL DEFAULT 0 CHECK (fit_score BETWEEN 0 AND 100),
  matched_skills  text[]      NOT NULL DEFAULT '{}',
  skill_gaps      text[]      NOT NULL DEFAULT '{}',
  strengths       text[]      NOT NULL DEFAULT '{}',
  red_flags       text[]      NOT NULL DEFAULT '{}',
  match_summary   text,
  effort_level    text        CHECK (effort_level IN ('easy','moderate','hard')),
  response_prob   integer     CHECK (response_prob BETWEEN 0 AND 100),
  smart_tag       text,
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

ALTER TABLE user_job_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_matches" ON user_job_matches;
CREATE POLICY "users_own_matches" ON user_job_matches
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_full_ujm" ON user_job_matches;
CREATE POLICY "service_role_full_ujm" ON user_job_matches
  TO service_role USING (true) WITH CHECK (true);

-- job_alerts — user alert subscriptions
CREATE TABLE IF NOT EXISTS job_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL DEFAULT 'Job Alert',
  search_query    text,
  location        text,
  is_remote       boolean,
  job_type        text,
  min_fit_score   integer     DEFAULT 70 CHECK (min_fit_score BETWEEN 0 AND 100),
  salary_min      integer,
  frequency       text        NOT NULL DEFAULT 'daily'
                              CHECK (frequency IN ('realtime','daily','weekly')),
  is_active       boolean     NOT NULL DEFAULT true,
  last_sent_at    timestamptz,
  match_count     integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_alerts_user_active_idx ON job_alerts(user_id, is_active);

ALTER TABLE job_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_alerts" ON job_alerts;
CREATE POLICY "users_own_alerts" ON job_alerts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_full_alerts" ON job_alerts;
CREATE POLICY "service_role_full_alerts" ON job_alerts
  TO service_role USING (true) WITH CHECK (true);

-- job_feed_log — audit log
CREATE TABLE IF NOT EXISTS job_feed_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text        NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  jobs_found    integer     NOT NULL DEFAULT 0,
  jobs_new      integer     NOT NULL DEFAULT 0,
  jobs_updated  integer     NOT NULL DEFAULT 0,
  error         text,
  duration_ms   integer
);

CREATE INDEX IF NOT EXISTS job_feed_log_source_idx ON job_feed_log(source, fetched_at DESC);

ALTER TABLE job_feed_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_feed_log" ON job_feed_log;
CREATE POLICY "service_role_feed_log" ON job_feed_log
  TO service_role USING (true) WITH CHECK (true);

-- mark_job_interaction RPC
CREATE OR REPLACE FUNCTION mark_job_interaction(
  p_user_id  uuid,
  p_job_id   uuid,
  p_action   text
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
  ON CONFLICT (user_id, job_id) DO UPDATE SET
    is_seen    = CASE WHEN p_action = 'seen'    THEN true ELSE user_job_matches.is_seen END,
    is_saved   = CASE WHEN p_action = 'saved'   THEN true ELSE user_job_matches.is_saved END,
    is_ignored = CASE WHEN p_action = 'ignored' THEN true ELSE user_job_matches.is_ignored END,
    is_applied = CASE WHEN p_action = 'applied' THEN true ELSE user_job_matches.is_applied END,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION mark_job_interaction(uuid, uuid, text) TO authenticated, service_role;

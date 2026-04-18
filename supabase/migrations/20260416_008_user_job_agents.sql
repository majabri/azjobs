-- ============================================================================
-- user_job_agents — Per-user job search agent state
--
-- One row per user. Tracks whether the agent needs to re-run (pending),
-- is currently running, idling with fresh results, or sleeping between cycles.
--
-- Lifecycle:
--   INSERT on first profile save      → status = 'pending'
--   Profile matching fields changed   → status = 'pending', next_run_at = now()
--   Agent starts running              → status = 'running'
--   Agent finishes                    → status = 'idle', next_run_at = now() + 8h
--   User is away > 8h                 → next_run_at <= now() → runs on next login
--
-- The run-job-agent edge function reads this table to decide whether to serve
-- cached user_job_matches or run a fresh discovery + scoring pass.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_job_agents (
  user_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','running','idle','sleeping')),
  last_run_at        timestamptz,
  next_run_at        timestamptz NOT NULL DEFAULT now(),
  last_profile_hash  text,                        -- SHA-256 prefix of matching-relevant fields
  match_count        integer     NOT NULL DEFAULT 0,
  run_count          integer     NOT NULL DEFAULT 0,
  last_error         text,
  config             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Index: find users whose agent is due to run (background job / cron use)
CREATE INDEX IF NOT EXISTS idx_user_job_agents_next_run
  ON user_job_agents(next_run_at ASC)
  WHERE status IN ('pending', 'sleeping');

ALTER TABLE user_job_agents ENABLE ROW LEVEL SECURITY;

-- Users can read their own agent state (for status polling)
CREATE POLICY "users_read_own_agent"
  ON user_job_agents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access (edge functions use service key)
CREATE POLICY "service_role_full_agent"
  ON user_job_agents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- Profile-change trigger
--
-- When matching-relevant fields change on job_seeker_profiles, mark the
-- user's agent as 'pending' so the next login triggers a fresh run.
-- Also creates the agent row on first profile insert.
-- ============================================================================

CREATE OR REPLACE FUNCTION _mark_agent_pending()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_job_agents(user_id, status, next_run_at, updated_at)
  VALUES (NEW.user_id, 'pending', now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    status      = 'pending',
    next_run_at = now(),
    last_error  = NULL,
    updated_at  = now();
  RETURN NEW;
END;
$$;

-- Trigger on profile INSERT (new user completes onboarding)
DROP TRIGGER IF EXISTS trg_profile_insert_agent ON job_seeker_profiles;
CREATE TRIGGER trg_profile_insert_agent
  AFTER INSERT ON job_seeker_profiles
  FOR EACH ROW EXECUTE FUNCTION _mark_agent_pending();

-- Trigger on profile UPDATE — only when matching fields change
CREATE OR REPLACE FUNCTION _mark_agent_pending_on_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (
    OLD.skills              IS DISTINCT FROM NEW.skills              OR
    OLD.target_job_titles   IS DISTINCT FROM NEW.target_job_titles   OR
    OLD.career_level        IS DISTINCT FROM NEW.career_level        OR
    OLD.location            IS DISTINCT FROM NEW.location            OR
    OLD.preferred_job_types IS DISTINCT FROM NEW.preferred_job_types OR
    OLD.salary_min          IS DISTINCT FROM NEW.salary_min          OR
    OLD.salary_max          IS DISTINCT FROM NEW.salary_max
  ) THEN
    INSERT INTO user_job_agents(user_id, status, next_run_at, updated_at)
    VALUES (NEW.user_id, 'pending', now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      status      = 'pending',
      next_run_at = now(),
      last_error  = NULL,
      updated_at  = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_update_agent ON job_seeker_profiles;
CREATE TRIGGER trg_profile_update_agent
  AFTER UPDATE ON job_seeker_profiles
  FOR EACH ROW EXECUTE FUNCTION _mark_agent_pending_on_change();

-- ============================================================================
-- Seed: create pending agents for all existing users who have profiles
-- (catches users who signed up before this migration)
-- ============================================================================
INSERT INTO user_job_agents(user_id, status, next_run_at)
SELECT user_id, 'pending', now()
FROM   job_seeker_profiles
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Migration 010 — Agent Registry: rename user_job_agents → user_agent_instances
--
-- Why:
--   user_job_agents was built for job_match only. We're expanding to multiple
--   agent types (salary_monitor, market_intel, interview_prep) before go-live.
--   This migration normalises the table into a generic agent instance store
--   without changing any existing data.
--
-- Changes:
--   1. Rename user_job_agents → user_agent_instances
--   2. Add agent_type column (default 'job_match')
--   3. Update primary key to (user_id, agent_type)
--   4. Update triggers to reference new table name
--   5. Add wakeup index for login-time queries
--   6. Seed rows for existing users for the new agent types
-- ============================================================================

-- 1. Rename table
ALTER TABLE IF EXISTS public.user_job_agents
  RENAME TO user_agent_instances;

-- 2. Add agent_type column (rows already in table are all job_match)
ALTER TABLE public.user_agent_instances
  ADD COLUMN IF NOT EXISTS agent_type text NOT NULL DEFAULT 'job_match'
  CHECK (agent_type IN ('job_match', 'salary_monitor', 'market_intel', 'interview_prep'));

-- 3. Drop old single-column PK, replace with composite (user_id, agent_type)
ALTER TABLE public.user_agent_instances
  DROP CONSTRAINT IF EXISTS user_job_agents_pkey;

-- Drop the old unique index if it exists
DROP INDEX IF EXISTS user_job_agents_pkey;

-- Set composite PK
ALTER TABLE public.user_agent_instances
  ADD CONSTRAINT user_agent_instances_pkey PRIMARY KEY (user_id, agent_type);

-- 4. Update profile-change trigger to use new table name
--    (re-create the functions so they reference user_agent_instances)

CREATE OR REPLACE FUNCTION public._mark_agent_pending()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.user_agent_instances (user_id, agent_type, status)
  VALUES (NEW.user_id, 'job_match', 'pending')
  ON CONFLICT (user_id, agent_type) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._mark_agent_pending_on_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  changed boolean := false;
BEGIN
  IF (
    OLD.skills            IS DISTINCT FROM NEW.skills            OR
    OLD.target_job_titles IS DISTINCT FROM NEW.target_job_titles OR
    OLD.career_level      IS DISTINCT FROM NEW.career_level      OR
    OLD.location          IS DISTINCT FROM NEW.location          OR
    OLD.preferred_job_types IS DISTINCT FROM NEW.preferred_job_types OR
    OLD.salary_min        IS DISTINCT FROM NEW.salary_min        OR
    OLD.salary_max        IS DISTINCT FROM NEW.salary_max
  ) THEN
    changed := true;
  END IF;

  IF changed THEN
    INSERT INTO public.user_agent_instances (user_id, agent_type, status)
    VALUES (NEW.user_id, 'job_match', 'pending')
    ON CONFLICT (user_id, agent_type) DO UPDATE
      SET status = 'pending', updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Wakeup index — used by useAgentWakeup hook to find agents due to run
CREATE INDEX IF NOT EXISTS idx_user_agent_instances_wakeup
  ON public.user_agent_instances (next_run_at ASC, status)
  WHERE status IN ('pending', 'sleeping');

-- 6. Seed salary_monitor + market_intel rows for all existing users
--    (status='sleeping' means: not urgent, will run on schedule)
INSERT INTO public.user_agent_instances (user_id, agent_type, status, next_run_at)
SELECT user_id, 'salary_monitor', 'sleeping', now() + interval '7 days'
FROM public.user_agent_instances
WHERE agent_type = 'job_match'
ON CONFLICT (user_id, agent_type) DO NOTHING;

INSERT INTO public.user_agent_instances (user_id, agent_type, status, next_run_at)
SELECT user_id, 'market_intel', 'sleeping', now() + interval '30 days'
FROM public.user_agent_instances
WHERE agent_type = 'job_match'
ON CONFLICT (user_id, agent_type) DO NOTHING;

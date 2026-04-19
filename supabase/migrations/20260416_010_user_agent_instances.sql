-- ============================================================================
-- Migration 010 — Agent Registry: rename user_job_agents → user_agent_instances
-- (Idempotent — safe to re-run)
-- ============================================================================

-- 1. Rename table (IF EXISTS = no-op if already renamed)
ALTER TABLE IF EXISTS public.user_job_agents
  RENAME TO user_agent_instances;

-- 2. Add agent_type column
ALTER TABLE public.user_agent_instances
  ADD COLUMN IF NOT EXISTS agent_type text NOT NULL DEFAULT 'job_match'
  CHECK (agent_type IN ('job_match', 'salary_monitor', 'market_intel', 'interview_prep'));

-- 3. Drop old PK, replace with composite (user_id, agent_type) — idempotent
ALTER TABLE public.user_agent_instances
  DROP CONSTRAINT IF EXISTS user_job_agents_pkey;

DROP INDEX IF EXISTS user_job_agents_pkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_agent_instances_pkey'
      AND conrelid = 'public.user_agent_instances'::regclass
  ) THEN
    ALTER TABLE public.user_agent_instances
      ADD CONSTRAINT user_agent_instances_pkey PRIMARY KEY (user_id, agent_type);
  END IF;
END $$;

-- 4. Update triggers to reference new table name
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

-- 5. Wakeup index
CREATE INDEX IF NOT EXISTS idx_user_agent_instances_wakeup
  ON public.user_agent_instances (next_run_at ASC, status)
  WHERE status IN ('pending', 'sleeping');

-- 6. Seed salary_monitor + market_intel rows
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


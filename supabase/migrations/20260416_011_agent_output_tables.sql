-- ============================================================================
-- Migration 011 — Agent output tables
--
-- Creates storage for the three new agent types:
--   • user_salary_snapshots  — salary_monitor agent output
--   • user_market_intel      — market_intel agent output
--   • user_interview_prep    — interview_prep agent output (per job application)
--
-- All tables follow the same conventions:
--   - user_id references auth.users (CASCADE delete)
--   - RLS: users can only read/write their own rows
--   - agent_run_at timestamp for staleness checks
-- ============================================================================

-- ── 1. user_salary_snapshots ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_salary_snapshots (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_run_at timestamptz NOT NULL DEFAULT now(),
  title        text,
  location     text,
  market_p25   numeric,          -- 25th percentile market rate
  market_p50   numeric,          -- median market rate
  market_p75   numeric,          -- 75th percentile market rate
  your_min     numeric,          -- user's salary_min from profile
  your_max     numeric,          -- user's salary_max from profile
  percentile   numeric,          -- where user's midpoint falls (0-100)
  trend        text CHECK (trend IN ('rising','flat','falling','unknown')),
  sample_size  integer DEFAULT 0,
  raw_data     jsonb             -- top_companies, title_variants, etc.
);

ALTER TABLE public.user_salary_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_salary_snapshots" ON public.user_salary_snapshots;
CREATE POLICY "users_own_salary_snapshots"
  ON public.user_salary_snapshots
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_salary_snapshots_user_time
  ON public.user_salary_snapshots (user_id, agent_run_at DESC);

-- ── 2. user_market_intel ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_market_intel (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_run_at    timestamptz NOT NULL DEFAULT now(),
  hot_companies   jsonb,       -- [{name, open_roles, growth_pct}]
  trending_skills jsonb,       -- [{skill, frequency_delta}]
  remote_ratio    numeric,     -- 0.0–1.0 share of remote postings
  demand_by_city  jsonb,       -- [{city, job_count}]
  total_listings  integer DEFAULT 0
);

ALTER TABLE public.user_market_intel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_market_intel" ON public.user_market_intel;
CREATE POLICY "users_own_market_intel"
  ON public.user_market_intel
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_market_intel_user_time
  ON public.user_market_intel (user_id, agent_run_at DESC);

-- ── 3. user_interview_prep ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_interview_prep (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  job_id          uuid        REFERENCES public.job_postings(id) ON DELETE SET NULL,
  job_url         text,
  agent_run_at    timestamptz NOT NULL DEFAULT now(),
  questions       jsonb,       -- [{id, question, category, difficulty}]
  suggested_ans   jsonb,       -- [{question_id, answer, tips}]
  company_bullets text[],
  red_flags       text[],
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.user_interview_prep ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_interview_prep" ON public.user_interview_prep;
CREATE POLICY "users_own_interview_prep"
  ON public.user_interview_prep
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_interview_prep_user_job
  ON public.user_interview_prep (user_id, job_id, agent_run_at DESC);

-- ── 4. interview_prep trigger: seed interview_prep agent instance on app save ─

-- When a user saves a job application, mark their interview_prep agent as pending
-- so it generates prep for that job on next load.
CREATE OR REPLACE FUNCTION public._mark_interview_prep_pending()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.user_agent_instances (user_id, agent_type, status, config)
  VALUES (
    NEW.user_id,
    'interview_prep',
    'pending',
    jsonb_build_object('job_id', NEW.job_id, 'job_url', NEW.job_url)
  )
  ON CONFLICT (user_id, agent_type) DO UPDATE
    SET status = 'pending',
        config = jsonb_build_object('job_id', NEW.job_id, 'job_url', NEW.job_url),
        updated_at = now();
  RETURN NEW;
END;
$$;

-- Fire on INSERT into job_applications (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_applications'
  ) THEN
    DROP TRIGGER IF EXISTS trg_job_application_interview_prep ON public.job_applications;
    CREATE TRIGGER trg_job_application_interview_prep
      AFTER INSERT ON public.job_applications
      FOR EACH ROW EXECUTE FUNCTION public._mark_interview_prep_pending();
  END IF;
END;
$$;


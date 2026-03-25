
-- Add automation_mode to job_seeker_profiles
ALTER TABLE public.job_seeker_profiles 
ADD COLUMN IF NOT EXISTS automation_mode text NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS daily_apply_cap integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS match_threshold integer NOT NULL DEFAULT 70;

-- Create learning_events table
CREATE TABLE public.learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid REFERENCES public.scraped_jobs(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL,
  outcome text NOT NULL DEFAULT 'unknown',
  features jsonb NOT NULL DEFAULT '{}',
  insights jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning events" ON public.learning_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning events" ON public.learning_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage learning events" ON public.learning_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create agent_runs table for tracking orchestrator runs
CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  agents_completed jsonb NOT NULL DEFAULT '[]',
  jobs_found integer DEFAULT 0,
  jobs_matched integer DEFAULT 0,
  applications_sent integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent runs" ON public.agent_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent runs" ON public.agent_runs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent runs" ON public.agent_runs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage agent runs" ON public.agent_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for agent_runs
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;

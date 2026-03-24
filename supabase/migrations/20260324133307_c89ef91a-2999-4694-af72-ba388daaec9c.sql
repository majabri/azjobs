
-- Phase 1: Add career goals to job_seeker_profiles
ALTER TABLE public.job_seeker_profiles
  ADD COLUMN IF NOT EXISTS career_goals_short text,
  ADD COLUMN IF NOT EXISTS career_goals_long text,
  ADD COLUMN IF NOT EXISTS salary_target text;

-- Phase 2: Add enhanced outcome fields to job_applications
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS outcome_detail text,
  ADD COLUMN IF NOT EXISTS interview_stage text,
  ADD COLUMN IF NOT EXISTS response_days integer;

-- Phase 3: Create interview_sessions table
CREATE TABLE public.interview_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  job_title text NOT NULL DEFAULT '',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  readiness_score integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own interview sessions"
  ON public.interview_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 4: Create outreach_contacts table
CREATE TABLE public.outreach_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  role text,
  platform text DEFAULT 'linkedin',
  message_sent text,
  sent_at timestamp with time zone,
  response_status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own outreach contacts"
  ON public.outreach_contacts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 6: Create user_portfolio_items table
CREATE TABLE public.user_portfolio_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_type text NOT NULL DEFAULT 'project',
  title text NOT NULL DEFAULT '',
  description text,
  url text,
  image_url text,
  tags text[] DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own portfolio items"
  ON public.user_portfolio_items FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public read access for portfolio (Phase 6c - public profile)
CREATE POLICY "Anyone can view portfolio items"
  ON public.user_portfolio_items FOR SELECT
  TO anon
  USING (true);


-- Resume versions table
CREATE TABLE public.resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  version_name text NOT NULL DEFAULT 'Default',
  job_type text,
  resume_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resume versions"
  ON public.resume_versions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resume versions"
  ON public.resume_versions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume versions"
  ON public.resume_versions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resume versions"
  ON public.resume_versions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add job type preferences to profiles
ALTER TABLE public.job_seeker_profiles 
  ADD COLUMN preferred_job_types text[];

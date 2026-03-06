
CREATE TABLE public.job_seeker_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  email text,
  phone text,
  location text,
  summary text,
  skills text[],
  work_experience jsonb,
  education jsonb,
  certifications text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_seeker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.job_seeker_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.job_seeker_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.job_seeker_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.job_seeker_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

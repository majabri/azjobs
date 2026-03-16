ALTER TABLE public.job_seeker_profiles ADD COLUMN IF NOT EXISTS career_level text;
ALTER TABLE public.job_seeker_profiles ADD COLUMN IF NOT EXISTS target_job_titles text[];
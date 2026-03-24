ALTER TABLE public.job_seeker_profiles 
ADD COLUMN IF NOT EXISTS salary_min text,
ADD COLUMN IF NOT EXISTS salary_max text,
ADD COLUMN IF NOT EXISTS remote_only boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS min_match_score integer DEFAULT 60;
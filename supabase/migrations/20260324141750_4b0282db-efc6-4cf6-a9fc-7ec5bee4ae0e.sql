
-- Referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_email text NOT NULL,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  referred_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  UNIQUE(referral_code),
  UNIQUE(referrer_id, referred_email)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can update own referrals" ON public.referrals
  FOR UPDATE TO authenticated USING (auth.uid() = referrer_id);

-- Email preferences table
CREATE TABLE public.email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_job_alerts boolean NOT NULL DEFAULT true,
  weekly_insights boolean NOT NULL DEFAULT true,
  min_match_score integer NOT NULL DEFAULT 70,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email prefs" ON public.email_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add last_active_at to job_seeker_profiles
ALTER TABLE public.job_seeker_profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

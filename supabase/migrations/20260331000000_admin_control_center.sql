-- Admin Control Center: user roles, admin settings, and admin-level read policies

-- 1. user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'job_seeker' CHECK (role IN ('admin', 'job_seeker', 'recruiter')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all roles
CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Admins can update roles
CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Admins can insert roles
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Auto-create role entry on user signup (triggers new row with default 'job_seeker')
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'job_seeker')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 2. admin_settings table (platform-wide feature flags and config)
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write settings
CREATE POLICY "Admins can manage settings"
  ON public.admin_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Seed default admin settings
INSERT INTO public.admin_settings (key, value, description) VALUES
  ('auto_apply_enabled', 'true'::jsonb, 'Allow users to use auto-apply feature'),
  ('max_daily_applications', '50'::jsonb, 'Platform-wide daily application cap per user'),
  ('default_match_threshold', '70'::jsonb, 'Default match threshold for new users'),
  ('job_discovery_enabled', 'true'::jsonb, 'Enable job discovery agent'),
  ('ai_model', '"gpt-4o-mini"'::jsonb, 'AI model used for analysis'),
  ('maintenance_mode', 'false'::jsonb, 'Put platform in maintenance mode'),
  ('new_user_registration', 'true'::jsonb, 'Allow new user registrations'),
  ('max_resume_versions', '10'::jsonb, 'Maximum resume versions per user')
ON CONFLICT (key) DO NOTHING;

-- 3. Admin read policies for existing tables

-- job_seeker_profiles: admins can read all
CREATE POLICY "Admins can read all profiles"
  ON public.job_seeker_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- agent_runs: admins can read all
CREATE POLICY "Admins can read all agent runs"
  ON public.agent_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- analysis_history: admins can read all
CREATE POLICY "Admins can read all analysis history"
  ON public.analysis_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- job_applications: admins can read all
CREATE POLICY "Admins can read all applications"
  ON public.job_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- scraped_jobs: admins can read all (already has service_role policy)
CREATE POLICY "Admins can read all scraped jobs"
  ON public.scraped_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Index for fast role lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles (role);
CREATE INDEX idx_admin_settings_key ON public.admin_settings (key);

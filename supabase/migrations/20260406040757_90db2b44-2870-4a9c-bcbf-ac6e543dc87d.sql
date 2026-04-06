
-- Feature Flags table for admin service controls
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  description text DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read feature flags"
  ON public.feature_flags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage feature flags"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service Events table for event-driven architecture
CREATE TABLE public.service_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  emitted_by text NOT NULL DEFAULT '',
  processed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.service_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view service events"
  ON public.service_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage service events"
  ON public.service_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert events"
  ON public.service_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- Service Health table for monitoring + circuit breaker
CREATE TABLE public.service_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'healthy',
  last_check timestamp with time zone NOT NULL DEFAULT now(),
  error_count integer NOT NULL DEFAULT 0,
  circuit_breaker_open boolean NOT NULL DEFAULT false,
  last_error text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read service health"
  ON public.service_health FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage service health"
  ON public.service_health FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage service health"
  ON public.service_health FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed default feature flags
INSERT INTO public.feature_flags (key, description) VALUES
  ('auto_apply', 'Enable auto-apply job feature'),
  ('autopilot_mode', 'Enable fully automated job search + apply'),
  ('career_path', 'Enable career path planning'),
  ('learning', 'Enable learning recommendations'),
  ('gig_marketplace', 'Enable gig/freelance marketplace'),
  ('notifications', 'Enable notification system'),
  ('analytics', 'Enable analytics tracking'),
  ('job_search', 'Enable job search'),
  ('matching', 'Enable job matching/scoring');

-- Seed default service health entries
INSERT INTO public.service_health (service_name) VALUES
  ('auth'), ('profile'), ('search'), ('matching'),
  ('auto-apply'), ('career-path'), ('learning'),
  ('notification'), ('analytics'), ('admin'), ('billing');

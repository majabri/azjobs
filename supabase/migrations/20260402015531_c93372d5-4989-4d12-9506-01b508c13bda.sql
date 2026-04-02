
-- Support tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticket_number text NOT NULL DEFAULT ('TKT-' || substr(gen_random_uuid()::text, 1, 8)),
  request_type text NOT NULL DEFAULT 'general_feedback',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets"
  ON public.support_tickets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage tickets"
  ON public.support_tickets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_support_tickets_user ON public.support_tickets (user_id, status);
CREATE INDEX idx_support_tickets_status ON public.support_tickets (status, created_at);

-- FAQ table for knowledge base
CREATE TABLE public.support_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'getting_started',
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_faq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published FAQs"
  ON public.support_faq FOR SELECT
  TO authenticated
  USING (is_published = true);

CREATE POLICY "Admins can manage FAQs"
  ON public.support_faq FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage FAQs"
  ON public.support_faq FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed initial FAQ entries
INSERT INTO public.support_faq (category, question, answer, display_order) VALUES
  ('getting_started', 'How do I create my profile?', 'Navigate to the Profile section from the sidebar and fill in your professional details including work experience, skills, and career preferences.', 1),
  ('getting_started', 'How does the FitCheck analysis work?', 'Paste a job description and your resume on the Analyze Job page. Our AI compares them and provides a fit score with actionable improvement suggestions.', 2),
  ('job_search', 'How do I search for jobs?', 'Go to Find Jobs, enter your desired job title and location, then click Search. Results are matched against your profile for relevance.', 3),
  ('job_search', 'Can I save jobs for later?', 'Yes! Click the save button on any job listing to add it to your Applications tracker.', 4),
  ('account', 'How do I update my email preferences?', 'Visit your Profile page and scroll to the Email Preferences section to manage notifications and alerts.', 5),
  ('account', 'How do I delete my account?', 'Go to Profile settings and use the Delete Account option at the bottom of the page. This action is permanent.', 6);

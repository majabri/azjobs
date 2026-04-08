
-- Add title column to service_reviews
ALTER TABLE public.service_reviews ADD COLUMN IF NOT EXISTS title text DEFAULT '';

-- Helpful votes
CREATE TABLE public.helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, voter_id)
);
ALTER TABLE public.helpful_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view helpful votes" ON public.helpful_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own votes" ON public.helpful_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Users can delete own votes" ON public.helpful_votes
  FOR DELETE TO authenticated USING (auth.uid() = voter_id);

CREATE INDEX idx_helpful_votes_review ON public.helpful_votes(review_id);

-- Review reports
CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'spam',
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, reporter_id)
);
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON public.review_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON public.review_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.review_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_review_reports_review ON public.review_reports(review_id);


-- Phase 1A: Drop anon SELECT on analysis_history (exposes PII)
DROP POLICY IF EXISTS "Anyone can view score reports" ON public.analysis_history;

-- Phase 3F: Benefits catalog (master reference)
CREATE TABLE public.benefits_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.benefits_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read benefits catalog"
  ON public.benefits_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage benefits catalog"
  ON public.benefits_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Phase 3F: Job benefits junction table
CREATE TABLE public.job_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.scraped_jobs(id) ON DELETE CASCADE,
  benefit_id uuid NOT NULL REFERENCES public.benefits_catalog(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, benefit_id)
);

ALTER TABLE public.job_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job benefits"
  ON public.job_benefits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage job benefits"
  ON public.job_benefits FOR ALL TO service_role USING (true) WITH CHECK (true);

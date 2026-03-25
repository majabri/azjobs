
-- Offers table for tracking compensation packages
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_title text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  base_salary numeric DEFAULT 0,
  bonus numeric DEFAULT 0,
  equity numeric DEFAULT 0,
  total_comp numeric GENERATED ALWAYS AS (base_salary + bonus + equity) STORED,
  status text NOT NULL DEFAULT 'negotiating',
  notes text,
  market_rate numeric,
  negotiation_strategy jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own offers" ON public.offers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Extend scraped_jobs with compensation fields
ALTER TABLE public.scraped_jobs
  ADD COLUMN IF NOT EXISTS salary_range_estimated jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS market_rate numeric,
  ADD COLUMN IF NOT EXISTS compensation_breakdown jsonb DEFAULT '{}'::jsonb;

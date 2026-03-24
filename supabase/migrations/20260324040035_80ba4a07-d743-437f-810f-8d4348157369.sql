
-- Scraping targets: URLs users want to scrape for jobs
CREATE TABLE public.scraping_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'career_page',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scraping_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own targets" ON public.scraping_targets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Scraped jobs: normalized job listings from scraping
CREATE TABLE public.scraped_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT,
  salary TEXT,
  job_url TEXT,
  source TEXT NOT NULL DEFAULT 'scraped',
  source_id TEXT,
  seniority TEXT,
  industry TEXT,
  job_type TEXT,
  is_remote BOOLEAN DEFAULT false,
  quality_score INTEGER DEFAULT 100,
  is_flagged BOOLEAN DEFAULT false,
  flag_reasons JSONB DEFAULT '[]'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_url)
);

ALTER TABLE public.scraped_jobs ENABLE ROW LEVEL SECURITY;

-- Public read for authenticated users, no write from client
CREATE POLICY "Authenticated users can read scraped jobs" ON public.scraped_jobs
  FOR SELECT TO authenticated USING (true);

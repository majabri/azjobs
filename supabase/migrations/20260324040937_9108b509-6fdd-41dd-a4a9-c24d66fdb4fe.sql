
-- Add unique constraint on source_id for upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS scraped_jobs_source_id_key ON public.scraped_jobs (source_id) WHERE source_id IS NOT NULL;

-- Allow service role to insert/update scraped_jobs (edge function uses service role)
-- RLS policies for authenticated insert (for scraping targets management)
CREATE POLICY "Service role can manage scraped jobs" ON public.scraped_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

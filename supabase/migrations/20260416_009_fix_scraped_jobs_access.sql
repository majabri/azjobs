-- ============================================================================
-- Fix scraped_jobs access for browser (non-service-role) clients
--
-- Root causes:
--
-- 1. job_postings has user_id UUID NOT NULL and an RLS policy
--    USING (auth.uid() = user_id). Scraper rows have no user_id so:
--      a. INSERT fails (NOT NULL violation) → scraper silently drops rows
--      b. SELECT from browser client returns 0 rows (RLS filter)
--    Edge functions use SERVICE_ROLE key (bypasses RLS), so they work fine.
--    Browser clients (TodaysMatches fallback, OpportunityRadar) see nothing.
--
-- 2. The hasSubstantiveJobDescription frontend filter requires 140 chars /
--    24 words — moved to DB level is out of scope here; see frontend fix.
--
-- Fixes applied here:
--   a. Make user_id nullable (scraper inserts don't provide one)
--   b. Add SELECT policy allowing authenticated users to read scraped rows
--   c. Add SELECT policy allowing anon users to read scraped rows
--      (needed for scraped_jobs view query via browser Supabase client)
-- ============================================================================

-- 1. Make user_id nullable so scraper inserts succeed
ALTER TABLE public.job_postings
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Allow authenticated users to SELECT scraper-ingested rows
--    (rows identified by external_id IS NOT NULL)
DROP POLICY IF EXISTS "authenticated_read_scraped_jobs" ON public.job_postings;
CREATE POLICY "authenticated_read_scraped_jobs"
  ON public.job_postings FOR SELECT
  TO authenticated
  USING (external_id IS NOT NULL);

-- 3. Allow anon read of scraped rows (for public / pre-login searches)
DROP POLICY IF EXISTS "anon_read_scraped_jobs" ON public.job_postings;
CREATE POLICY "anon_read_scraped_jobs"
  ON public.job_postings FOR SELECT
  TO anon
  USING (external_id IS NOT NULL);

-- 4. Ensure the scraped_jobs view grant is current
GRANT SELECT ON public.scraped_jobs TO anon, authenticated;

-- Post-launch cleanup
-- Safe to run once new pipeline (discovered_jobs + job_postings) is confirmed stable.
-- Drops legacy VIEW scraped_jobs and table user_job_matches.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'scraped_jobs'
  ) THEN
    EXECUTE 'DROP VIEW IF EXISTS public.scraped_jobs CASCADE';
    RAISE NOTICE 'Dropped VIEW scraped_jobs';
  ELSE
    RAISE NOTICE 'scraped_jobs is not a VIEW — skipping';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_job_matches'
  ) THEN
    EXECUTE 'DROP TABLE IF EXISTS public.user_job_matches CASCADE';
    RAISE NOTICE 'Dropped TABLE user_job_matches';
  ELSE
    RAISE NOTICE 'user_job_matches does not exist — skipping';
  END IF;
END $$;
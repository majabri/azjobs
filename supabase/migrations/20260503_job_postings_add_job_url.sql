-- Add missing job_url column to job_postings (March-25 table lacks it)
-- The scraped_jobs VIEW references jp.job_url; without this column the VIEW
-- fails with "column jp.job_url does not exist" and returns 0 rows.

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS job_url text;

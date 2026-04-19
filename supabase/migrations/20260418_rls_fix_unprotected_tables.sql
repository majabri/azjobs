-- ---------------------------------------------------------------------------
-- RLS Fix: Enable row-level security on the 4 previously unprotected tables
-- Identified via audit: ingestion_runs, ingestion_sources, jobs, proposal_queue
-- Note: app_role enum values are: admin, moderator, user, job_seeker, employer, talent
-- ---------------------------------------------------------------------------

-- 1. jobs — public job listings ingested from external sources
--    No user_id column: all authenticated users can read; only service_role can write.
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read jobs" ON public.jobs;
CREATE POLICY "Authenticated users can read jobs"
ON public.jobs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Service role manages jobs" ON public.jobs;
CREATE POLICY "Service role manages jobs"
ON public.jobs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. ingestion_runs — internal pipeline run log (no user_id)
--    Admin-only read; service_role writes.
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ingestion runs" ON public.ingestion_runs;
CREATE POLICY "Admins can read ingestion runs"
ON public.ingestion_runs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Service role manages ingestion runs" ON public.ingestion_runs;
CREATE POLICY "Service role manages ingestion runs"
ON public.ingestion_runs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. ingestion_sources — registry of active job sources (no user_id)
--    Admin-only read; service_role writes.
ALTER TABLE public.ingestion_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ingestion sources" ON public.ingestion_sources;
CREATE POLICY "Admins can read ingestion sources"
ON public.ingestion_sources FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Service role manages ingestion sources" ON public.ingestion_sources;
CREATE POLICY "Service role manages ingestion sources"
ON public.ingestion_sources FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. proposal_queue — failed/pending proposal processing queue
--    Talent can read their own rows; service_role manages all.
ALTER TABLE public.proposal_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Talent can read own proposal queue entries" ON public.proposal_queue;
CREATE POLICY "Talent can read own proposal queue entries"
ON public.proposal_queue FOR SELECT
TO authenticated
USING (talent_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages proposal queue" ON public.proposal_queue;
CREATE POLICY "Service role manages proposal queue"
ON public.proposal_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

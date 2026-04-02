CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  progress integer NOT NULL DEFAULT 0,
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processing jobs"
  ON public.processing_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processing jobs"
  ON public.processing_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage processing jobs"
  ON public.processing_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_processing_jobs_user_status ON public.processing_jobs (user_id, status);

CREATE OR REPLACE FUNCTION public.cleanup_old_processing_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.processing_jobs
  WHERE created_at < now() - interval '1 hour'
    AND status IN ('completed', 'failed');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_processing_jobs
  AFTER INSERT ON public.processing_jobs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_processing_jobs();
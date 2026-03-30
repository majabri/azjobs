
CREATE TABLE public.ignored_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_title text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  job_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ignored_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ignored jobs"
  ON public.ignored_jobs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ignored_jobs_user_id ON public.ignored_jobs (user_id);

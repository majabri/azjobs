-- Admin Control Center v2: logs, queue, command audit trail

-- 1. admin_logs table for structured log streaming
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id text,
  run_id uuid,
  status text CHECK (status IN ('success', 'failed', NULL)),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "Admins can read logs"
  ON public.admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- System (service role) can insert logs
CREATE POLICY "Service role can insert logs"
  ON public.admin_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX idx_admin_logs_timestamp ON public.admin_logs (timestamp DESC);
CREATE INDEX idx_admin_logs_level ON public.admin_logs (level);
CREATE INDEX idx_admin_logs_user_id ON public.admin_logs (user_id);
CREATE INDEX idx_admin_logs_run_id ON public.admin_logs (run_id);
CREATE INDEX idx_admin_logs_status ON public.admin_logs (status);

-- 2. job_queue table for queue visibility
CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'failed', 'completed', 'cancelled')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb DEFAULT '{}',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage queue"
  ON public.job_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE INDEX idx_job_queue_status ON public.job_queue (status);
CREATE INDEX idx_job_queue_created_at ON public.job_queue (created_at DESC);

-- 3. admin_command_log for audit trail of console commands
CREATE TABLE IF NOT EXISTS public.admin_command_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command text NOT NULL,
  args jsonb DEFAULT '{}',
  result jsonb,
  success boolean NOT NULL DEFAULT true,
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_command_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read command log"
  ON public.admin_command_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert command log"
  ON public.admin_command_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE INDEX idx_admin_command_log_admin_id ON public.admin_command_log (admin_id);
CREATE INDEX idx_admin_command_log_executed_at ON public.admin_command_log (executed_at DESC);

-- 4. Seed some sample logs from existing agent_runs (if table exists)
-- This populates logs with historical data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_runs') THEN
    INSERT INTO public.admin_logs (timestamp, level, message, user_id, run_id, status, metadata)
    SELECT
      COALESCE(started_at, created_at, now()),
      CASE
        WHEN status = 'failed' THEN 'error'
        WHEN status = 'completed_with_errors' THEN 'warn'
        ELSE 'info'
      END,
      CASE
        WHEN status = 'failed' THEN 'Agent run failed'
        WHEN status = 'completed_with_errors' THEN 'Agent run completed with errors'
        WHEN status = 'completed' THEN 'Agent run completed successfully'
        ELSE 'Agent run ' || status
      END,
      user_id,
      id,
      CASE WHEN status = 'failed' THEN 'failed' ELSE 'success' END,
      jsonb_build_object(
        'jobs_found', COALESCE(jobs_found, 0),
        'jobs_matched', COALESCE(jobs_matched, 0),
        'applications_sent', COALESCE(applications_sent, 0),
        'errors', COALESCE(errors, '[]'::text[])
      )
    FROM public.agent_runs
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

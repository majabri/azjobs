
-- 1. admin_logs: structured log entries for the admin log viewer
CREATE TABLE public.admin_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL DEFAULT '',
  user_id UUID,
  agent_id TEXT,
  run_id UUID,
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs"
  ON public.admin_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage logs"
  ON public.admin_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for common filters
CREATE INDEX idx_admin_logs_timestamp ON public.admin_logs (timestamp DESC);
CREATE INDEX idx_admin_logs_level ON public.admin_logs (level);
CREATE INDEX idx_admin_logs_run_id ON public.admin_logs (run_id);

-- 2. admin_command_log: audit trail for admin console commands
CREATE TABLE public.admin_command_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  command TEXT NOT NULL,
  args JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT false,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_command_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view command log"
  ON public.admin_command_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage command log"
  ON public.admin_command_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_admin_command_log_executed_at ON public.admin_command_log (executed_at DESC);

-- 3. job_queue: job processing queue for agent system
CREATE TABLE public.job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'pending',
  user_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage job queue"
  ON public.job_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage job queue"
  ON public.job_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_job_queue_status ON public.job_queue (status);
CREATE INDEX idx_job_queue_created_at ON public.job_queue (created_at DESC);

-- Admin Control Center v3: unified audit log table

-- Create a unified audit_log table that tracks user changes, admin actions, and command executions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('user_change', 'admin_action', 'command', 'agent_run', 'system')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  action text NOT NULL,
  target_id text,
  target_label text,
  details jsonb DEFAULT '{}',
  success boolean NOT NULL DEFAULT true,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log
CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Admins and service role can insert audit log entries
CREATE POLICY "Admins can insert audit log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Service role can insert audit log"
  ON public.audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_category ON public.audit_log (category);
CREATE INDEX idx_audit_log_actor_id ON public.audit_log (actor_id);
CREATE INDEX idx_audit_log_action ON public.audit_log (action);

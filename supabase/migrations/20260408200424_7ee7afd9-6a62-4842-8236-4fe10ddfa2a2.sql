
-- Admin alerts table
CREATE TABLE public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL DEFAULT 'service_down',
  severity text NOT NULL DEFAULT 'medium',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'unresolved',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alerts" ON public.admin_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage alerts" ON public.admin_alerts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_admin_alerts_status ON public.admin_alerts(status);
CREATE INDEX idx_admin_alerts_severity ON public.admin_alerts(severity);

-- Add response_time_ms to service_health
ALTER TABLE public.service_health ADD COLUMN IF NOT EXISTS response_time_ms integer DEFAULT 0;

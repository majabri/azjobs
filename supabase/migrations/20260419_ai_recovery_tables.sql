-- AI Recovery Service supporting tables
-- Created for HIGH-012: ai-recovery-service Edge Function

-- Recovery rules: defines what action to take when a service fails
CREATE TABLE IF NOT EXISTS recovery_rules (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue       text NOT NULL,          -- pattern matched against service name / error
  condition   text NOT NULL,          -- human description of when this fires
  action      text NOT NULL,          -- action to take (restart, clear_cache, failover, etc.)
  playbook    text NOT NULL DEFAULT '',
  priority    integer NOT NULL DEFAULT 10,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed with default rules for iCareerOS services
INSERT INTO recovery_rules (issue, condition, action, playbook, priority) VALUES
  ('job_agent',       'agent queue stalled',         'restart_agent',    'Restart job agent queue processor',      10),
  ('match_jobs',      'matching latency > 30s',      'clear_cache',      'Clear matching cache and retry',         10),
  ('ai_agent',        'anthropic timeout',           'retry_with_backoff','Retry with 5s exponential backoff',     10),
  ('billing_service', 'stripe webhook missed',       'replay_webhook',   'Replay last 10 missed Stripe webhooks',  20),
  ('discovery_agent', 'source failure > 3 attempts', 'disable_source',   'Disable failing source, alert admin',    30)
ON CONFLICT DO NOTHING;

-- Recovery attempts: log of every recovery action taken
CREATE TABLE IF NOT EXISTS recovery_attempts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service      text NOT NULL,
  issue        text NOT NULL,
  action       text NOT NULL,
  status       text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','success','failed')),
  initiated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  notes        text
);

-- Daily audit reports: SLO summaries written by the daily_audit action
CREATE TABLE IF NOT EXISTS daily_audit_reports (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date                 date NOT NULL UNIQUE,
  total_checks         integer NOT NULL DEFAULT 0,
  healthy_checks       integer NOT NULL DEFAULT 0,
  slo_percentage       numeric(5,2) NOT NULL DEFAULT 100,
  incidents_by_service jsonb NOT NULL DEFAULT '{}',
  patterns             jsonb NOT NULL DEFAULT '[]',
  report_generated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: admin-only access
ALTER TABLE recovery_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_audit_reports  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read recovery_rules"
  ON recovery_rules FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service role full access recovery_rules"
  ON recovery_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access recovery_attempts"
  ON recovery_attempts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admin read recovery_attempts"
  ON recovery_attempts FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service role full access daily_audit_reports"
  ON daily_audit_reports FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admin read daily_audit_reports"
  ON daily_audit_reports FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

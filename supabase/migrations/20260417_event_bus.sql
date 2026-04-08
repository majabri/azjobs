-- Phase 8 Task 8.1: Event Bus
CREATE TABLE platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  source_service text NOT NULL,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','processed','failed'))
);
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_platform_events_type   ON platform_events(event_type);
CREATE INDEX idx_platform_events_status ON platform_events(status);
CREATE POLICY "service role only" ON platform_events
  USING (auth.role() = 'service_role');

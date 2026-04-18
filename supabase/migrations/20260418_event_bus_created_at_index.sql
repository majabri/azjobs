-- Phase 3: Add missing created_at index on platform_events for time-range queries
CREATE INDEX IF NOT EXISTS idx_platform_events_created_at ON platform_events(created_at);

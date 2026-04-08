-- Phase 10: Service Health Migration for AI Recovery Service

ALTER TABLE service_health
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS fallback_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_recovery_attempt timestamptz;

CREATE TABLE IF NOT EXISTS admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('critical', 'warning', 'info')),
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_service_name ON admin_alerts(service_name);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON admin_alerts(status);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts(severity);

CREATE TABLE IF NOT EXISTS talent_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'restricted')),
  verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_stripe_accounts_user_id ON talent_stripe_accounts(user_id);

CREATE TABLE IF NOT EXISTS talent_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES catalog_orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  stripe_transfer_id text UNIQUE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_payouts_talent_id ON talent_payouts(talent_id);
CREATE INDEX IF NOT EXISTS idx_talent_payouts_status ON talent_payouts(status);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_alerts_admins_can_view" ON admin_alerts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE talent_stripe_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "talent_stripe_accounts_talent_can_view_own" ON talent_stripe_accounts
  FOR SELECT USING (user_id = auth.uid());

ALTER TABLE talent_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "talent_payouts_talent_can_view_own" ON talent_payouts
  FOR SELECT USING (talent_id = auth.uid());

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_alerts_updated_at ON admin_alerts;
CREATE TRIGGER admin_alerts_updated_at BEFORE UPDATE ON admin_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS talent_stripe_accounts_updated_at ON talent_stripe_accounts;
CREATE TRIGGER talent_stripe_accounts_updated_at BEFORE UPDATE ON talent_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS talent_payouts_updated_at ON talent_payouts;
CREATE TRIGGER talent_payouts_updated_at BEFORE UPDATE ON talent_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Phase 10: Service Catalog + Payments + Reputation + Self-Healing + i18n
-- Service Catalog Tables Migration

CREATE TABLE IF NOT EXISTS service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  base_price numeric NOT NULL CHECK (base_price > 0),
  delivery_time_days integer NOT NULL CHECK (delivery_time_days > 0),
  revisions_included integer NOT NULL DEFAULT 1 CHECK (revisions_included > 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT description_not_empty CHECK (length(trim(description)) > 0),
  CONSTRAINT category_not_empty CHECK (length(trim(category)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_talent_id ON service_catalog(talent_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_status ON service_catalog(status);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category);
CREATE INDEX IF NOT EXISTS idx_service_catalog_is_active ON service_catalog(is_active);

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_catalog_talent_can_view_own" ON service_catalog
  FOR SELECT USING (talent_id = auth.uid());

CREATE POLICY "service_catalog_talent_can_create" ON service_catalog
  FOR INSERT WITH CHECK (
    talent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'talent'
    )
  );

CREATE POLICY "service_catalog_talent_can_update_own" ON service_catalog
  FOR UPDATE USING (talent_id = auth.uid())
  WITH CHECK (talent_id = auth.uid());

CREATE POLICY "service_catalog_public_can_view_published" ON service_catalog
  FOR SELECT USING (is_active = true AND status = 'published');

CREATE TABLE IF NOT EXISTS service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  price numeric NOT NULL CHECK (price > 0),
  delivery_time_days integer NOT NULL CHECK (delivery_time_days > 0),
  features text[] NOT NULL DEFAULT '{}',
  description text,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_packages_service_id ON service_packages(service_id);
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_packages_anyone_can_view_published" ON service_packages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM service_catalog
      WHERE service_catalog.id = service_packages.service_id
      AND service_catalog.is_active = true AND service_catalog.status = 'published'
    )
  );

CREATE POLICY "service_packages_talent_can_manage_own" ON service_packages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_catalog
      WHERE service_catalog.id = service_packages.service_id
      AND service_catalog.talent_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS catalog_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_price numeric NOT NULL CHECK (order_price > 0),
  delivery_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'delivered')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  stripe_payment_intent_id text,
  special_requests text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_orders_buyer_id ON catalog_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_catalog_orders_talent_id ON catalog_orders(talent_id);
CREATE INDEX IF NOT EXISTS idx_catalog_orders_status ON catalog_orders(status);

ALTER TABLE catalog_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_orders_parties_can_view" ON catalog_orders
  FOR SELECT USING (buyer_id = auth.uid() OR talent_id = auth.uid());

CREATE POLICY "catalog_orders_buyer_can_create" ON catalog_orders
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "catalog_orders_parties_can_update" ON catalog_orders
  FOR UPDATE USING (buyer_id = auth.uid() OR talent_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() OR talent_id = auth.uid());

CREATE TABLE IF NOT EXISTS proposal_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  talent_id uuid,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'failed' CHECK (status IN ('failed', 'pending', 'processed')),
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_queue_status ON proposal_queue(status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS service_catalog_updated_at ON service_catalog;
CREATE TRIGGER service_catalog_updated_at BEFORE UPDATE ON service_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS service_packages_updated_at ON service_packages;
CREATE TRIGGER service_packages_updated_at BEFORE UPDATE ON service_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS catalog_orders_updated_at ON catalog_orders;
CREATE TRIGGER catalog_orders_updated_at BEFORE UPDATE ON catalog_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS proposal_queue_updated_at ON proposal_queue;
CREATE TRIGGER proposal_queue_updated_at BEFORE UPDATE ON proposal_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

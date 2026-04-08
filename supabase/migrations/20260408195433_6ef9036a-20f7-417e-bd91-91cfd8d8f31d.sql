
-- Service catalog
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  headline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url text,
  turnaround_days integer NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'draft',
  rating_avg numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published services" ON public.service_catalog
  FOR SELECT USING (status = 'published' OR auth.uid() = seller_id);
CREATE POLICY "Sellers can manage own services" ON public.service_catalog
  FOR ALL USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admins can view all services" ON public.service_catalog
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Service packages (3 tiers per service)
CREATE TABLE public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'basic',
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  delivery_days integer NOT NULL DEFAULT 7,
  features text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view packages of published services" ON public.service_packages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.service_catalog sc
    WHERE sc.id = service_packages.service_id AND (sc.status = 'published' OR sc.seller_id = auth.uid())
  ));
CREATE POLICY "Sellers can manage packages for own services" ON public.service_packages
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.service_catalog sc
    WHERE sc.id = service_packages.service_id AND sc.seller_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.service_catalog sc
    WHERE sc.id = service_packages.service_id AND sc.seller_id = auth.uid()
  ));

-- Catalog orders
CREATE TABLE public.catalog_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.service_catalog(id),
  package_id uuid NOT NULL REFERENCES public.service_packages(id),
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  delivery_deadline timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can create orders" ON public.catalog_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Order parties can view own orders" ON public.catalog_orders
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Order parties can update orders" ON public.catalog_orders
  FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Admins can view all orders" ON public.catalog_orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Service reviews
CREATE TABLE public.service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.catalog_orders(id),
  service_id uuid NOT NULL REFERENCES public.service_catalog(id),
  reviewer_id uuid NOT NULL,
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.service_reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Order buyers can create reviews" ON public.service_reviews
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = reviewer_id AND EXISTS (
      SELECT 1 FROM public.catalog_orders co
      WHERE co.id = service_reviews.order_id AND co.buyer_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_service_catalog_seller ON public.service_catalog(seller_id);
CREATE INDEX idx_service_catalog_status ON public.service_catalog(status);
CREATE INDEX idx_service_catalog_category ON public.service_catalog(category);
CREATE INDEX idx_service_packages_service ON public.service_packages(service_id);
CREATE INDEX idx_catalog_orders_buyer ON public.catalog_orders(buyer_id);
CREATE INDEX idx_catalog_orders_seller ON public.catalog_orders(seller_id);
CREATE INDEX idx_service_reviews_service ON public.service_reviews(service_id);


-- Gigs table (Fiverr/Upwork style listings)
CREATE TABLE public.gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  skills_required text[] NOT NULL DEFAULT '{}',
  budget_min numeric,
  budget_max numeric,
  budget_type text NOT NULL DEFAULT 'fixed',
  location text DEFAULT 'Remote',
  is_remote boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'open',
  applications_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view open gigs"
  ON public.gigs FOR SELECT TO authenticated
  USING (status = 'open' OR auth.uid() = user_id);

CREATE POLICY "Users can manage own gigs"
  ON public.gigs FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gig Bids
CREATE TABLE public.gig_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gig_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bidders can manage own bids"
  ON public.gig_bids FOR ALL TO authenticated
  USING (auth.uid() = bidder_id)
  WITH CHECK (auth.uid() = bidder_id);

CREATE POLICY "Gig owners can view bids on their gigs"
  ON public.gig_bids FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gigs WHERE gigs.id = gig_bids.gig_id AND gigs.user_id = auth.uid()));

-- Gig Contracts
CREATE TABLE public.gig_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  freelancer_id uuid NOT NULL,
  bid_id uuid REFERENCES public.gig_bids(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  milestones jsonb NOT NULL DEFAULT '[]',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gig_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contract parties can view own contracts"
  ON public.gig_contracts FOR SELECT TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = freelancer_id);

CREATE POLICY "Contract parties can update own contracts"
  ON public.gig_contracts FOR UPDATE TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = freelancer_id);

CREATE POLICY "Authenticated can create contracts"
  ON public.gig_contracts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

-- Gig Reviews
CREATE TABLE public.gig_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.gig_contracts(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  rating integer NOT NULL DEFAULT 5,
  comment text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gig_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reviews"
  ON public.gig_reviews FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Contract parties can create reviews"
  ON public.gig_reviews FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gig_contracts
      WHERE gig_contracts.id = gig_reviews.contract_id
      AND (gig_contracts.client_id = auth.uid() OR gig_contracts.freelancer_id = auth.uid())
    )
  );

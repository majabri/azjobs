-- Projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  budget_min numeric,
  budget_max numeric,
  timeline_days integer,
  skills_required text[] DEFAULT '{}'::text[],
  deliverables text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'open',
  proposals_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can manage own projects" ON public.projects FOR ALL TO authenticated
  USING (auth.uid() = employer_id) WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Anyone authenticated can view open projects" ON public.projects FOR SELECT TO authenticated
  USING (status = 'open' OR auth.uid() = employer_id);

CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_projects_employer ON public.projects(employer_id);
CREATE INDEX idx_projects_status ON public.projects(status);

-- Project proposals table
CREATE TABLE public.project_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  timeline_days integer,
  cover_message text DEFAULT '',
  portfolio_links text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Talent can manage own proposals" ON public.project_proposals FOR ALL TO authenticated
  USING (auth.uid() = talent_id) WITH CHECK (auth.uid() = talent_id);

CREATE POLICY "Employers can view proposals on their projects" ON public.project_proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_proposals.project_id AND projects.employer_id = auth.uid()));

CREATE POLICY "Employers can update proposals on their projects" ON public.project_proposals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_proposals.project_id AND projects.employer_id = auth.uid()));

CREATE POLICY "Admins can view all proposals" ON public.project_proposals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_proposals_project ON public.project_proposals(project_id);
CREATE INDEX idx_proposals_talent ON public.project_proposals(talent_id);

-- Contracts table
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.project_proposals(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL,
  talent_id uuid NOT NULL,
  agreed_price numeric NOT NULL DEFAULT 0,
  agreed_timeline_days integer,
  status text NOT NULL DEFAULT 'active',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contract parties can view own contracts" ON public.contracts FOR SELECT TO authenticated
  USING (auth.uid() = employer_id OR auth.uid() = talent_id);

CREATE POLICY "Employers can create contracts" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Contract parties can update contracts" ON public.contracts FOR UPDATE TO authenticated
  USING (auth.uid() = employer_id OR auth.uid() = talent_id);

CREATE POLICY "Admins can view all contracts" ON public.contracts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_contracts_employer ON public.contracts(employer_id);
CREATE INDEX idx_contracts_talent ON public.contracts(talent_id);

-- Milestones table
CREATE TABLE public.milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  amount numeric DEFAULT 0,
  due_date timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contract parties can view milestones" ON public.milestones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts WHERE contracts.id = milestones.contract_id AND (contracts.employer_id = auth.uid() OR contracts.talent_id = auth.uid())));

CREATE POLICY "Contract parties can manage milestones" ON public.milestones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts WHERE contracts.id = milestones.contract_id AND (contracts.employer_id = auth.uid() OR contracts.talent_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts WHERE contracts.id = milestones.contract_id AND (contracts.employer_id = auth.uid() OR contracts.talent_id = auth.uid())));

CREATE POLICY "Admins can view all milestones" ON public.milestones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_milestones_contract ON public.milestones(contract_id);
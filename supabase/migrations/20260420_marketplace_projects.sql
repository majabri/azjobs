-- Phase 9: Gig Marketplace - Projects, Proposals, Contracts, Milestones
-- Complete migration with RLS policies

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  budget_min numeric NOT NULL CHECK (budget_min >= 0),
  budget_max numeric NOT NULL CHECK (budget_max >= budget_min),
  timeline_days integer NOT NULL CHECK (timeline_days > 0),
  skills_required text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT description_not_empty CHECK (length(trim(description)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_projects_employer_id ON projects(employer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- RLS for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_employer_can_view_own" ON projects
  FOR SELECT USING (employer_id = auth.uid());

CREATE POLICY "projects_employer_can_create" ON projects
  FOR INSERT WITH CHECK (
    employer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'employer'
    )
  );

CREATE POLICY "projects_employer_can_update_own" ON projects
  FOR UPDATE USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());

CREATE POLICY "projects_employer_can_delete_own" ON projects
  FOR DELETE USING (
    employer_id = auth.uid()
    AND status IN ('draft', 'cancelled')
  );

CREATE POLICY "projects_talent_can_view_open" ON projects
  FOR SELECT USING (
    status = 'open'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'talent'
    )
  );

-- Create project_proposals table
CREATE TABLE IF NOT EXISTS project_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric NOT NULL CHECK (price > 0),
  timeline_days integer NOT NULL CHECK (timeline_days > 0),
  cover_message text NOT NULL CHECK (length(trim(cover_message)) > 0 AND length(cover_message) <= 280),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_proposals_project_id ON project_proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_proposals_talent_id ON project_proposals(talent_id);
CREATE INDEX IF NOT EXISTS idx_project_proposals_status ON project_proposals(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_proposals_unique_proposal ON project_proposals(project_id, talent_id)
  WHERE status != 'withdrawn';

-- RLS for project_proposals
ALTER TABLE project_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_proposals_talent_can_create" ON project_proposals
  FOR INSERT WITH CHECK (
    talent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'talent'
    )
  );

CREATE POLICY "project_proposals_talent_can_view_own" ON project_proposals
  FOR SELECT USING (talent_id = auth.uid());

CREATE POLICY "project_proposals_employer_can_view" ON project_proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_proposals.project_id
      AND projects.employer_id = auth.uid()
    )
  );

CREATE POLICY "project_proposals_talent_can_update_own" ON project_proposals
  FOR UPDATE USING (talent_id = auth.uid())
  WITH CHECK (talent_id = auth.uid() AND status != 'accepted');

CREATE POLICY "project_proposals_employer_can_accept_reject" ON project_proposals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_proposals.project_id
      AND projects.employer_id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_proposals.project_id
      AND projects.employer_id = auth.uid()
    )
  );

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES project_proposals(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed_price numeric NOT NULL CHECK (agreed_price > 0),
  agreed_timeline_days integer NOT NULL CHECK (agreed_timeline_days > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_proposal_id ON contracts(proposal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employer_id ON contracts(employer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_talent_id ON contracts(talent_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- RLS for contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_parties_can_view" ON contracts
  FOR SELECT USING (
    employer_id = auth.uid() OR talent_id = auth.uid()
  );

CREATE POLICY "contracts_employer_can_create" ON contracts
  FOR INSERT WITH CHECK (
    employer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = contracts.project_id
      AND projects.employer_id = auth.uid()
    )
  );

CREATE POLICY "contracts_parties_can_update" ON contracts
  FOR UPDATE USING (
    employer_id = auth.uid() OR talent_id = auth.uid()
  )
  WITH CHECK (
    employer_id = auth.uid() OR talent_id = auth.uid()
  );

-- Create milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT description_not_empty CHECK (length(trim(description)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_milestones_contract_id ON milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON milestones(due_date);

-- RLS for milestones
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_contract_parties_can_view" ON milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = milestones.contract_id
      AND (contracts.employer_id = auth.uid() OR contracts.talent_id = auth.uid())
    )
  );

CREATE POLICY "milestones_contract_parties_can_manage" ON milestones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = milestones.contract_id
      AND contracts.employer_id = auth.uid()
    )
  );

CREATE POLICY "milestones_contract_parties_can_update" ON milestones
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = milestones.contract_id
      AND (contracts.employer_id = auth.uid() OR contracts.talent_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = milestones.contract_id
      AND (contracts.employer_id = auth.uid() OR contracts.talent_id = auth.uid())
    )
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS project_proposals_updated_at ON project_proposals;
CREATE TRIGGER project_proposals_updated_at
  BEFORE UPDATE ON project_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS milestones_updated_at ON milestones;
CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Phase 7 Task 7.1: Employer Role & Profile
-- Adds employer role to user_roles constraint and creates employer_profiles table

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('job_seeker', 'employer', 'admin'));

CREATE TABLE employer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_name text,
  company_size text,
  industry text,
  website text,
  logo_url text,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employers own their profile"
  ON employer_profiles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "anyone can read employer profiles"
  ON employer_profiles FOR SELECT USING (true);

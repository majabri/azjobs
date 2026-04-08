-- Phase 7 Task 7.2: Job Postings
-- Creates job_postings table for employer job listings

CREATE TABLE job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  location text,
  remote_type text CHECK (remote_type IN ('remote','hybrid','onsite')),
  employment_type text CHECK (employment_type IN ('full_time','part_time','contract')),
  salary_min integer,
  salary_max integer,
  skills_required jsonb DEFAULT '[]',
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','closed')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employers manage own postings"
  ON job_postings FOR ALL USING (employer_id = auth.uid());
CREATE POLICY "job seekers can read active postings"
  ON job_postings FOR SELECT USING (status = 'active');

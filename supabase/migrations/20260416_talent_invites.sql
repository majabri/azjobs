-- Phase 7 Task 7.3: Talent Invites
-- Creates talent_invites table for employer-to-talent outreach

CREATE TABLE talent_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid REFERENCES auth.users(id),
  talent_id uuid REFERENCES auth.users(id),
  job_id uuid REFERENCES job_postings(id),
  message text,
  status text DEFAULT 'sent'
    CHECK (status IN ('sent','viewed','accepted','declined')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE talent_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employers manage their invites"
  ON talent_invites FOR ALL USING (employer_id = auth.uid());
CREATE POLICY "talent can see invites to them"
  ON talent_invites FOR SELECT USING (talent_id = auth.uid());

CREATE TABLE public.talent_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  talent_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  viewed_at timestamp with time zone,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.talent_invites ENABLE ROW LEVEL SECURITY;

-- Employers can view their own invites
CREATE POLICY "Employers can view own invites"
  ON public.talent_invites FOR SELECT
  TO authenticated
  USING (auth.uid() = employer_id);

-- Employers can create invites
CREATE POLICY "Employers can create invites"
  ON public.talent_invites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = employer_id);

-- Employers can update own invites
CREATE POLICY "Employers can update own invites"
  ON public.talent_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = employer_id);

-- Talent can view invites sent to them
CREATE POLICY "Talent can view received invites"
  ON public.talent_invites FOR SELECT
  TO authenticated
  USING (auth.uid() = talent_id);

-- Talent can update invite status (accept/decline)
CREATE POLICY "Talent can respond to invites"
  ON public.talent_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = talent_id);

-- Admins can view all
CREATE POLICY "Admins can view all invites"
  ON public.talent_invites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Employers can delete own invites
CREATE POLICY "Employers can delete own invites"
  ON public.talent_invites FOR DELETE
  TO authenticated
  USING (auth.uid() = employer_id);

-- Create index for common queries
CREATE INDEX idx_talent_invites_employer ON public.talent_invites(employer_id);
CREATE INDEX idx_talent_invites_talent ON public.talent_invites(talent_id);
CREATE INDEX idx_talent_invites_job ON public.talent_invites(job_id);
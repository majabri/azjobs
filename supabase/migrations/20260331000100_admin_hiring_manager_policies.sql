-- Admin read policies for hiring manager tables

-- job_postings: admins can read all
CREATE POLICY "Admins can read all job postings"
  ON public.job_postings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- interview_schedules: admins can read all
CREATE POLICY "Admins can read all interview schedules"
  ON public.interview_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

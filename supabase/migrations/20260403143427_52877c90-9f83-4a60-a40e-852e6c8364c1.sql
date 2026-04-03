
-- Fix 1: Remove anon SELECT policy that exposes PII on job_seeker_profiles
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.job_seeker_profiles;

-- Fix 2: Prevent privilege escalation on user_roles by adding explicit deny for non-admin inserts
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

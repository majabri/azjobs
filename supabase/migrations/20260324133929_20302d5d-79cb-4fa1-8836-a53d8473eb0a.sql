-- Allow anonymous users to view specific public profile fields
CREATE POLICY "Anyone can view public profiles"
  ON public.job_seeker_profiles FOR SELECT
  TO anon
  USING (true);

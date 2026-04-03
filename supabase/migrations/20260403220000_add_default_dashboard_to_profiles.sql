-- Add default_dashboard column to profiles for persisting dual-role users' preferred landing page.
-- Allowed values: 'job_seeker' (routes to /dashboard) and 'hiring_manager' (routes to /hiring-manager).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_dashboard text
  CHECK (default_dashboard IN ('job_seeker', 'hiring_manager'));

-- Ensure authenticated users can read their own profile row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can read own profile'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can read own profile"
        ON public.profiles FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END
$$;

-- Allow authenticated users to update only their own profile row.
-- A separate, narrower policy for the update case keeps other rows safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can update own profile"
        ON public.profiles FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END
$$;

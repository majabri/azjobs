-- Add username and email columns to profiles for username-based login
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- Allow admins to read all profiles (for username lookup during login and user listing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can read all profiles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can read all profiles"
        ON public.profiles FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
          )
        )
    $policy$;
  END IF;
END
$$;

-- Allow admins to delete user roles (needed when removing a user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'Admins can delete roles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can delete roles"
        ON public.user_roles FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
          )
        )
    $policy$;
  END IF;
END
$$;

-- Allow admins to delete job_seeker_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_seeker_profiles'
      AND policyname = 'Admins can delete profiles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can delete profiles"
        ON public.job_seeker_profiles FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
          )
        )
    $policy$;
  END IF;
END
$$;

-- Allow lookup of profile by username for unauthenticated login resolution
-- (needed so the login page can look up email by username before signing in)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Allow username lookup for login'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow username lookup for login"
        ON public.profiles FOR SELECT
        TO anon
        USING (username IS NOT NULL)
    $policy$;
  END IF;
END
$$;

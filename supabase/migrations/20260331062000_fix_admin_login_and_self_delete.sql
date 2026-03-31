-- Fix admin login issues and prepare for self-delete feature

-- 1. Update handle_new_user trigger to populate the email field from auth.users.
--    Previously it only set full_name and avatar_url, leaving email NULL which
--    caused username-based login to fail ("No account found for that username").
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- 2. Backfill email for all existing profiles that currently have a NULL email.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id
  AND (p.email IS NULL OR p.email = '');

-- 3. Fix handle_first_admin trigger to use UPSERT so that the admin role is
--    properly set even when handle_new_user_role already inserted 'job_seeker'.
CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  IF user_email = 'admin@amirjabri.com' THEN
    -- Upsert admin role, overriding any previously assigned default role.
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    -- Set username and email so admin can log in with either credential.
    UPDATE public.profiles
    SET username = 'admin', email = 'admin@amirjabri.com'
    WHERE user_id = NEW.user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p2
        WHERE p2.username = 'admin' AND p2.user_id != NEW.user_id
      );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Backfill: ensure existing admin@amirjabri.com user has the correct role
--    and profile fields (idempotent).
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@amirjabri.com';
  IF admin_id IS NOT NULL THEN
    -- Ensure admin role is set.
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    -- Ensure profile has username='admin' and email populated.
    UPDATE public.profiles
    SET username = 'admin',
        email    = 'admin@amirjabri.com'
    WHERE user_id = admin_id
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p2
        WHERE p2.username = 'admin' AND p2.user_id != admin_id
      );
  END IF;
END;
$$;

-- 5. Allow users to delete their own profile row (needed for self-delete flow
--    where the auth.users delete cascades, but also ensures the profile row is
--    removable by the service-role edge function without a policy conflict).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Users can delete own profile'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete own profile"
        ON public.profiles FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END
$$;

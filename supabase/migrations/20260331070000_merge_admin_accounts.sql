-- Merge admin accounts: ensure username='admin' and email='admin@amirjabri.com'
-- belong to the same auth.users account.
--
-- Root cause: the previous backfill had a NOT EXISTS guard that prevented
-- setting username='admin' on admin@amirjabri.com when another profile already
-- held that username. This migration resolves the conflict by:
--   1. Stripping username='admin' from any profile NOT owned by admin@amirjabri.com.
--   2. Setting username='admin' and email='admin@amirjabri.com' on the correct profile.
--   3. Ensuring the admin role is upserted for the correct user.
--   4. Updating handle_first_admin so future sign-ups never hit the same conflict.

DO $$
DECLARE
  admin_id  uuid;
  conflict_id uuid;
BEGIN
  -- Find the auth.users row for admin@amirjabri.com
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@amirjabri.com';

  IF admin_id IS NULL THEN
    RAISE NOTICE 'admin@amirjabri.com not found in auth.users – skipping merge.';
    RETURN;
  END IF;

  -- Remove username='admin' from any OTHER profile that might be holding it,
  -- and log each affected row for audit purposes.
  FOR conflict_id IN
    SELECT user_id FROM public.profiles
    WHERE username = 'admin' AND user_id != admin_id
  LOOP
    RAISE NOTICE 'Clearing username=''admin'' from conflicting profile user_id=%', conflict_id;
    UPDATE public.profiles SET username = NULL WHERE user_id = conflict_id;
  END LOOP;

  -- Set the correct profile fields
  UPDATE public.profiles
  SET username = 'admin',
      email    = 'admin@amirjabri.com'
  WHERE user_id = admin_id;

  -- Upsert admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  RAISE NOTICE 'Admin account merged successfully for user_id=%', admin_id;
END;
$$;

-- Update handle_first_admin to forcefully claim username='admin' on new sign-ups
-- by first clearing it from any conflicting profile.
CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email  TEXT;
  conflict_id uuid;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;

  IF user_email = 'admin@amirjabri.com' THEN
    -- Upsert admin role, overriding any previously assigned default role.
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    -- Clear username='admin' from any other profile so the UNIQUE constraint
    -- won't block the assignment below, and log each affected row.
    FOR conflict_id IN
      SELECT user_id FROM public.profiles
      WHERE username = 'admin' AND user_id != NEW.user_id
    LOOP
      RAISE NOTICE 'handle_first_admin: clearing username=''admin'' from conflicting profile user_id=%', conflict_id;
      UPDATE public.profiles SET username = NULL WHERE user_id = conflict_id;
    END LOOP;

    -- Claim username='admin' for this account.
    UPDATE public.profiles
    SET username = 'admin',
        email    = 'admin@amirjabri.com'
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

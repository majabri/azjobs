-- Add phone column to profiles for user contact info
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Update handle_first_admin trigger function to also set username='admin'
-- for admin@amirjabri.com so both the email and username resolve to the same user
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
    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT DO NOTHING;

    -- Merge: set username='admin' so logging in with either
    -- username "admin" or email "admin@amirjabri.com" resolves to the same account.
    -- Only set if no other profile already claims the "admin" username.
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

-- Backfill: set username='admin' for any existing admin@amirjabri.com profile
-- that does not yet have a username, as long as no other user owns 'admin'.
UPDATE public.profiles p
SET username = 'admin', email = 'admin@amirjabri.com'
FROM auth.users u
WHERE u.id = p.user_id
  AND u.email = 'admin@amirjabri.com'
  AND (p.username IS NULL OR p.username = '')
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.username = 'admin' AND p2.user_id != p.user_id
  );

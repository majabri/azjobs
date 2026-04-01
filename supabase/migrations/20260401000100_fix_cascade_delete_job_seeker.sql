-- Fix: add ON DELETE CASCADE foreign key constraint to job_seeker_profiles so
-- that deleting a user from auth.users automatically removes their profile row.
-- Without this, the profile row survived user deletion and the job seeker
-- continued to appear in the Admin Control Center even after being removed.

-- Step 1: Remove any orphaned rows whose auth user no longer exists.
DELETE FROM public.job_seeker_profiles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Step 2: Add the FK constraint (idempotent – skipped if it already exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_seeker_profiles_user_id_fkey'
      AND conrelid = 'public.job_seeker_profiles'::regclass
  ) THEN
    ALTER TABLE public.job_seeker_profiles
      ADD CONSTRAINT job_seeker_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Step 3: Fix admin_settings.updated_by to use ON DELETE SET NULL so that
-- deleting an admin user doesn't violate the FK constraint.
ALTER TABLE public.admin_settings
  DROP CONSTRAINT IF EXISTS admin_settings_updated_by_fkey;

ALTER TABLE public.admin_settings
  ADD CONSTRAINT admin_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- iCareerOS: Platform Settings Enhancement
-- Migration: 20260413000000_platform_settings.sql
-- Description: Adds updated_at tracking to feature_flags,
--   adds admin update policy, ensures the toggle works from
--   the PlatformSettings admin page.
-- ============================================================

-- ===================
-- 1. ADD updated_at TO feature_flags (if not exists)
-- ===================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feature_flags'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.feature_flags
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- ===================
-- 2. RLS: Allow admins to update feature flags
-- ===================
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Admins can read all feature flags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feature_flags'
      AND policyname = 'Admins can view feature flags'
  ) THEN
    CREATE POLICY "Admins can view feature flags"
      ON public.feature_flags FOR SELECT
      USING (
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

-- Admins can update feature flags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feature_flags'
      AND policyname = 'Admins can update feature flags'
  ) THEN
    CREATE POLICY "Admins can update feature flags"
      ON public.feature_flags FOR UPDATE
      USING (
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

-- Authenticated users can read feature flags (needed for signup gate check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feature_flags'
      AND policyname = 'Authenticated users can read feature flags'
  ) THEN
    CREATE POLICY "Authenticated users can read feature flags"
      ON public.feature_flags FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Anonymous users can read feature flags (needed for signup page to check mode)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feature_flags'
      AND policyname = 'Anon users can read feature flags'
  ) THEN
    CREATE POLICY "Anon users can read feature flags"
      ON public.feature_flags FOR SELECT
      USING (auth.role() = 'anon');
  END IF;
END $$;

-- ===================
-- 3. RPC: Check registration mode (for signup page)
-- ===================
CREATE OR REPLACE FUNCTION public.check_registration_mode()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite_only BOOLEAN;
BEGIN
  SELECT enabled INTO v_invite_only
  FROM public.feature_flags
  WHERE key = 'invite_only_enrollment';

  -- Default to invite-only if flag doesn't exist
  IF v_invite_only IS NULL THEN
    v_invite_only := true;
  END IF;

  RETURN json_build_object(
    'invite_only', v_invite_only,
    'mode', CASE WHEN v_invite_only THEN 'invite_only' ELSE 'public' END
  );
END;
$$;

-- Grant execute to anon so the signup page can check the mode
GRANT EXECUTE ON FUNCTION public.check_registration_mode() TO anon;
GRANT EXECUTE ON FUNCTION public.check_registration_mode() TO authenticated;

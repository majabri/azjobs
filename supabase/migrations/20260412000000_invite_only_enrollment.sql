-- ============================================================
-- iCareerOS: Invite-Only Enrollment System
-- Migration: 20260412000000_invite_only_enrollment.sql
-- Description: Creates invitations table, referral_tree,
--   daily usage view, profiles extensions, and RLS policies.
-- ============================================================

-- ===================
-- 1. INVITATIONS TABLE
-- ===================
CREATE TABLE IF NOT EXISTS public.invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_type     TEXT NOT NULL CHECK (invite_type IN ('email', 'code')),

  -- For email invites
  invitee_email   TEXT,

  -- The token/code
  token           TEXT NOT NULL UNIQUE,
  invite_code     TEXT UNIQUE,

  -- State
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_by     UUID REFERENCES auth.users(id),
  accepted_at     TIMESTAMPTZ,

  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),

  -- Constraints
  CONSTRAINT email_required_for_email_type
    CHECK (invite_type != 'email' OR invitee_email IS NOT NULL),
  CONSTRAINT code_required_for_code_type
    CHECK (invite_type != 'code' OR invite_code IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_invite_code ON public.invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON public.invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_email ON public.invitations(invitee_email);

-- ===================
-- 2. REFERRAL TREE TABLE
-- ===================
CREATE TABLE IF NOT EXISTS public.referral_tree (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by      UUID REFERENCES auth.users(id),
  invitation_id   UUID REFERENCES public.invitations(id),
  depth           INT NOT NULL DEFAULT 0,
  chain_path      UUID[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_tree_invited_by ON public.referral_tree(invited_by);
CREATE INDEX IF NOT EXISTS idx_referral_tree_depth ON public.referral_tree(depth);
CREATE INDEX IF NOT EXISTS idx_referral_tree_chain_path ON public.referral_tree USING GIN(chain_path);

-- ===================
-- 3. DAILY USAGE VIEW
-- ===================
CREATE OR REPLACE VIEW public.invite_daily_usage AS
SELECT
  inviter_id,
  COUNT(*) AS invites_sent_today,
  GREATEST(0, 5 - COUNT(*)::int) AS invites_remaining_today
FROM public.invitations
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
  AND created_at < date_trunc('day', now() AT TIME ZONE 'UTC') + INTERVAL '1 day'
GROUP BY inviter_id;

-- ===================
-- 4. PROFILES EXTENSIONS
-- ===================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'invited_via'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN invited_via UUID REFERENCES public.invitations(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN referral_code TEXT UNIQUE;
  END IF;
END $$;

-- ===================
-- 5. RLS POLICIES â INVITATIONS
-- ===================
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations they sent"
  ON public.invitations FOR SELECT
  USING (inviter_id = auth.uid());

CREATE POLICY "Users can view invitations sent to their email"
  ON public.invitations FOR SELECT
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Admins can view all invitations"
  ON public.invitations FOR SELECT
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- ===================
-- 6. RLS POLICIES â REFERRAL TREE
-- ===================
ALTER TABLE public.referral_tree ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral entry"
  ON public.referral_tree FOR SELECT
  USING (user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "Admins can view full referral tree"
  ON public.referral_tree FOR SELECT
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- ===================
-- 7. SEED EXISTING USERS AS FOUNDING MEMBERS
-- ===================
-- Insert all current users into referral_tree with depth 0 (founding members)
INSERT INTO public.referral_tree (user_id, invited_by, depth, chain_path)
SELECT id, NULL, 0, '{}'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.referral_tree)
ON CONFLICT (user_id) DO NOTHING;

-- Generate referral codes for existing users who don't have one
UPDATE public.profiles
SET referral_code = UPPER(LEFT(COALESCE(username, 'USER'), 4)) || '-' ||
  SUBSTR(MD5(RANDOM()::text), 1, 4)
WHERE referral_code IS NULL;

-- ===================
-- 8. FEATURE FLAG
-- ===================
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'invite_only_enrollment',
  true,
  'When enabled, new signups require a valid invite token or code'
)
ON CONFLICT (key) DO UPDATE SET enabled = true;

-- ===================
-- 9. RPC: Check invite daily limit (race-condition safe)
-- ===================
CREATE OR REPLACE FUNCTION public.check_and_increment_invite_limit(p_inviter_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_limit INT := 5;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if admin (bypass limit)
  SELECT (raw_user_meta_data->>'role') = 'admin'
  INTO v_is_admin
  FROM auth.users WHERE id = p_inviter_id;

  IF v_is_admin THEN
    RETURN json_build_object('allowed', true, 'remaining', -1, 'is_admin', true);
  END IF;

  -- Lock and count today's invites for this user (advisory lock prevents race conditions)
  PERFORM pg_advisory_xact_lock(hashtext(p_inviter_id::text || date_trunc('day', now() AT TIME ZONE 'UTC')::text));

  SELECT COUNT(*)
  INTO v_count
  FROM public.invitations
  WHERE inviter_id = p_inviter_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
    AND created_at < date_trunc('day', now() AT TIME ZONE 'UTC') + INTERVAL '1 day';

  IF v_count >= v_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'remaining', 0,
      'resets_at', (date_trunc('day', now() AT TIME ZONE 'UTC') + INTERVAL '1 day')::text
    );
  END IF;

  RETURN json_build_object('allowed', true, 'remaining', v_limit - v_count - 1);
END;
$$;

-- ===================
-- 10. RPC: Accept invite and build referral tree
-- ===================
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL,
  p_new_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_parent RECORD;
  v_new_depth INT;
  v_new_chain UUID[];
  v_referral_code TEXT;
BEGIN
  -- Find the invitation
  IF p_token IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations WHERE token = p_token;
  ELSIF p_invite_code IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations WHERE invite_code = UPPER(p_invite_code);
  ELSE
    RETURN json_build_object('success', false, 'error', 'No token or code provided');
  END IF;

  IF v_invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'already_used');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN json_build_object('success', false, 'error', 'expired');
  END IF;

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted',
      accepted_by = p_new_user_id,
      accepted_at = now()
  WHERE id = v_invitation.id;

  -- Get inviter's referral tree entry for chain computation
  SELECT * INTO v_parent
  FROM public.referral_tree
  WHERE user_id = v_invitation.inviter_id;

  IF v_parent IS NOT NULL THEN
    v_new_depth := v_parent.depth + 1;
    v_new_chain := v_parent.chain_path || v_invitation.inviter_id;
  ELSE
    v_new_depth := 1;
    v_new_chain := ARRAY[v_invitation.inviter_id];
  END IF;

  -- Insert into referral tree
  INSERT INTO public.referral_tree (user_id, invited_by, invitation_id, depth, chain_path)
  VALUES (p_new_user_id, v_invitation.inviter_id, v_invitation.id, v_new_depth, v_new_chain)
  ON CONFLICT (user_id) DO NOTHING;

  -- Generate referral code for new user
  v_referral_code := UPPER(LEFT(
    COALESCE(
      (SELECT username FROM public.profiles WHERE user_id = p_new_user_id),
      'USER'
    ), 4
  )) || '-' || UPPER(SUBSTR(MD5(RANDOM()::text), 1, 4));

  -- Update profile
  UPDATE public.profiles
  SET invited_via = v_invitation.id,
      referral_code = v_referral_code
  WHERE user_id = p_new_user_id;

  RETURN json_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'inviter_id', v_invitation.inviter_id,
    'depth', v_new_depth,
    'referral_code', v_referral_code
  );
END;
$$;

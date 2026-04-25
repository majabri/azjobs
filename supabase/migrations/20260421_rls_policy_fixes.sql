-- =============================================================================
-- Migration: RLS policy fixes
-- Date: 2026-04-21
-- Scope: Fix HIGH-severity RLS issues found in audit (2026-04-21)
--
-- Issues addressed:
--   HIGH  payment_transactions  — RLS on, zero policies → payments inaccessible
--   HIGH  stripe_accounts       — RLS on, zero policies → Stripe integration blocked
--   HIGH  admin_usernames       — anon role could enumerate all admin usernames
--   HIGH  employer_profiles     — anon role could read all employer data
--
-- Intentionally NOT changed:
--   customer_surveys  — no user_id column; anonymous visitor survey by design
--
-- Deferred (gig_*, contract_milestones, service_orders, etc.):
--   Tables have zero policies but are not yet user-facing. Policies will be
--   added when the gig marketplace feature ships to avoid premature lock-in.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. payment_transactions
--    Authenticated users can see rows where they are payer OR payee.
--    Writes are handled exclusively by service_role (bypasses RLS).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own payment transactions" ON payment_transactions;

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = payer_id OR auth.uid() = payee_id
  );

-- ---------------------------------------------------------------------------
-- 2. stripe_accounts
--    Users see and manage only their own linked Stripe account.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own stripe account" ON stripe_accounts;
DROP POLICY IF EXISTS "Users manage own stripe account" ON stripe_accounts;

CREATE POLICY "Users can view own stripe account"
  ON stripe_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own stripe account"
  ON stripe_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. admin_usernames
--    Remove anon read (was enabling username enumeration).
--    Authenticated users can still resolve usernames (needed for login-by-username).
--    Admins can only write their own row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon can resolve usernames" ON admin_usernames;
DROP POLICY IF EXISTS "Authenticated users can resolve usernames" ON admin_usernames;
DROP POLICY IF EXISTS "Admins manage own username" ON admin_usernames;

CREATE POLICY "Authenticated users can resolve usernames"
  ON admin_usernames
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage own username"
  ON admin_usernames
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. employer_profiles
--    Remove anon read. Authenticated users (job seekers) can browse all
--    employer profiles — needed for company cards on job listings.
--    Employers manage only their own profile.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anyone can read employer profiles" ON employer_profiles;
DROP POLICY IF EXISTS "Authenticated users can view employer profiles" ON employer_profiles;
DROP POLICY IF EXISTS "Employers manage own profile" ON employer_profiles;

CREATE POLICY "Authenticated users can view employer profiles"
  ON employer_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Employers manage own profile"
  ON employer_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

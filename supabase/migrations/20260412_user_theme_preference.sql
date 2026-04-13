-- Add user theme preference column to profiles
-- Values: 'light', 'dark', 'system' (default: 'system')
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'system'
  CHECK (theme IN ('light', 'dark', 'system'));

-- Allow users to update their own theme preference
-- (Relies on existing RLS policy that lets users update their own profile row)
COMMENT ON COLUMN profiles.theme IS 'User display theme preference: light, dark, or system (follow OS)';

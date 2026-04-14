-- Add theme_preference to profiles table (project uses 'profiles', not 'user_profiles')
-- Mirrors the existing 'theme' column pattern used by ThemeContext
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system'
    CHECK (theme_preference IN ('light', 'dark', 'system'));

COMMENT ON COLUMN profiles.theme_preference IS
  'User-selected theme: light, dark, or system (follows OS preference)';

-- Backfill from existing theme column if present
UPDATE profiles
SET theme_preference = theme
WHERE theme IS NOT NULL
  AND theme IN ('light', 'dark', 'system')
  AND theme_preference = 'system';

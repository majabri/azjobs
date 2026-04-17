/**
 * useProfile — fetches the current user's profile row from the `profiles` table.
 * This is the source of truth for user-editable display information (full_name,
 * username, avatar_url) that is separate from Supabase auth metadata.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface ProfileData {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function useProfile() {
  const { user } = useAuthReady();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setProfile(data ?? null);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  /**
   * Returns the best available display name using this priority:
   * 1. profiles.full_name  (user-edited in Settings)
   * 2. user_metadata.full_name  (set by OAuth provider on first login)
   * 3. profiles.username
   * 4. email prefix  (fallback)
   * 5. "User"
   */
  const displayName = (): string => {
    if (!user) return "User";
    return (
      profile?.full_name ||
      user.user_metadata?.full_name ||
      profile?.username ||
      user.email?.split("@")[0] ||
      "User"
    );
  };

  /**
   * Persists a new display name to the profiles table.
   * Returns an error string on failure, or null on success.
   */
  const updateDisplayName = async (newName: string): Promise<string | null> => {
    if (!user) return "Not authenticated";
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: newName.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return error.message;
    setProfile((prev) => (prev ? { ...prev, full_name: newName.trim() } : prev));
    return null;
  };

  return { profile, isLoading, displayName, updateDisplayName };
}

/**
 * useProfile — fetches the current user's display name from multiple sources.
 *
 * Priority order for display name:
 * 1. profiles.full_name        — user-edited in Account Settings
 * 2. user_metadata.full_name   — set by OAuth provider (Google/Apple) on first login
 * 3. profiles.username         — optional username field
 * 4. job_seeker_profiles.full_name — name from career profile (auto-populated)
 * 5. email prefix              — last resort fallback
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
  const [jobSeekerName, setJobSeekerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setJobSeekerName(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    // Fetch both tables in parallel
    Promise.all([
      supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("job_seeker_profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([profileRes, jobSeekerRes]) => {
      if (!mounted) return;
      setProfile(profileRes.data ?? null);
      setJobSeekerName(jobSeekerRes.data?.full_name ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [user?.id, user]);

  /**
   * Returns the best available display name.
   */
  const displayName = (): string => {
    if (!user) return "User";
    return (
      profile?.full_name ||
      user.user_metadata?.full_name ||
      profile?.username ||
      jobSeekerName ||
      user.email?.split("@")[0] ||
      "User"
    );
  };

  /**
   * Persists a new display name to the profiles table.
   * Uses upsert so it works even if the user has no profile row yet.
   * Returns an error string on failure, or null on success.
   */
  const updateDisplayName = async (newName: string): Promise<string | null> => {
    if (!user) return "Not authenticated";
    const trimmed = newName.trim();
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) return error.message;
    setProfile((prev) =>
      prev
        ? { ...prev, full_name: trimmed }
        : { full_name: trimmed, username: null, avatar_url: null }
    );
    return null;
  };

  return { profile, isLoading, displayName, updateDisplayName };
}

/**
 * usePostLoginRedirect — determines the correct post-login destination.
 *
 * Priority:
 * 1. Admin role → /admin
 * 2. Stored dashboard preference → persisted choice
 * 3. Has job_postings (hiring manager signal) + has job_seeker_profile → dual-role → prompt
 * 4. Has job_postings only → /hiring-manager
 * 5. Default → /dashboard (job seeker)
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAuthReady } from "@/hooks/useAuthReady";

export type DashboardMode = "seeker" | "hiring" | "both";

const PREF_KEY = "fitcheck_default_dashboard";

function getStoredPref(): string | null {
  try { return localStorage.getItem(PREF_KEY); } catch { return null; }
}

export function setDashboardPref(mode: "seeker" | "hiring") {
  try { localStorage.setItem(PREF_KEY, mode); } catch { /* noop */ }
}

export function usePostLoginRedirect() {
  const { user, isReady } = useAuthReady();
  const { isAdmin, isLoading: isRoleLoading } = useAdminRole();
  const [destination, setDestination] = useState<string | null>(null);
  const [showModePrompt, setShowModePrompt] = useState(false);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    if (!isReady || !user || isRoleLoading) {
      setIsResolving(true);
      return;
    }

    // Admin always goes to /admin
    if (isAdmin) {
      setDestination("/admin");
      setIsResolving(false);
      return;
    }

    // Check stored preference first
    const storedPref = getStoredPref();
    if (storedPref === "hiring") {
      setDestination("/hiring-manager");
      setIsResolving(false);
      return;
    }
    if (storedPref === "seeker") {
      setDestination("/dashboard");
      setIsResolving(false);
      return;
    }

    // No stored pref — detect mode from data
    let cancelled = false;
    void (async () => {
      try {
        const [postingsRes, profileRes] = await Promise.all([
          supabase.from("job_postings").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("job_seeker_profiles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);
        if (cancelled) return;

        const hasPostings = (postingsRes.count ?? 0) > 0;
        const hasProfile = (profileRes.count ?? 0) > 0;

        if (hasPostings && hasProfile) {
          // Dual-role — show prompt
          setShowModePrompt(true);
          setDestination("/dashboard"); // default fallback if they dismiss
          setIsResolving(false);
        } else if (hasPostings && !hasProfile) {
          setDestination("/hiring-manager");
          setDashboardPref("hiring");
          setIsResolving(false);
        } else {
          setDestination("/dashboard");
          setIsResolving(false);
        }
      } catch {
        if (!cancelled) {
          setDestination("/dashboard");
          setIsResolving(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, isReady, isRoleLoading, isAdmin]);

  return { destination, showModePrompt, setShowModePrompt, isResolving };
}

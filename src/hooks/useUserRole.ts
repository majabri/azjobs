/**
 * useUserRole — Fetches all application roles assigned to the current user.
 *
 * Queries all rows in user_roles for the signed-in user so that dual-role
 * accounts (job_seeker + recruiter) are detected correctly once the database
 * allows multiple role rows per user.  With the current single-row schema the
 * hook still works — it simply returns an array of length 0 or 1.
 *
 * Returned flags:
 *   isAdmin      — role "admin" is present
 *   isJobSeeker  — role "job_seeker" is present
 *   isRecruiter  — role "recruiter" is present
 *   isDualRole   — both job_seeker and recruiter are present
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export type AppUserRole = "admin" | "moderator" | "user" | "job_seeker" | "recruiter";

type UserRoleState = {
  roles: AppUserRole[];
  isLoading: boolean;
  error: string | null;
};

export function useUserRole() {
  const { user, isReady } = useAuthReady();
  const [state, setState] = useState<UserRoleState>({
    roles: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      setState({ roles: [], isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (cancelled) return;

        if (error) {
          setState({ roles: [], isLoading: false, error: error.message });
          return;
        }

        const roles = (data ?? []).map((r) => r.role as AppUserRole);
        setState({ roles, isLoading: false, error: null });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({ roles: [], isLoading: false, error: message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isReady]);

  const { roles } = state;

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isJobSeeker: roles.includes("job_seeker"),
    isRecruiter: roles.includes("recruiter"),
    isDualRole: roles.includes("job_seeker") && roles.includes("recruiter"),
    isLoading: state.isLoading,
    error: state.error,
  };
}

/** localStorage key for the per-user default dashboard preference. */
export function dashboardPrefKey(userId: string): string {
  return `fitcheck_default_dashboard_${userId}`;
}

/** Values that can be stored as a dashboard preference. */
export type DashboardPref = "seeker" | "hiring";

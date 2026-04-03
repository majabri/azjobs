/**
 * useDashboardPref — Reads and persists the dual-role user's preferred landing
 * dashboard from/to `profiles.default_dashboard`.
 *
 * The DB is the source of truth (persists across devices).  A localStorage
 * entry keyed by `dashboardPrefKey(userId)` acts as a same-device cache so
 * that subsequent navigations on the same device are instant.
 *
 * Returned shape:
 *   pref        — 'job_seeker' | 'hiring_manager' | null (null = not yet set)
 *   isLoading   — true while the initial DB fetch is in flight
 *   error       — error message if the fetch failed, or null
 *   updatePref  — async function to persist a new preference
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { type DashboardPref, dashboardPrefKey } from "@/hooks/useUserRole";

type PrefState = {
  pref: DashboardPref | null;
  isLoading: boolean;
  error: string | null;
};

export function useDashboardPref() {
  const { user, isReady } = useAuthReady();
  const [state, setState] = useState<PrefState>({
    pref: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      setState({ pref: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;

    // Serve a cached value immediately so routing doesn't block on network
    const cached = localStorage.getItem(dashboardPrefKey(user.id));
    if (cached === "job_seeker" || cached === "hiring_manager") {
      setState({ pref: cached as DashboardPref, isLoading: false, error: null });
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("default_dashboard")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setState((s) => ({ ...s, isLoading: false, error: error.message }));
          return;
        }

        const dbPref =
          data?.default_dashboard === "job_seeker" ||
          data?.default_dashboard === "hiring_manager"
            ? (data.default_dashboard as DashboardPref)
            : null;

        // Keep localStorage in sync with DB
        if (dbPref) {
          localStorage.setItem(dashboardPrefKey(user.id), dbPref);
        } else {
          localStorage.removeItem(dashboardPrefKey(user.id));
        }

        setState({ pref: dbPref, isLoading: false, error: null });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, isLoading: false, error: message }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isReady]);

  const updatePref = useCallback(
    async (pref: DashboardPref) => {
      if (!user) return;

      // Capture previous pref via setState callback so we can revert on failure.
      // This avoids adding state.pref to the useCallback dependency array.
      let previousPref: DashboardPref | null = null;
      setState((s) => {
        previousPref = s.pref;
        return { ...s, pref };
      });
      localStorage.setItem(dashboardPrefKey(user.id), pref);

      const { error } = await supabase
        .from("profiles")
        .update({ default_dashboard: pref })
        .eq("user_id", user.id);

      if (error) {
        // Revert optimistic update if the DB write failed
        if (previousPref) {
          localStorage.setItem(dashboardPrefKey(user.id), previousPref);
        } else {
          localStorage.removeItem(dashboardPrefKey(user.id));
        }
        setState((s) => ({ ...s, pref: previousPref, error: error.message }));
      }
    },
    [user],
  );

  return { ...state, updatePref };
}

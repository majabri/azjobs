import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export type UserRole = "admin" | "moderator" | "user";

type AdminRoleState = {
  role: UserRole | null;
  isLoading: boolean;
  error: string | null;
};

export function useAdminRole() {
  const { user, isReady } = useAuthReady();
  const [state, setState] = useState<AdminRoleState>({
    role: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      setState({ role: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setState({ role: "user", isLoading: false, error: error.message });
          return;
        }

        setState({
          role: ((data?.role as UserRole) ?? "user"),
          isLoading: false,
          error: null,
        });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({ role: "user", isLoading: false, error: message });
      }
    })();

    return () => { 
      cancelled = true;
    };
  }, [user, isReady]);

  return {
    role: state.role,
    isAdmin: state.role === "admin",
    isLoading: state.isLoading,
    error: state.error,
  };
}
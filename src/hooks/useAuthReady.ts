import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuthReady() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    console.debug("[auth] initializing auth state listener");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      console.debug("[auth] onAuthStateChange:", _event, "user:", session?.user?.id ?? "none");
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const token = session?.access_token;
      console.debug("[auth] getSession complete — token detected:", !!token, "user:", session?.user?.id ?? "none");
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isReady,
    /** Alias for isReady — true while auth state is being initialised. */
    loading: !isReady,
    isAuthenticated: !!user,
  };
}

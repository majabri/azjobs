import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { identifyUser, clearUser } from "@/lib/sentry";

export function useAuthReady() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      setIsReady(true);
      // Keep Sentry user context in sync so errors are attributed correctly.
      if (u) {
        identifyUser(u.id, u.email);
      } else {
        clearUser();
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      setIsReady(true);
      if (u) identifyUser(u.id, u.email);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isReady,
    isAuthenticated: !!user,
  };
}

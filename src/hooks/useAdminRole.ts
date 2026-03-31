import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export type UserRole = "admin" | "moderator" | "user";

export function useAdminRole() {
  const { user, isReady } = useAuthReady();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setRole((data?.role as UserRole) ?? "user");
        setIsLoading(false);
      });
  }, [user, isReady]);

  return {
    role,
    isAdmin: role === "admin",
    isLoading,
  };
}

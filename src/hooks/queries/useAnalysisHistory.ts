import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export const ANALYSIS_HISTORY_QUERY_KEY = ["analysis_history"];

export function useAnalysisHistory(limit: number = 20) {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...ANALYSIS_HISTORY_QUERY_KEY, user?.id, limit],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("analysis_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: isReady && !!user,
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";

export const PROFILE_QUERY_KEY = ["job_seeker_profile"];

export function useJobSeekerProfile() {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...PROFILE_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("job_seeker_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isReady && !!user,
  });
}

export function useUpdateJobSeekerProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuthReady();

  return useMutation({
    mutationFn: async (updates: any) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("job_seeker_profiles")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    },
    onError: (error) => {
      toast.error("Failed to update profile");
      console.error(error);
    },
  });
}

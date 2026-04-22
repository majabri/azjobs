import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";

export const JOB_APPLICATIONS_QUERY_KEY = ["job_applications"];

/** Fetch all job applications for the current user */
export function useJobApplications() {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...JOB_APPLICATIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("job_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isReady && !!user,
  });
}

/** Update the status of a job application */
export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("job_applications")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to update application status");
    },
  });
}

/** Delete a job application */
export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_applications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to delete application");
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const JOB_POSTINGS_QUERY_KEY = ["job_postings"];

type JobPostingRow = Database["public"]["Tables"]["job_postings"]["Row"];
type JobPostingInsert = Database["public"]["Tables"]["job_postings"]["Insert"];

/** Fetch all job postings for the current user */
export function useJobPostings() {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...JOB_POSTINGS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as JobPostingRow[];
    },
    enabled: isReady && !!user,
  });
}

/** Create a new job posting */
export function useCreateJobPosting() {
  const queryClient = useQueryClient();
  const { user } = useAuthReady();

  return useMutation({
    mutationFn: async (payload: Omit<JobPostingInsert, "user_id">) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("job_postings").insert({
        ...payload,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOB_POSTINGS_QUERY_KEY });
      toast.success("Job posting created");
    },
    onError: () => {
      toast.error("Failed to create job posting");
    },
  });
}

/** Update a job posting */
export function useUpdateJobPosting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<JobPostingInsert> }) => {
      const { error } = await supabase
        .from("job_postings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOB_POSTINGS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to update job posting");
    },
  });
}

/** Delete a job posting */
export function useDeleteJobPosting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_postings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOB_POSTINGS_QUERY_KEY });
      toast.success("Job posting deleted");
    },
    onError: () => {
      toast.error("Failed to delete job posting");
    },
  });
}

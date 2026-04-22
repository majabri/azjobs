import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";

export const RESUME_VERSIONS_QUERY_KEY = ["resume_versions"];

export interface ResumeVersion {
  id: string;
  version_name: string;
  job_type: string;
  resume_text: string;
}

/** Fetch all resume versions for the current user */
export function useResumeVersions() {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...RESUME_VERSIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("resume_versions")
        .select("id, version_name, job_type, resume_text")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((v) => ({
        id: v.id,
        version_name: v.version_name,
        job_type: v.job_type || "",
        resume_text: v.resume_text,
      })) as ResumeVersion[];
    },
    enabled: isReady && !!user,
  });
}

/** Delete a resume version */
export function useDeleteResumeVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("resume_versions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESUME_VERSIONS_QUERY_KEY });
      toast.success("Version deleted");
    },
    onError: () => {
      toast.error("Failed to delete version");
    },
  });
}

/** Save (upsert) a resume version */
export function useSaveResumeVersion() {
  const queryClient = useQueryClient();
  const { user } = useAuthReady();

  return useMutation({
    mutationFn: async (payload: {
      version_name: string;
      job_type: string;
      resume_text: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("resume_versions").insert({
        user_id: user.id,
        version_name: payload.version_name,
        job_type: payload.job_type,
        resume_text: payload.resume_text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESUME_VERSIONS_QUERY_KEY });
      toast.success("Resume version saved");
    },
    onError: () => {
      toast.error("Failed to save resume version");
    },
  });
}

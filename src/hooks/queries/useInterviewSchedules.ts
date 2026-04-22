import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const INTERVIEW_SCHEDULES_QUERY_KEY = ["interview_schedules"];

type InterviewScheduleRow =
  Database["public"]["Tables"]["interview_schedules"]["Row"];
type InterviewScheduleInsert =
  Database["public"]["Tables"]["interview_schedules"]["Insert"];

/** Fetch all interview schedules for the current user */
export function useInterviewSchedules() {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...INTERVIEW_SCHEDULES_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("interview_schedules")
        .select("*")
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data || []) as InterviewScheduleRow[];
    },
    enabled: isReady && !!user,
  });
}

/** Create a new interview schedule entry */
export function useCreateInterviewSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuthReady();

  return useMutation({
    mutationFn: async (payload: Omit<InterviewScheduleInsert, "user_id">) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("interview_schedules").insert({
        ...payload,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: INTERVIEW_SCHEDULES_QUERY_KEY,
      });
      toast.success("Interview scheduled");
    },
    onError: () => {
      toast.error("Failed to schedule interview");
    },
  });
}

/** Delete an interview schedule */
export function useDeleteInterviewSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("interview_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: INTERVIEW_SCHEDULES_QUERY_KEY,
      });
      toast.success("Interview removed");
    },
    onError: () => {
      toast.error("Failed to delete interview");
    },
  });
}

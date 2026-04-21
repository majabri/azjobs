import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const OUTREACH_CONTACTS_QUERY_KEY = ["outreach_contacts"];

type OutreachContactRow = Database["public"]["Tables"]["outreach_contacts"]["Row"];
type OutreachContactInsert = Database["public"]["Tables"]["outreach_contacts"]["Insert"];

/** Fetch outreach contacts for the current user */
export function useOutreachContacts() {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...OUTREACH_CONTACTS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("outreach_contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as OutreachContactRow[];
    },
    enabled: isReady && !!user,
  });
}

/** Add a new outreach contact */
export function useAddOutreachContact() {
  const queryClient = useQueryClient();
  const { user } = useAuthReady();

  return useMutation({
    mutationFn: async (payload: Omit<OutreachContactInsert, "user_id">) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("outreach_contacts").insert({
        ...payload,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OUTREACH_CONTACTS_QUERY_KEY });
      toast.success("Contact added");
    },
    onError: () => {
      toast.error("Failed to add contact");
    },
  });
}

/** Update an outreach contact */
export function useUpdateOutreachContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OutreachContactInsert> }) => {
      const { error } = await supabase
        .from("outreach_contacts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OUTREACH_CONTACTS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to update contact");
    },
  });
}

/** Delete an outreach contact */
export function useDeleteOutreachContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("outreach_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OUTREACH_CONTACTS_QUERY_KEY });
      toast.success("Contact removed");
    },
    onError: () => {
      toast.error("Failed to delete contact");
    },
  });
}

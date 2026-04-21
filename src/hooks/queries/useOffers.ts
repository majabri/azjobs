import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const OFFERS_QUERY_KEY = ["offers"];

type OfferRow = Database["public"]["Tables"]["offers"]["Row"];
type OfferInsert = Database["public"]["Tables"]["offers"]["Insert"];

/** Fetch all offers for the current user */
export function useOffers() {
  const { user, isReady } = useAuthReady();

  return useQuery({
    queryKey: [...OFFERS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as OfferRow[];
    },
    enabled: isReady && !!user,
  });
}

/** Add a new offer */
export function useAddOffer() {
  const queryClient = useQueryClient();
  const { user } = useAuthReady();

  return useMutation({
    mutationFn: async (payload: Omit<OfferInsert, "user_id">) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("offers").insert({
        ...payload,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFERS_QUERY_KEY });
      toast.success("Offer saved");
    },
    onError: () => {
      toast.error("Failed to save offer");
    },
  });
}

/** Update an offer (status, fields, etc.) */
export function useUpdateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OfferInsert> }) => {
      const { error } = await supabase
        .from("offers")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFERS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to update offer");
    },
  });
}

/** Delete an offer */
export function useDeleteOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("offers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFERS_QUERY_KEY });
      toast.success("Offer removed");
    },
    onError: () => {
      toast.error("Failed to delete offer");
    },
  });
}

// src/hooks/useInvites.ts
// Custom hook for invite-related operations.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DAILY_LIMIT = 5;

interface Invitation {
  id: string;
  invite_type: "email" | "code";
  invitee_email: string | null;
  invite_code: string | null;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
}

interface UseInvitesReturn {
  invitations: Invitation[];
  invitesRemaining: number;
  isLoading: boolean;
  sendEmailInvite: (email: string) => Promise<{ success: boolean; error?: string }>;
  generateCode: () => Promise<{ success: boolean; code?: string; error?: string }>;
  refresh: () => Promise<void>;
}

export function useInvites(): UseInvitesReturn {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitesRemaining, setInvitesRemaining] = useState(DAILY_LIMIT);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: invites } = await supabase
        .from("invitations")
        .select("*")
        .eq("inviter_id", user.id)
        .order("created_at", { ascending: false });

      setInvitations(invites || []);

      const today = new Date().toISOString().split("T")[0];
      const todayCount = (invites || []).filter(
        (inv) => inv.created_at.startsWith(today)
      ).length;
      setInvitesRemaining(Math.max(0, DAILY_LIMIT - todayCount));
    } catch (err) {
      console.error("Error fetching invites:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendEmailInvite = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { type: "email", email },
      });

      if (error) return { success: false, error: error.message };
      if (data?.error) return { success: false, error: data.error };

      setInvitesRemaining(data.invites_remaining_today ?? invitesRemaining - 1);
      await refresh();
      return { success: true };
    },
    [refresh, invitesRemaining]
  );

  const generateCode = useCallback(async (): Promise<{
    success: boolean;
    code?: string;
    error?: string;
  }> => {
    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: { type: "code" },
    });

    if (error) return { success: false, error: error.message };
    if (data?.error) return { success: false, error: data.error };

    setInvitesRemaining(data.invites_remaining_today ?? invitesRemaining - 1);
    await refresh();
    return { success: true, code: data.invite_code };
  }, [refresh, invitesRemaining]);

  return {
    invitations,
    invitesRemaining,
    isLoading,
    sendEmailInvite,
    generateCode,
    refresh,
  };
}

// src/lib/api/invites.ts (v2)
// API utilities for the invite system.

import { supabase } from "@/integrations/supabase/client";

export interface ValidateInviteResult {
  valid: boolean;
  reason?: string;
  invitation_id?: string;
  inviter_name?: string;
  invite_type?: string;
  prefilled_email?: string | null;
  expires_at?: string;
}

/**
 * Validate an invite token or code (no auth required).
 */
export async function validateInvite(params: {
  token?: string;
  invite_code?: string;
}): Promise<ValidateInviteResult> {
  const { data, error } = await supabase.functions.invoke("validate-invite", {
    body: params,
  });

  if (error) {
    return { valid: false, reason: "server_error" };
  }

  return data as ValidateInviteResult;
}

/**
 * Accept an invite after successful signup.
 */
export async function acceptInvite(params: {
  token?: string;
  invite_code?: string;
}): Promise<{ success: boolean; error?: string; referral_code?: string }> {
  const { data, error } = await supabase.functions.invoke("accept-invite", {
    body: params,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * Send an invite (email or code).
 */
export async function sendInvite(params: {
  type: "email" | "code";
  email?: string;
}): Promise<{
  success: boolean;
  invitation_id?: string;
  token?: string;
  invite_code?: string;
  invites_remaining_today?: number;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("send-invite", {
    body: params,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return { success: false, error: data.error };
  }

  return { success: true, ...data };
}

/**
 * Fetch admin invite dashboard data.
 */
export async function fetchAdminInviteDashboard() {
  const { data, error } = await supabase.functions.invoke(
    "admin-invite-dashboard"
  );

  if (error) throw error;
  return data;
}

/**
 * Check the current registration mode (public or invite-only).
 * Can be called without auth (uses anon key).
 */
export async function checkRegistrationMode(): Promise<{
  invite_only: boolean;
  mode: "invite_only" | "public";
}> {
  const { data, error } = await supabase.rpc("check_registration_mode");

  if (error) {
    // Default to invite-only if check fails
    return { invite_only: true, mode: "invite_only" };
  }

  return data;
}

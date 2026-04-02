/**
 * Admin Service — Core logic.
 * Owns: admin commands, system management, user management.
 * No imports from other services.
 */

import { supabase } from "@/integrations/supabase/client";

export async function runAdminCommand(
  command: string,
  args: Record<string, any> = {}
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-command`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ command, args }),
      }
    );
    const result = await resp.json();
    if (!resp.ok) return { ok: false, error: result.error || "Command failed" };
    return { ok: true, data: result };
  } catch (e: any) {
    return { ok: false, error: e.message || "Network error" };
  }
}

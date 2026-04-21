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
    const { data, error } = await supabase.functions.invoke("admin-command", {
      body: { command, args },
    });
    if (error) return { ok: false, error: error.message || "Command failed" };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e.message || "Network error" };
  }
}

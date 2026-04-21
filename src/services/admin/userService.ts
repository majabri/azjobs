import { supabase } from "@/integrations/supabase/client";

export async function callAdminManageUser(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("admin-manage-user", {
    body: payload,
  });
  if (error) throw new Error(error.message ?? "Request failed");
  return data;
}

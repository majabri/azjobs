/**
 * fetchWithAuth — thin wrapper around fetch() that automatically attaches the
 * current Supabase access token as an Authorization: Bearer header.
 *
 * Usage:
 *   const resp = await fetchWithAuth("/functions/v1/my-function", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 */

import { supabase } from "@/integrations/supabase/client";

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}

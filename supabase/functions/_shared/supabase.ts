/**
 * Shared Supabase client factory for Edge Functions.
 *
 * Usage:
 *   import { createAnonClient, createServiceClient, getUserFromRequest } from "../_shared/supabase.ts";
 *
 *   // Anon client — respects RLS, use for user-scoped reads
 *   const supabase = createAnonClient(req);
 *
 *   // Service client — bypasses RLS, use for admin ops only
 *   const admin = createServiceClient();
 *
 *   // Auth extraction helper
 *   const user = await getUserFromRequest(req);
 *   if (!user) return errorResponse("Unauthorized", 401);
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Create an anon (row-level-security-enforced) Supabase client.
 *  Optionally forwards the user's Authorization header so calls run as that user. */
export function createAnonClient(req?: Request): SupabaseClient {
  const authHeader = req?.headers.get("Authorization");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

/** Create a service-role Supabase client that bypasses RLS.
 *  Only use for admin operations. */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Extract and verify the Bearer token from a request, returning the
 * authenticated user or null if unauthorized.
 */
export async function getUserFromRequest(
  req: Request,
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email };
}

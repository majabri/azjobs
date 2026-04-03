/**
 * User Service — Auth module.
 * Centralises all authentication operations (email/password, Google OAuth,
 * session management). Callers always receive a normalised string `error`
 * field — never a raw object — so it is safe to render directly in JSX.
 */

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { normalizeError } from "@/lib/normalizeError";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

export interface AuthResult {
  user?: User | null;
  session?: Session | null;
  /** Human-readable error string — safe to render in JSX. */
  error?: string;
}

/** Sign in with email + password via Supabase. */
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: normalizeError(error) };
    return { user: data.user, session: data.session };
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** Initiate Google OAuth via Lovable + sync session into Supabase. */
export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) return { error: normalizeError(result.error) };
    return {};
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** Sign out the current user. */
export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error("logout error:", normalizeError(e));
  }
}

/** Return the currently authenticated user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (e) {
    console.error("getCurrentUser error:", normalizeError(e));
    return null;
  }
}

/** Force a token refresh and return the updated session. */
export async function refreshToken(): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return { error: normalizeError(error) };
    return { user: data.user, session: data.session };
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** Subscribe to Supabase auth state changes. Returns the subscription object. */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}

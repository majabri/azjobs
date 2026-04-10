/**
 * User Service — Auth module.
 * Centralises all authentication operations (email/password, Google OAuth,
 * session management, MFA). Callers always receive a normalised string `error`
 * field — never a raw object — so it is safe to render directly in JSX.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeError } from "@/lib/normalizeError";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

export interface AuthResult {
  user?: User | null;
  session?: Session | null;
  /** Human-readable error string — safe to render in JSX. */
  error?: string;
}

/**
 * Sign up with email + password. Email verification required.
 * Optionally stores a username in the user's metadata for later use.
 */
export async function signup(
  email: string,
  password: string,
  username?: string,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        ...(username ? { data: { username } } : {}),
      },
    });
    if (error) return { error: normalizeError(error) };

    // If a username was provided and signup succeeded, store it in admin_usernames
    if (username && data.user) {
      await supabase
        .from("admin_usernames")
        .upsert(
          { user_id: data.user.id, username },
          { onConflict: "user_id" },
        );
    }

    return { user: data.user, session: data.session };
  } catch (e) {
    return { error: normalizeError(e) };
  }
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

/** Initiate Google OAuth via Supabase. */
export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/login`,
      },
    });
    if (error) return { error: normalizeError(error) };
    return {};
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** Initiate Apple OAuth via Supabase. */
export async function loginWithApple(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/login`,
      },
    });
    if (error) return { error: normalizeError(error) };
    return {};
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/**
 * Link a Google or Apple identity to the currently authenticated user.
 * Uses `linkIdentity` (not `signInWithOAuth`) so Supabase attaches the
 * new provider to the existing account instead of starting a fresh session.
 */
export async function linkWithProvider(provider: "google" | "apple"): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/account-settings`,
      },
    });
    if (error) return { error: normalizeError(error) };
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

// ─── Password Reset ─────────────────────────────────────────────────────────────────

/**
 * Send a password-reset magic link to the given email.
 * Supabase emails a link that redirects to `redirectTo` with a recovery token.
 */
export async function sendPasswordResetEmail(
  email: string,
  redirectTo?: string,
): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo ?? `${window.location.origin}/auth/reset-password`,
    });
    if (error) return { error: normalizeError(error) };
    return {};
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** Update the current user's password (called after they click the magic link). */
export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: normalizeError(error) };
    return {};
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

// ─── MFA (TOTP) ────────────────────────────────────────────────────────────────────

export interface MfaEnrollResult {
  factorId?: string;
  qrUri?: string;
  secret?: string;
  error?: string;
}

/** Enroll a new TOTP factor. Returns QR URI for scanning. */
export async function enrollTOTP(): Promise<MfaEnrollResult> {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator App",
    });
    if (error) return { error: normalizeError(error) };
    return {
      factorId: data.id,
      qrUri: data.totp?.qr_code,
      secret: data.totp?.secret,
    };
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** Verify a TOTP code to activate an enrolled factor. */
export async function verifyTOTP(factorId: string, code: string): Promise<{ error?: string }> {
  try {
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr) return { error: normalizeError(challengeErr) };
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyErr) return { error: normalizeError(verifyErr) };
    return {};
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** Remove an enrolled MFA factor. */
export async function unenrollFactor(factorId: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { error: normalizeError(error) };
    return {};
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/** List all enrolled MFA factors for the current user. */
export async function listFactors(): Promise<{ factors?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { error: normalizeError(error) };
    return { factors: [...(data.totp || []), ...(data.phone || [])] };
  } catch (e) {
    return { error: normalizeError(e) };
  }
}

/**
 * AuthContext — global auth state provider.
 * Exposes the current user/session and auth action helpers to any component
 * without prop-drilling.  Session is sourced from useAuthReady (Supabase
 * onAuthStateChange + getSession) so it persists across page reloads.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { login, loginWithGoogle, logout } from "@/services/user/auth";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  isReady: boolean;
  isAuthenticated: boolean;
  login: typeof login;
  loginWithGoogle: typeof loginWithGoogle;
  logout: typeof logout;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isReady, isAuthenticated } = useAuthReady();

  return (
    <AuthContext.Provider
      value={{ user, isReady, isAuthenticated, login, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Consume the AuthContext. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

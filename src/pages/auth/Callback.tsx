/**
 * /auth/callback — OAuth callback handler.
 * Handles the PKCE code exchange for Google and Apple OAuth flows.
 * Supabase redirects here after the provider authenticates the user.
 *
 * The Supabase client (detectSessionInUrl: true by default) automatically
 * exchanges the ?code= parameter for a session on initialization.
 * This page just needs to wait for that exchange to complete, then redirect.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { usePostLoginRedirect } from "@/hooks/usePostLoginRedirect";
import DashboardModeDialog from "@/components/DashboardModeDialog";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const { destination, showModePrompt, setShowModePrompt, isResolving } =
    usePostLoginRedirect();

  // Tracks whether we've already navigated away due to an OAuth error
  const hasError = useRef(false);

  // Forward any OAuth provider errors back to the login page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");

    if (errorParam) {
      hasError.current = true;
      const msg = errorDescription || errorParam;
      navigate(`/auth/login?error=${encodeURIComponent(msg)}`, { replace: true });
      return;
    }
  }, [navigate]);

  // Redirect once the session is established and the role is resolved.
  // The Supabase client exchanges the PKCE code automatically (detectSessionInUrl: true),
  // which triggers onAuthStateChange → useAuthReady updates user state.
  useEffect(() => {
    if (hasError.current) return;
    if (!isReady || !user || isResolving || !destination) return;
    if (showModePrompt) return;
    navigate(destination, { replace: true });
  }, [isReady, user, isResolving, destination, showModePrompt, navigate]);

  return (
    <>
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-label="Signing in"
      >
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
      <DashboardModeDialog
        open={showModePrompt}
        onSelect={(route) => {
          setShowModePrompt(false);
          navigate(route, { replace: true });
        }}
      />
    </>
  );
}

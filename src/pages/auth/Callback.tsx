/**
 * /auth/callback — OAuth callback handler.
 * Handles the PKCE code exchange for Google and Apple OAuth flows.
 * Supabase redirects here after the provider authenticates the user.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { usePostLoginRedirect } from "@/hooks/usePostLoginRedirect";
import DashboardModeDialog from "@/components/DashboardModeDialog";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const { destination, showModePrompt, setShowModePrompt, isResolving } =
    usePostLoginRedirect();

  // Exchange the PKCE code for a session on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");

    if (errorParam) {
      const msg = errorDescription || errorParam;
      navigate(`/auth/login?error=${encodeURIComponent(msg)}`, { replace: true });
      return;
    }

    if (!code) {
      // No code and no error — unexpected URL, send back to login
      navigate("/auth/login", { replace: true });
      return;
    }

    supabase.auth.exchangeCodeForSession(code).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please try again.";
      navigate(`/auth/login?error=${encodeURIComponent(msg)}`, { replace: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect once the session is established and the role is resolved
  useEffect(() => {
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

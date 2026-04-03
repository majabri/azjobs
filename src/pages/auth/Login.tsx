/**
 * /auth/login — Primary login page.
 * Supports Google OAuth and email/password sign-in.
 * All errors are normalised to strings via normalizeError before being
 * stored in component state, so no raw object ever reaches JSX (prevents
 * React error #306).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { login, loginWithGoogle } from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  /** Always a string (or null) — never a raw object. Safe to render. */
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect already-authenticated users to the dashboard.
  useEffect(() => {
    if (isReady && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, navigate, user]);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoadingGoogle(true);
    try {
      const result = await loginWithGoogle();
      if (result.error) {
        setErrorMsg(result.error);
        setLoadingGoogle(false);
      }
      // On success the Supabase session update triggers useAuthReady → re-render → navigate above.
    } catch (e) {
      setErrorMsg(normalizeError(e));
      setLoadingGoogle(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setErrorMsg(null);
    setLoadingEmail(true);
    try {
      const result = await login(email.trim(), password);
      if (result.error) {
        setErrorMsg(result.error);
      }
      // On success, navigate handled by the useEffect above.
    } catch (e) {
      setErrorMsg(normalizeError(e));
    } finally {
      setLoadingEmail(false);
    }
  };

  const loading = loadingGoogle || loadingEmail;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 gradient-teal rounded-2xl flex items-center justify-center shadow-teal">
            <Target className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-primary">FitCheck</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to save your analyses and track your progress
          </p>
        </div>

        {/* Google sign-in */}
        <Button
          className="w-full py-6 text-base font-semibold bg-card border border-border text-foreground hover:bg-muted transition-colors"
          variant="outline"
          disabled={loading}
          onClick={handleGoogleLogin}
          aria-label="Sign in with Google"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loadingGoogle ? "Signing in…" : "Continue with Google"}
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">or continue with email</span>
          </div>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Error message — always a string, never a raw object */}
          {errorMsg && (
            <p role="alert" className="text-sm text-destructive">
              {errorMsg}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email.trim() || !password}
          >
            {loadingEmail ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <a href="/auth/signup" className="text-primary hover:underline font-medium">
            Sign up
          </a>
        </p>

        <p className="text-xs text-muted-foreground">
          By signing in, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}

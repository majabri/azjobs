/**
 * /auth/reset-password — Set a new password after clicking the magic link.
 * Supabase redirects here with a recovery token in the URL hash.
 * The Supabase client auto-exchanges the token for a session, so by the
 * time this page renders the user is authenticated and can call updateUser.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, CheckCircle, Loader2 } from "lucide-react";
import { updatePassword } from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);

  // Wait for Supabase to exchange the recovery token for a session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setChecking(false);
        }
      },
    );

    // Also check if already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setChecking(false);
    });

    // Timeout after 10s so we don't spin forever
    const timer = setTimeout(() => setChecking(false), 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setErrorMsg(normalizeError(e));
    } finally {
      setLoading(false);
    }
  };

  // Loading while Supabase processes the recovery token
  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-14 h-14 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Password Updated
            </h1>
            <p className="text-muted-foreground text-sm">
              Your password has been successfully reset. You can now sign in
              with your new password.
            </p>
          </div>
          <Button className="w-full" onClick={() => navigate("/auth/login")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 gradient-teal rounded-2xl flex items-center justify-center shadow-teal">
            <Target className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-primary">
            Set New Password
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm text-destructive">
              {errorMsg}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? "Updating password\u2026" : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

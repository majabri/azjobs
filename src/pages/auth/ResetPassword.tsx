/**
 * /auth/reset-password — Set a new password after clicking the magic link.
 * Supabase redirects here with a recovery token in the URL hash.
 * The Supabase client auto-exchanges the token for a session, so by the
 * time this page renders the user is authenticated and can call updateUser.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, CheckCircle, Loader2 } from "lucide-react";
import { updatePassword } from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";
import { supabase } from "@/integrations/supabase/client";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/lib/schemas";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Wait for Supabase to exchange the recovery token for a session
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setChecking(false);
      }
    });

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

  const onSubmit = async ({ password }: ResetPasswordFormValues) => {
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError("root", { message: result.error });
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setError("root", { message: normalizeError(e) });
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
          <div className="w-14 h-14 gradient-indigo rounded-2xl flex items-center justify-center shadow-indigo-500/20">
            <Target className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-primary">
            Set New Password
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
          <div className="space-y-1">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p role="alert" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              disabled={isSubmitting}
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p role="alert" className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating password\u2026" : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

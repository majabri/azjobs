/**
 * /auth/forgot-password — Request a password-reset magic link.
 * Supports email or admin username. If a username is entered,
 * it resolves the email via resolve_admin_email before sending.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowLeft, Mail } from "lucide-react";
import { sendPasswordResetEmail } from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) return;

    setErrorMsg(null);
    setLoading(true);
    try {
      let email = id;

      // If it doesn't look like an email, try resolving as a username
      if (!id.includes("@")) {
        const { data: resolved, error: rpcError } = await supabase.rpc(
          "resolve_admin_email",
          { _username: id },
        );
        if (rpcError || !resolved) {
          setErrorMsg("We couldn't find an account with that username.");
          setLoading(false);
          return;
        }
        email = resolved;
      }

      const result = await sendPasswordResetEmail(email);
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

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Mail className="w-14 h-14 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Check your email
            </h1>
            <p className="text-muted-foreground text-sm">
              We sent a password reset link to your email address. Click the
              link in the email to set a new password.
            </p>
          </div>
          <Link to="/auth/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </Link>
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
            Reset Password
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your email or username and we'll send you a magic link to
            reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1">
            <Label htmlFor="identifier">Email or Username</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              placeholder="you@example.com or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              required
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
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
            disabled={loading || !identifier.trim()}
          >
            {loading ? "Sending link\u2026" : "Send Reset Link"}
          </Button>
        </form>

        <Link
          to="/auth/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

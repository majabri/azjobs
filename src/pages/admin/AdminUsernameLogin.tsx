import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminUsernameLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot-password state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Redirect already-authenticated admins to the admin dashboard
  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || !session?.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.role === "admin") {
        navigate("/admin", { replace: true });
      }
    }).catch((err) => {
      console.error("Failed to check admin session:", err);
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      // Resolve username to email via the secure RPC
      let email = username;
      if (!username.includes("@")) {
        const { data: resolved, error: rpcError } = await supabase.rpc(
          "resolve_admin_email",
          { _username: username }
        );
        if (rpcError || !resolved) {
          toast.error("Invalid username or password.");
          return;
        }
        email = resolved;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Invalid username or password.");
        return;
      }

      toast.success("Login successful!");
      navigate("/admin", { replace: true });
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetIdentifier) return;

    setLoading(true);
    try {
      // Resolve username to email if needed
      let email = resetIdentifier;
      if (!resetIdentifier.includes("@")) {
        const { data: resolved, error: rpcError } = await supabase.rpc(
          "resolve_admin_email",
          { _username: resetIdentifier }
        );
        if (rpcError || !resolved) {
          // Don't reveal whether username exists; show generic success message
          setResetSent(true);
          return;
        }
        email = resolved;
      }

      const redirectTo = `${window.location.origin}/admin/set-password`;
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      setResetSent(true);
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot-password: confirmation screen ──────────────────────────────────
  if (forgotMode && resetSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 bg-destructive/80 rounded-2xl flex items-center justify-center shadow-lg">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Check your email
            </h1>
            <p className="text-muted-foreground text-sm">
              If that account exists, a password-reset link has been sent to the
              associated email address. Follow the link to set a new password.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setForgotMode(false);
              setResetSent(false);
              setResetIdentifier("");
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  // ── Forgot-password: input screen ─────────────────────────────────────────
  if (forgotMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 bg-destructive/80 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Reset Password
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter your username or email address and we'll send you a
              password-reset link.
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-identifier" className="text-sm font-medium">
                Username or Email
              </Label>
              <Input
                id="reset-identifier"
                name="reset-identifier"
                type="text"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                required
                autoComplete="username"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                disabled={loading}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-destructive/80 hover:bg-destructive text-white"
              disabled={loading || !resetIdentifier}
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setResetIdentifier("");
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Normal login ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 bg-destructive/80 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Admin Login
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in with your username or email and password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-sm font-medium">
              Username or Email
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-destructive/80 hover:bg-destructive text-white"
            disabled={loading || !username || !password}
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}

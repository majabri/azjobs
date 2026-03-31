import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "sonner";

/** Resolve a username (no @) to the corresponding email address via profiles lookup. */
async function resolveEmailFromUsername(username: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .ilike("username", username)
    .maybeSingle();
  return (data as { email?: string } | null)?.email ?? null;
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const { isAdmin, isLoading: roleLoading } = useAdminRole();

  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (isReady && !roleLoading && user && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isReady, roleLoading, user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;

    setLoading(true);
    try {
      // Determine whether the identifier is an email or username
      let email = identifier.trim();
      if (!email.includes("@")) {
        // Treat as username – look up the real email
        const resolved = await resolveEmailFromUsername(email);
        if (!resolved) {
          toast.error("No account found for that username.");
          setLoading(false);
          return;
        }
        email = resolved;
      }

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin/login` },
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Account created! Check your email to confirm, then sign in.");
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
        }
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 bg-destructive/80 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Admin Login</h1>
          <p className="text-muted-foreground text-sm">
            {isSignUp ? "Create your admin account" : "Sign in to access the admin control center"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-sm font-medium">Email or Username</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="admin@example.com or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
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
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-destructive/80 hover:bg-destructive text-white"
            disabled={loading || !identifier || !password}
          >
            {loading ? (isSignUp ? "Creating account…" : "Signing in…") : (isSignUp ? "Create Account" : "Sign in")}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsSignUp((v) => !v)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            {isSignUp ? "Already have an account? Sign in" : "First time? Create account"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Only authorized administrators may access this area.
        </p>
      </div>
    </div>
  );
}

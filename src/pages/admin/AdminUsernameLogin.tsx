import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "sonner";

/** Resolve a username to the corresponding email address via a secure RPC that only returns admin emails. */
async function resolveEmailFromUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_admin_email", { _username: username });
  if (error || !data) return null;
  return data as string;
}

export default function AdminUsernameLogin() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const { isAdmin, isLoading: roleLoading } = useAdminRole();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isReady && !roleLoading && user && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isReady, roleLoading, user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      const resolved = await resolveEmailFromUsername(username.trim());
      if (!resolved) {
        toast.error("No account found for that username.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: resolved,
        password,
      });

      if (error) {
        toast.error(error.message);
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
          <p className="text-muted-foreground text-sm">Sign in to access the admin control center</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-sm font-medium">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="azadmin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-destructive/80 hover:bg-destructive text-white"
            disabled={loading || !username || !password}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">Only authorized administrators may access this area.</p>
      </div>
    </div>
  );
}
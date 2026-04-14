/**
 * /auth/signup — Registration page.
 * Email/password signup with email verification required.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, CheckCircle } from "lucide-react";
import { signup } from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !confirmPassword) { setErrorMsg("All fields are required."); return; }

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
      const result = await signup(email.trim(), password, username.trim() || undefined);
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
            <CheckCircle className="w-14 h-14 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Check your email</h1>
            <p className="text-muted-foreground text-sm">
              We sent a verification link to <strong>{email}</strong>. Please verify your email to continue.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate("/auth/login")}>
            Back to Sign In
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
          <h1 className="font-display text-3xl font-bold text-primary">Create Account</h1>
          <p className="text-muted-foreground text-sm">
            Join iCareerOS to optimize your job search
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4 text-left">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" type="email" autoComplete="email"
              placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={loading} required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="username">Username <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="username" type="text" autoComplete="username"
              placeholder="e.g. johndoe"
              value={username} onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              spellCheck={false} autoCapitalize="none" autoCorrect="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password" type="password" autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={loading} required minLength={8}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword" type="password" autoComplete="new-password"
              placeholder="Repeat password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading} required
            />
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm text-destructive">{errorMsg}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !email.trim() || !password || !confirmPassword}>
            {loading ? "Creating account\u2026" : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

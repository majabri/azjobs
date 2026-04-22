/**
 * /auth/signup — Registration page.
 * Email/password signup with email verification required.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, CheckCircle } from "lucide-react";
import { signup } from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";
import { signupSchema, type SignupFormValues } from "@/lib/schemas";

export default function SignupPage() {
  const navigate = useNavigate();
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    getValues,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
    },
  });

  const onSubmit = async ({ email, password, fullName }: SignupFormValues) => {
    try {
      const result = await signup(
        email.trim(),
        password,
        fullName?.trim() || undefined,
      );
      if (result.error) {
        setError("root", { message: result.error });
      } else {
        setVerifyEmail(email.trim());
      }
    } catch (e) {
      setError("root", { message: normalizeError(e) });
    }
  };

  if (verifyEmail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-14 h-14 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Check your email
            </h1>
            <p className="text-muted-foreground text-sm">
              We sent a verification link to <strong>{verifyEmail}</strong>.
              Please verify your email to continue.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/auth/login")}
          >
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
          <h1 className="font-display text-3xl font-bold text-primary">
            Create Account
          </h1>
          <p className="text-muted-foreground text-sm">
            Join iCareerOS to optimize your job search
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p role="alert" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="fullName">
              Full Name{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="e.g. Jane Doe"
              disabled={isSubmitting}
              aria-invalid={!!errors.fullName}
              {...register("fullName")}
            />
            {errors.fullName && (
              <p role="alert" className="text-xs text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
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
            <Label htmlFor="confirmPassword">Confirm Password</Label>
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
            {isSubmitting ? "Creating account\u2026" : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/auth/login"
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// src/pages/auth/SignUpWithInvite.tsx (v2)
// Unified signup page that handles three modes:
//   1. Magic link arrival (?invite=TOKEN&email=...&magic=1)
//      â Auto-validates invite, signs in via OTP, accepts invite
//   2. Invite-only mode (feature flag enabled)
//      â Shows InviteGate, then signup form
//   3. Public access mode (feature flag disabled)
//      â Shows standard signup form (no invite required)

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, CheckCircle2 } from "lucide-react";
import { InviteGate, InvitedByBadge } from "@/components/invite/InviteGate";
import type { InvitationData } from "@/components/invite/InviteGate";

type RegistrationMode = "loading" | "invite_only" | "public";
type SignupStep = "gate" | "magic_link" | "form" | "magic_complete";

export default function SignUpWithInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Registration mode (controlled by admin toggle)
  const [regMode, setRegMode] = useState<RegistrationMode>("loading");

  // Which step of the flow we're on
  const [step, setStep] = useState<SignupStep>("gate");

  // Invite state
  const [invitationData, setInvitationData] = useState<InvitationData | null>(
    null
  );

  // Magic link state
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [isMagicLinkProcessing, setIsMagicLinkProcessing] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // Standard form state
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // =====================================================
  // 1. Check registration mode + detect magic link arrival
  // =====================================================
  useEffect(() => {
    async function init() {
      // Check if this is a magic link arrival
      const inviteToken = searchParams.get("invite");
      const emailParam = searchParams.get("email");
      const isMagic = searchParams.get("magic") === "1";

      if (isMagic && inviteToken && emailParam) {
        // Magic link flow: auto-validate and show OTP verification
        setMagicLinkEmail(emailParam);
        setStep("magic_link");
        setRegMode("invite_only");

        // Validate the invite token in background
        try {
          const { data } = await supabase.functions.invoke("validate-invite", {
            body: { token: inviteToken },
          });

          if (data?.valid) {
            setInvitationData({
              invitation_id: data.invitation_id,
              inviter_name: data.inviter_name,
              invite_type: data.invite_type,
              prefilled_email: data.prefilled_email,
              expires_at: data.expires_at,
              token: inviteToken,
            });
          }
        } catch {
          // Non-blocking â we still show the OTP form
        }
        return;
      }

      // Check feature flag for registration mode
      try {
        const { data } = await supabase.rpc("check_registration_mode");

        if (data?.invite_only) {
          setRegMode("invite_only");
          // If there's an invite token in URL, auto-validate via InviteGate
          if (inviteToken) {
            setStep("gate");
          } else {
            setStep("gate");
          }
        } else {
          setRegMode("public");
          setStep("form");
        }
      } catch {
        // Default to invite-only if we can't check
        setRegMode("invite_only");
        setStep("gate");
      }
    }

    init();
  }, [searchParams]);

  // =====================================================
  // 2. Magic Link: Verify OTP and complete registration
  // =====================================================
  async function handleMagicLinkVerify(e: React.FormEvent) {
    e.preventDefault();
    setIsMagicLinkProcessing(true);
    setFormError(null);

    try {
      // Verify the OTP code sent to the invited email
      const { data: authData, error: authError } =
        await supabase.auth.verifyOtp({
          email: magicLinkEmail,
          token: otpCode,
          type: "email",
        });

      if (authError) {
        setFormError(
          authError.message.includes("expired")
            ? "This code has expired. Please ask for a new invitation."
            : authError.message
        );
        return;
      }

      if (!authData.user) {
        setFormError("Verification failed. Please try again.");
        return;
      }

      // Accept the invite to link referral tree
      if (invitationData?.token) {
        try {
          await supabase.functions.invoke("accept-invite", {
            body: { token: invitationData.token },
          });
        } catch {
          // Non-blocking
          console.error("Accept invite failed after magic link signup");
        }
      }

      setStep("magic_complete");

      toast.success("Welcome to iCareerOS!", {
        description: invitationData?.inviter_name
          ? `Invited by ${invitationData.inviter_name}`
          : "Your account is ready.",
      });

      // Redirect to dashboard after short delay
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setIsMagicLinkProcessing(false);
    }
  }

  // =====================================================
  // 3. InviteGate validated callback
  // =====================================================
  function handleInviteValidated(invitation: InvitationData) {
    setInvitationData(invitation);
    if (invitation.prefilled_email) {
      setEmail(invitation.prefilled_email);
    }
    setStep("form");
  }

  // =====================================================
  // 4. Standard signup (email + password)
  // =====================================================
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!email || !password || !confirmPassword) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || undefined,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setFormError(
            "This email is already registered. Try logging in instead."
          );
        } else {
          setFormError(authError.message);
        }
        return;
      }

      if (!authData.user) {
        setFormError("Signup failed. Please try again.");
        return;
      }

      // Accept invite if we have one
      if (invitationData) {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.access_token) {
          try {
            await supabase.functions.invoke("accept-invite", {
              body: {
                token: invitationData.token || undefined,
                invite_code: invitationData.invite_code || undefined,
              },
            });
          } catch {
            console.error("Accept invite error â non-blocking");
          }
        }
      }

      toast.success("Welcome to iCareerOS!", {
        description: invitationData?.inviter_name
          ? `Invited by ${invitationData.inviter_name}`
          : "Your account has been created.",
      });

      navigate("/dashboard");
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // =====================================================
  // RENDER: Loading state
  // =====================================================
  if (regMode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // =====================================================
  // RENDER: Magic link completion screen
  // =====================================================
  if (step === "magic_complete") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're In!</h2>
            <p className="text-muted-foreground">
              Welcome to iCareerOS. Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =====================================================
  // RENDER: Magic link OTP verification
  // =====================================================
  if (step === "magic_link") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                <Mail className="h-7 w-7 text-accent" />
              </div>
              {invitationData && (
                <div className="flex justify-center mb-3">
                  <InvitedByBadge
                    inviterName={invitationData.inviter_name || "a friend"}
                  />
                </div>
              )}
              <CardTitle className="text-2xl font-bold">
                Complete Your Registration
              </CardTitle>
              <CardDescription className="text-base mt-2">
                We sent a verification code to{" "}
                <strong>{magicLinkEmail}</strong>. Enter it below to activate
                your account.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleMagicLinkVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code from your email"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setFormError(null);
                    }}
                    disabled={isMagicLinkProcessing}
                    className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                    autoFocus
                    maxLength={6}
                  />
                </div>

                {formError && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {formError}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-accent hover:bg-accent/90 text-white"
                  disabled={isMagicLinkProcessing || otpCode.length < 6}
                >
                  {isMagicLinkProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code? Check your spam folder or ask the
                  person who invited you to send a new invitation.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER: Invite gate (invite-only mode, no invite yet)
  // =====================================================
  if (step === "gate" && regMode === "invite_only") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <InviteGate onValidated={handleInviteValidated} />
      </div>
    );
  }

  // =====================================================
  // RENDER: Standard signup form
  // (shown after invite validation OR in public mode)
  // =====================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center pb-4">
            {invitationData && (
              <div className="flex justify-center mb-3">
                <InvitedByBadge
                  inviterName={invitationData.inviter_name || "a friend"}
                />
              </div>
            )}
            <CardTitle className="text-2xl font-bold">
              Create Your Account
            </CardTitle>
            <CardDescription>
              Join iCareerOS â the AI-powered Career Operating System
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* OAuth buttons */}
            <div className="space-y-2 mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={async () => {
                  const inviteParam =
                    invitationData?.token ||
                    invitationData?.invite_code ||
                    "";
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback${inviteParam ? `?invite=${inviteParam}` : ""}`,
                    },
                  });
                }}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={async () => {
                  const inviteParam =
                    invitationData?.token ||
                    invitationData?.invite_code ||
                    "";
                  await supabase.auth.signInWithOAuth({
                    provider: "apple",
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback${inviteParam ? `?invite=${inviteParam}` : ""}`,
                    },
                  });
                }}
              >
                <svg
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continue with Apple
              </Button>
            </div>

            <div className="relative my-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or sign up with email
              </span>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={
                    isSubmitting || !!invitationData?.prefilled_email
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username (optional)</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="coolcareerpilot"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-accent hover:bg-accent/90 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/auth/login"
                className="text-accent hover:underline font-medium"
              >
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

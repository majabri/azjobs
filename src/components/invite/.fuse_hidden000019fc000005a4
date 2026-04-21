// src/components/invite/InviteGate.tsx
// Gate component that wraps the signup form â validates invite tokens/codes before allowing signup.

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldX, Mail } from "lucide-react";

export interface InvitationData {
  invitation_id: string;
  inviter_name: string;
  invite_type: string;
  prefilled_email: string | null;
  expires_at: string;
  token?: string;
  invite_code?: string;
}

interface InviteGateProps {
  onValidated: (invitation: InvitationData) => void;
}

export function InviteGate({ onValidated }: InviteGateProps) {
  const [searchParams] = useSearchParams();
  const [inviteCode, setInviteCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoChecked, setAutoChecked] = useState(false);

  // Auto-validate if ?invite= param is present
  useEffect(() => {
    const token = searchParams.get("invite");
    if (token && !autoChecked) {
      setAutoChecked(true);
      validateInvite({ token });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- validateInvite is stable; intentional mount-only effect
  }, [searchParams, autoChecked]);

  async function validateInvite(params: { token?: string; invite_code?: string }) {
    setIsValidating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "validate-invite",
        {
          body: params,
        }
      );

      if (fnError) {
        setError("Unable to verify your invite. Please try again.");
        return;
      }

      if (!data.valid) {
        const messages: Record<string, string> = {
          not_found: "This invite code wasn't recognized. Double-check and try again.",
          expired: "This invite has expired. Ask your friend to send a new one.",
          already_used: "This invite has already been claimed by someone else.",
          revoked: "This invite is no longer active.",
        };
        setError(messages[data.reason] || "Invalid invite.");
        return;
      }

      onValidated({
        invitation_id: data.invitation_id,
        inviter_name: data.inviter_name,
        invite_type: data.invite_type,
        prefilled_email: data.prefilled_email,
        expires_at: data.expires_at,
        token: params.token,
        invite_code: params.invite_code,
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsValidating(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inviteCode.trim();
    if (!trimmed) return;

    // Detect if it looks like a full URL with token
    if (trimmed.includes("invite=")) {
      try {
        const url = new URL(trimmed);
        const token = url.searchParams.get("invite");
        if (token) {
          validateInvite({ token });
          return;
        }
      } catch {
        // Not a URL â treat as code
      }
    }

    validateInvite({ invite_code: trimmed });
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
            <ShieldCheck className="h-7 w-7 text-[hsl(var(--primary))]" />
          </div>
          <CardTitle className="text-2xl font-bold">
            iCareerOS is Invite-Only
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Enter your invite code to create an account. Don't have one? Ask an
            existing member to invite you.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter invite code (e.g. AMIR-7X3K)"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                disabled={isValidating}
                className="text-center text-lg tracking-wider font-mono h-12"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <ShieldX className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[hsl(var(--primary))] hover:bg-[#00A89A] text-white"
              disabled={isValidating || !inviteCode.trim()}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Invite"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an invite code?
            </p>
            <a
              href="https://icareeros.com"
              className="inline-flex items-center gap-1 mt-1 text-sm text-[hsl(var(--primary))] hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              Join the waitlist
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component: shows who invited you after validation
export function InvitedByBadge({ inviterName }: { inviterName: string }) {
  return (
    <Badge
      variant="secondary"
      className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/15"
    >
      <ShieldCheck className="h-3 w-3 mr-1" />
      Invited by {inviterName}
    </Badge>
  );
}

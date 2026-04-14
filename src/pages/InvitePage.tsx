// src/pages/InvitePage.tsx
// Authenticated page where users can send invites and track their invite history.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Send,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
} from "lucide-react";

interface Invitation {
  id: string;
  invite_type: "email" | "code";
  invitee_email: string | null;
  invite_code: string | null;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
}

interface ReferralEntry {
  user_id: string;
  depth: number;
  profiles?: { username?: string; full_name?: string };
}

const DAILY_LIMIT = 5;

export default function InvitePage() {
  // State
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [invitesRemaining, setInvitesRemaining] = useState(DAILY_LIMIT);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's invitations
      const { data: invites } = await supabase
        .from("invitations")
        .select("*")
        .eq("inviter_id", user.id)
        .order("created_at", { ascending: false });

      setInvitations(invites || []);

      // Calculate today's remaining
      const today = new Date().toISOString().split("T")[0];
      const todayCount = (invites || []).filter(
        (inv) => inv.created_at.startsWith(today)
      ).length;
      setInvitesRemaining(Math.max(0, DAILY_LIMIT - todayCount));

      // Find active code invite (most recent pending code)
      const activeCodeInvite = (invites || []).find(
        (inv) => inv.invite_type === "code" && inv.status === "pending"
      );
      setActiveCode(activeCodeInvite?.invite_code || null);

      // Fetch direct referrals
      const { data: refs } = await supabase
        .from("referral_tree")
        .select("user_id, depth")
        .eq("invited_by", user.id);

      setReferrals(refs || []);
    } catch (err) {
      console.error("Error fetching invite data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSendEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || invitesRemaining <= 0) return;

    setIsSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { type: "email", email: inviteEmail.trim() },
      });

      if (error) {
        toast.error("Failed to send invite", { description: error.message });
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      setInvitesRemaining(data.invites_remaining_today ?? invitesRemaining - 1);
      fetchData();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleGenerateCode() {
    if (invitesRemaining <= 0) return;

    setIsGeneratingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { type: "code" },
      });

      if (error) {
        toast.error("Failed to generate code", { description: error.message });
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setActiveCode(data.invite_code);
      setInvitesRemaining(data.invites_remaining_today ?? invitesRemaining - 1);
      toast.success("New invite code generated!");
      fetchData();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsGeneratingCode(false);
    }
  }

  function handleCopyCode() {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyLink() {
    const pendingToken = invitations.find(
      (inv) => inv.status === "pending" && inv.invite_type === "code"
    );
    if (pendingToken) {
      const url = `https://icareeros.com/auth/signup?invite=${pendingToken.token}`;
      navigator.clipboard.writeText(url);
      toast.success("Invite link copied!");
    }
  }

  const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    pending: { label: "Pending", color: "bg-accent/10 text-accent border-accent/20", icon: Clock },
    accepted: { label: "Accepted", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
    expired: { label: "Expired", color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: XCircle },
    revoked: { label: "Revoked", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const limitReached = invitesRemaining <= 0;
  const acceptedCount = invitations.filter((i) => i.status === "accepted").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Invite Friends to iCareerOS</h1>
        <p className="text-muted-foreground mt-1">
          Share invite codes or send email invitations to grow the community.
        </p>
      </div>

      {/* Daily Limit Counter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Invites Remaining Today
            </span>
            <span className="text-2xl font-bold text-accent">
              {invitesRemaining}
              <span className="text-sm font-normal text-muted-foreground"> / {DAILY_LIMIT}</span>
            </span>
          </div>
          <Progress
            value={(invitesRemaining / DAILY_LIMIT) * 100}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Resets daily at midnight UTC
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Email Invite */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-accent" />
              Send Email Invite
            </CardTitle>
            <CardDescription>
              We'll send them a direct signup link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendEmailInvite} className="space-y-3">
              <Input
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={limitReached || isSendingEmail}
              />
              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90 text-white"
                disabled={limitReached || isSendingEmail || !inviteEmail.trim()}
              >
                {isSendingEmail ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {limitReached ? "Limit Reached" : "Send Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Shareable Code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-brand-gold" />
              Share Your Code
            </CardTitle>
            <CardDescription>
              Share this code via text, DM, or anywhere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeCode ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-center font-mono text-xl tracking-widest font-bold">
                    {activeCode}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="w-full text-muted-foreground"
                >
                  <LinkIcon className="mr-2 h-3.5 w-3.5" />
                  Copy invite link instead
                </Button>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground mb-3">
                  No active code. Generate one to share.
                </p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGenerateCode}
              disabled={limitReached || isGeneratingCode}
            >
              {isGeneratingCode ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Generate New Code
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{invitations.length}</div>
            <div className="text-sm text-muted-foreground">Total Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-600">{acceptedCount}</div>
            <div className="text-sm text-muted-foreground">Accepted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-accent">{referrals.length}</div>
            <div className="text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5 inline mr-1" />
              Your Network
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite History</CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No invitations sent yet. Share the love!
            </p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => {
                const config = statusConfig[inv.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">
                          {inv.invite_type === "email"
                            ? inv.invitee_email
                            : `Code: ${inv.invite_code}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {inv.invite_type === "email" ? "Email" : "Code"} &middot;{" "}
                          {new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

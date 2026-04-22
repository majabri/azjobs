// src/components/career/ReferralProgram.tsx
// Referral Program section for the Career Profile page.
// Replaces the standalone /invites route â this is embedded directly
// in the user's career profile under "Referral Program."

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Gift,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { logger } from "@/lib/logger";

interface Invitation {
  id: string;
  invite_type: string;
  invitee_email: string | null;
  invite_code: string | null;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
  inviter_id?: string;
  accepted_at?: string | null;
  accepted_by?: string | null;
}

const DAILY_LIMIT = 5;

export default function ReferralProgram() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [invitesRemaining, setInvitesRemaining] = useState(DAILY_LIMIT);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userReferralCode, setUserReferralCode] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      const todayCount = (invites || []).filter((inv) =>
        inv.created_at.startsWith(today),
      ).length;
      setInvitesRemaining(Math.max(0, DAILY_LIMIT - todayCount));

      // Find active code invite
      const activeCodeInvite = (invites || []).find(
        (inv) => inv.invite_type === "code" && inv.status === "pending",
      );
      setActiveCode(activeCodeInvite?.invite_code || null);

      // Fetch direct referral count
      const { count } = await supabase
        .from("referral_tree")
        .select("id", { count: "exact", head: true })
        .eq("invited_by", user.id);

      setReferralCount(count || 0);

      // Fetch user's own referral code (if available)
      // Note: referral_code may not exist in profiles table
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("referral_code")
          .eq("user_id", user.id)
          .single();

        setUserReferralCode((profile as any)?.referral_code || null);
      } catch {
        // referral_code column may not exist, skip
      }
    } catch (err) {
      logger.error("Error fetching referral data:", err);
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

      toast.success(`Magic link sent to ${inviteEmail}`, {
        description: "They'll receive an email to complete registration.",
      });
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
      (inv) => inv.status === "pending" && inv.invite_type === "code",
    );
    if (pendingToken) {
      const url = `${window.location.origin}/auth/signup?invite=${pendingToken.token}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  const statusConfig: Record<
    string,
    { label: string; color: string; icon: typeof CheckCircle2 }
  > = {
    pending: {
      label: "Pending",
      color:
        "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/20",
      icon: Clock,
    },
    accepted: {
      label: "Joined",
      color: "bg-green-500/10 text-green-600 border-green-500/20",
      icon: CheckCircle2,
    },
    expired: {
      label: "Expired",
      color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      icon: XCircle,
    },
    revoked: {
      label: "Revoked",
      color: "bg-red-500/10 text-red-500 border-red-500/20",
      icon: XCircle,
    },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  const limitReached = invitesRemaining <= 0;
  const acceptedCount = invitations.filter(
    (i) => i.status === "accepted",
  ).length;
  const pendingCount = invitations.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
            <Gift className="h-5 w-5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Referral Program</h2>
            <p className="text-sm text-muted-foreground">
              Invite colleagues and grow your professional network
            </p>
          </div>
        </div>
        {userReferralCode && (
          <Badge
            variant="outline"
            className="bg-brand-gold/10 text-brand-gold border-brand-gold/20 font-mono"
          >
            Your Code: {userReferralCode}
          </Badge>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="text-2xl font-bold">{invitations.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {acceptedCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Joined</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="text-2xl font-bold text-brand-gold">
              {pendingCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="text-2xl font-bold text-[hsl(var(--primary))]">
              {referralCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Users className="h-3 w-3" />
              Network
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Limit */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Daily Invites Remaining</span>
            <span className="text-lg font-bold text-[hsl(var(--primary))]">
              {invitesRemaining}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / {DAILY_LIMIT}
              </span>
            </span>
          </div>
          <Progress
            value={(invitesRemaining / DAILY_LIMIT) * 100}
            className="h-1.5"
          />
        </CardContent>
      </Card>

      {/* Invite Tabs */}
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Invite by Email
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Share a Code
          </TabsTrigger>
        </TabsList>

        {/* Email Invite Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[hsl(var(--primary))]" />
                Send Email Invitation
              </CardTitle>
              <CardDescription>
                They'll receive a magic link to register directly with this
                email address. No password setup needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendEmailInvite} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={limitReached || isSendingEmail}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  className="bg-[hsl(var(--primary))] hover:bg-[#00A89A] text-white shrink-0"
                  disabled={
                    limitReached || isSendingEmail || !inviteEmail.trim()
                  }
                >
                  {isSendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">
                    {limitReached ? "Limit Reached" : "Send"}
                  </span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Tab */}
        <TabsContent value="code">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-brand-gold" />
                Shareable Invite Code
              </CardTitle>
              <CardDescription>
                Share this code via text, DM, or anywhere. They'll enter it at
                signup.
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
                    {copiedLink ? (
                      <Check className="mr-2 h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <LinkIcon className="mr-2 h-3.5 w-3.5" />
                    )}
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
        </TabsContent>
      </Tabs>

      {/* Invite History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Invite History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              No invitations sent yet. Start growing your network!
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {invitations.slice(0, 20).map((inv) => {
                const config = statusConfig[inv.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {inv.invite_type === "email"
                            ? inv.invitee_email
                            : `Code: ${inv.invite_code}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {inv.invite_type === "email" ? "Email" : "Code"}{" "}
                          &middot;{" "}
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

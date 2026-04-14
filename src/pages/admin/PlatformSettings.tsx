// src/pages/admin/PlatformSettings.tsx
// Admin Platform Settings page with registration mode toggle.
// Controls whether the platform is open (public) or invite-only.

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  Globe,
  Lock,
  Users,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

export default function PlatformSettings() {
  const [isInviteOnly, setIsInviteOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingInvites: 0,
    totalInvitesSent: 0,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      // Fetch the invite_only_enrollment feature flag
      const { data: flag } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", "invite_only_enrollment")
        .single();

      if (flag) {
        setIsInviteOnly(flag.enabled);
      }

      // Fetch platform stats
      const [usersResult, pendingResult, totalResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true }),
        supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("invitations")
          .select("id", { count: "exact", head: true }),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        pendingInvites: pendingResult.count || 0,
        totalInvitesSent: totalResult.count || 0,
      });
    } catch (err) {
      console.error("Error fetching settings:", err);
      toast.error("Failed to load platform settings");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleMode(enabled: boolean) {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("key", "invite_only_enrollment");

      if (error) {
        toast.error("Failed to update setting", { description: error.message });
        return;
      }

      setIsInviteOnly(enabled);
      toast.success(
        enabled
          ? "Platform switched to Invite-Only mode"
          : "Platform switched to Public Access mode",
        {
          description: enabled
            ? "New users must have a valid invite to register."
            : "Anyone can now register on the platform.",
        }
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
          <Settings className="h-5 w-5 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage registration access and platform-wide configurations
          </p>
        </div>
      </div>

      {/* Registration Mode Card */}
      <Card className="border-2 border-[hsl(var(--primary))]/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-[hsl(var(--primary))]" />
            Registration Access Control
          </CardTitle>
          <CardDescription>
            Control how new users can join the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Mode Display */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              {isInviteOnly ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/10">
                  <Lock className="h-5 w-5 text-brand-gold" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
              )}
              <div>
                <div className="font-semibold text-base">
                  {isInviteOnly ? "Invite-Only Mode" : "Public Access Mode"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isInviteOnly
                    ? "Only users with a valid invite can register"
                    : "Anyone can register and use the platform"}
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                isInviteOnly
                  ? "bg-brand-gold/10 text-brand-gold border-brand-gold/20"
                  : "bg-green-500/10 text-green-600 border-green-500/20"
              }
            >
              {isInviteOnly ? "Restricted" : "Open"}
            </Badge>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label
                htmlFor="invite-only-toggle"
                className="text-sm font-medium"
              >
                Enable Invite-Only Registration
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, users must have an invite code or email invitation
                to sign up
              </p>
            </div>
            <Switch
              id="invite-only-toggle"
              checked={isInviteOnly}
              onCheckedChange={handleToggleMode}
              disabled={isSaving}
            />
          </div>

          <Separator />

          {/* Mode Descriptions */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Invite-Only Description */}
            <div
              className={`p-4 rounded-lg border-2 transition-colors ${
                isInviteOnly
                  ? "border-brand-gold/40 bg-brand-gold/5"
                  : "border-muted"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-brand-gold" />
                <span className="font-medium text-sm">Invite-Only</span>
                {isInviteOnly && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold ml-auto" />
                )}
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  Users receive email invitations with magic links
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  Shareable invite codes for word-of-mouth growth
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  Full referral chain tracking & analytics
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  Daily invite limits (5/day per user, unlimited for admins)
                </li>
              </ul>
            </div>

            {/* Public Access Description */}
            <div
              className={`p-4 rounded-lg border-2 transition-colors ${
                !isInviteOnly
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-muted"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Public Access</span>
                {!isInviteOnly && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-auto" />
                )}
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  Anyone can register with email or OAuth
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  No invite code or link required
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  Referral tracking still works for users who share codes
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">Ã¢ÂÂ¢</span>
                  Best for open launch or growth phases
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Registration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Total Users
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                {stats.totalInvitesSent}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Invites Sent
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-brand-gold">
                {stats.pendingInvites}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pending Invites
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Note */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">How it works:</strong> When
          invite-only mode is active, the signup page requires a valid invite
          token or code. Existing users can send invites from the{" "}
          <strong>Referral Program</strong> section in their career profile.
          Email invitations send a magic link Ã¢ÂÂ the recipient clicks it and
          completes registration using the invited email address. In public
          access mode, the invite gate is bypassed and anyone can register
          directly.
        </div>
      </div>
    </div>
  );
}

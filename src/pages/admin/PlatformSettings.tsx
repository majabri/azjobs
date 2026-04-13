// src/pages/admin/PlatformSettings.tsx
// Unified Admin Platform Settings â merges registration access control
// with system configuration (feature flags, rate limits, AI model, etc.)

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Save,
  RefreshCw,
  HelpCircle,
  Sliders,
} from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants & help text                                              */
/* ------------------------------------------------------------------ */

const BOOL_KEYS = new Set([
  "auto_apply_enabled",
  "job_discovery_enabled",
  "maintenance_mode",
  "new_user_registration",
]);

const STRING_KEYS = new Set(["ai_model"]);

/** Human-friendly labels and contextual help for every admin_settings key. */
const SETTING_HELP: Record<
  string,
  { label: string; help: string; category: string }
> = {
  auto_apply_enabled: {
    label: "Auto-Apply",
    help: "When enabled, candidates can use the AI-powered auto-apply feature to automatically submit tailored applications to matching job postings. Disabling this pauses all queued and future auto-apply jobs platform-wide.",
    category: "Features",
  },
  job_discovery_enabled: {
    label: "Job Discovery",
    help: "Controls the AI job-matching engine that surfaces relevant openings to candidates based on their profile, skills, and preferences. Turning this off hides the discovery feed for all users.",
    category: "Features",
  },
  maintenance_mode: {
    label: "Maintenance Mode",
    help: "Puts the entire platform into read-only maintenance mode. Users will see a maintenance banner and all write operations (applications, profile edits, job posts) are blocked. Use this during deployments or database migrations.",
    category: "System",
  },
  new_user_registration: {
    label: "New User Registration",
    help: "Master switch for new account creation. When disabled, no new users can register regardless of invite status. This is independent of the invite-only toggle above â both must be enabled for invite-based signups to work.",
    category: "System",
  },
  ai_model: {
    label: "AI Model",
    help: "The language model used for resume analysis, job matching, interview prep, and auto-apply cover letters. Changing this affects all AI features platform-wide. Common values: gpt-4o, gpt-4o-mini, claude-sonnet-4-20250514.",
    category: "AI & Automation",
  },
  daily_apply_limit: {
    label: "Daily Apply Limit",
    help: "Maximum number of job applications a single user can submit per day (manual + auto-apply combined). Set to 0 for unlimited. Helps prevent spam and ensures quality applications.",
    category: "Rate Limits",
  },
  max_invites_per_day: {
    label: "Max Invites Per Day",
    help: "Maximum invite emails a non-admin user can send per day. Admin users bypass this limit. Controls invite velocity during invite-only periods.",
    category: "Rate Limits",
  },
  ai_calls_per_hour: {
    label: "AI Calls Per Hour",
    help: "Rate limit for AI-powered features per user per hour (resume analysis, interview prep, cover letter generation). Prevents excessive API costs. Set to 0 for unlimited.",
    category: "Rate Limits",
  },
};

/** Fallback for keys not in the help map. */
function getSettingMeta(key: string) {
  return (
    SETTING_HELP[key] ?? {
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      help: "No additional information available for this setting.",
      category: "Other",
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PlatformSettings() {
  const { user } = useAuthReady();

  /* --- Registration access state --- */
  const [isInviteOnly, setIsInviteOnly] = useState(true);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingInvites: 0,
    totalInvitesSent: 0,
  });

  /* --- System configuration state --- */
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  /* --- Load everything on mount --- */
  useEffect(() => {
    fetchAccessSettings();
    loadConfigSettings();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Registration Access                                              */
  /* ---------------------------------------------------------------- */

  async function fetchAccessSettings() {
    try {
      const { data: flag } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", "invite_only_enrollment")
        .single();

      if (flag) setIsInviteOnly(flag.enabled);

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
      console.error("Error fetching access settings:", err);
      toast.error("Failed to load registration settings");
    } finally {
      setIsLoadingAccess(false);
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
        toast.error("Failed to update setting", {
          description: error.message,
        });
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

  /* ---------------------------------------------------------------- */
  /*  System Configuration                                             */
  /* ---------------------------------------------------------------- */

  const loadConfigSettings = async () => {
    setIsLoadingConfig(true);
    try {
      const { data, error } = await (supabase
        .from("admin_settings" as any)
        .select("*")
        .order("key") as any);

      if (error) throw error;
      setSettings((data || []) as SettingRow[]);
      setEdits({});
    } catch (e) {
      console.error(e);
      toast.error("Failed to load configuration");
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const getConfigValue = (row: SettingRow): unknown =>
    row.key in edits ? edits[row.key] : row.value;

  const isDirty = Object.keys(edits).length > 0;

  const saveAllConfig = async () => {
    if (!isDirty) return;
    setSavingConfig(true);
    try {
      for (const [key, value] of Object.entries(edits)) {
        const { error } = await (supabase
          .from("admin_settings" as any)
          .update({
            value: value as any,
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("key", key) as any);

        if (error) throw error;
      }
      toast.success("Configuration saved");
      loadConfigSettings();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Group settings by category                                       */
  /* ---------------------------------------------------------------- */

  const groupedSettings = settings.reduce<Record<string, SettingRow[]>>(
    (acc, row) => {
      const { category } = getSettingMeta(row.key);
      if (!acc[category]) acc[category] = [];
      acc[category].push(row);
      return acc;
    },
    {}
  );

  /* Category display order */
  const categoryOrder = [
    "Features",
    "AI & Automation",
    "Rate Limits",
    "System",
    "Other",
  ];
  const sortedCategories = categoryOrder.filter((c) => groupedSettings[c]);

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  const isLoading = isLoadingAccess || isLoadingConfig;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00B8A9]" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      {/* ============================================================ */}
      {/*  Page Header                                                  */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00B8A9]/10">
            <Settings className="h-5 w-5 text-[#00B8A9]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Platform Settings</h1>
            <p className="text-muted-foreground text-sm">
              Registration access, feature flags, and system configuration
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Section 1 â Registration Access Control                      */}
      {/* ============================================================ */}
      <Card className="border-2 border-[#00B8A9]/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#00B8A9]" />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5A623]/10">
                  <Lock className="h-5 w-5 text-[#F5A623]" />
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
                  ? "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20"
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
                  ? "border-[#F5A623]/40 bg-[#F5A623]/5"
                  : "border-muted"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-[#F5A623]" />
                <span className="font-medium text-sm">Invite-Only</span>
                {isInviteOnly && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#F5A623] ml-auto" />
                )}
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Users receive email invitations with magic links
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Shareable invite codes for word-of-mouth growth
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Full referral chain tracking &amp; analytics
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
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
                  <span className="mt-0.5">&bull;</span>
                  Anyone can register with email or OAuth
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  No invite code or link required
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Referral tracking still works for users who share codes
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Best for open launch or growth phases
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Section 2 â System Configuration                             */}
      {/* ============================================================ */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sliders className="h-5 w-5 text-[#00B8A9]" />
                System Configuration
              </CardTitle>
              <CardDescription className="mt-1">
                Feature flags, AI settings, and rate limits
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadConfigSettings}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reload
              </Button>
              <Button
                size="sm"
                className="gradient-teal text-white"
                onClick={saveAllConfig}
                disabled={!isDirty || savingConfig}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingConfig ? "Saving\u2026" : "Save Changes"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isDirty && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
              <Badge
                variant="outline"
                className="text-warning border-warning/30"
              >
                Unsaved
              </Badge>
              You have unsaved changes. Click &ldquo;Save Changes&rdquo; to
              apply.
            </div>
          )}

          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {category}
                </h3>
                <div className="space-y-1">
                  {groupedSettings[category].map((row) => {
                    const currentValue = getConfigValue(row);
                    const isEdited = row.key in edits;
                    const meta = getSettingMeta(row.key);

                    return (
                      <div
                        key={row.key}
                        className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-foreground">
                              {meta.label}
                            </p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs text-xs"
                              >
                                {meta.help}
                              </TooltipContent>
                            </Tooltip>
                            {isEdited && (
                              <Badge
                                variant="outline"
                                className="text-warning border-warning/30 text-[10px]"
                              >
                                modified
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {meta.help.length > 120
                              ? meta.help.substring(0, 120) + "\u2026"
                              : meta.help}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            Key: <code className="font-mono">{row.key}</code>{" "}
                            &middot; Updated{" "}
                            {new Date(row.updated_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex-shrink-0 flex items-center pt-1">
                          {BOOL_KEYS.has(row.key) ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={Boolean(currentValue)}
                                onCheckedChange={(checked) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [row.key]: checked,
                                  }))
                                }
                              />
                              <Label className="text-xs text-muted-foreground w-14">
                                {Boolean(currentValue) ? "Enabled" : "Disabled"}
                              </Label>
                            </div>
                          ) : STRING_KEYS.has(row.key) ? (
                            <Input
                              value={String(currentValue ?? "")}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [row.key]: e.target.value,
                                }))
                              }
                              className="w-48 h-8 text-xs"
                            />
                          ) : (
                            <Input
                              type="number"
                              value={Number(currentValue ?? 0)}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [row.key]: Number(e.target.value),
                                }))
                              }
                              className="w-24 h-8 text-xs"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Section 3 â Quick Stats                                      */}
      {/* ============================================================ */}
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
              <div className="text-2xl font-bold text-[#00B8A9]">
                {stats.totalInvitesSent}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Invites Sent
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-[#F5A623]">
                {stats.pendingInvites}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pending Invites
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Info Note                                                    */}
      {/* ============================================================ */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">How it works:</strong> When
          invite-only mode is active, the signup page requires a valid invite
          token or code. Existing users can send invites from the{" "}
          <strong>Referral Program</strong> section in their career profile.
          Email invitations send a magic link &mdash; the recipient clicks it
          and completes registration using the invited email address. In public
          access mode, the invite gate is bypassed and anyone can register
          directly. System configuration changes (feature flags, rate limits)
          take effect immediately after saving.
        </div>
      </div>
    </div>
  );
}
// src/pages/admin/PlatformSettings.tsx
// Unified Admin Platform Settings — merges registration access control
// with system configuration (feature flags, rate limits, AI model, etc.)

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Save,
  RefreshCw,
  HelpCircle,
  Sliders,
} from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants & help text                                              */
/* ------------------------------------------------------------------ */

const BOOL_KEYS = new Set([
  "auto_apply_enabled",
  "job_discovery_enabled",
  "maintenance_mode",
  "new_user_registration",
]);

const STRING_KEYS = new Set(["ai_model"]);

/** Human-friendly labels and contextual help for every admin_settings key. */
const SETTING_HELP: Record<
  string,
  { label: string; help: string; category: string }
> = {
  auto_apply_enabled: {
    label: "Auto-Apply",
    help: "When enabled, candidates can use the AI-powered auto-apply feature to automatically submit tailored applications to matching job postings. Disabling this pauses all queued and future auto-apply jobs platform-wide.",
    category: "Features",
  },
  job_discovery_enabled: {
    label: "Job Discovery",
    help: "Controls the AI job-matching engine that surfaces relevant openings to candidates based on their profile, skills, and preferences. Turning this off hides the discovery feed for all users.",
    category: "Features",
  },
  maintenance_mode: {
    label: "Maintenance Mode",
    help: "Puts the entire platform into read-only maintenance mode. Users will see a maintenance banner and all write operations (applications, profile edits, job posts) are blocked. Use this during deployments or database migrations.",
    category: "System",
  },
  new_user_registration: {
    label: "New User Registration",
    help: "Master switch for new account creation. When disabled, no new users can register regardless of invite status. This is independent of the invite-only toggle above — both must be enabled for invite-based signups to work.",
    category: "System",
  },
  ai_model: {
    label: "AI Model",
    help: "The language model used for resume analysis, job matching, interview prep, and auto-apply cover letters. Changing this affects all AI features platform-wide. Common values: gpt-4o, gpt-4o-mini, claude-sonnet-4-20250514.",
    category: "AI & Automation",
  },
  daily_apply_limit: {
    label: "Daily Apply Limit",
    help: "Maximum number of job applications a single user can submit per day (manual + auto-apply combined). Set to 0 for unlimited. Helps prevent spam and ensures quality applications.",
    category: "Rate Limits",
  },
  max_invites_per_day: {
    label: "Max Invites Per Day",
    help: "Maximum invite emails a non-admin user can send per day. Admin users bypass this limit. Controls invite velocity during invite-only periods.",
    category: "Rate Limits",
  },
  ai_calls_per_hour: {
    label: "AI Calls Per Hour",
    help: "Rate limit for AI-powered features per user per hour (resume analysis, interview prep, cover letter generation). Prevents excessive API costs. Set to 0 for unlimited.",
    category: "Rate Limits",
  },
};

/** Fallback for keys not in the help map. */
function getSettingMeta(key: string) {
  return (
    SETTING_HELP[key] ?? {
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      help: "No additional information available for this setting.",
      category: "Other",
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PlatformSettings() {
  const { user } = useAuthReady();

  /* --- Registration access state --- */
  const [isInviteOnly, setIsInviteOnly] = useState(true);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingInvites: 0,
    totalInvitesSent: 0,
  });

  /* --- System configuration state --- */
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  /* --- Load everything on mount --- */
  useEffect(() => {
    fetchAccessSettings();
    loadConfigSettings();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Registration Access                                              */
  /* ---------------------------------------------------------------- */

  async function fetchAccessSettings() {
    try {
      const { data: flag } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", "invite_only_enrollment")
        .single();

      if (flag) setIsInviteOnly(flag.enabled);

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
      console.error("Error fetching access settings:", err);
      toast.error("Failed to load registration settings");
    } finally {
      setIsLoadingAccess(false);
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
        toast.error("Failed to update setting", {
          description: error.message,
        });
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

  /* ---------------------------------------------------------------- */
  /*  System Configuration                                             */
  /* ---------------------------------------------------------------- */

  const loadConfigSettings = async () => {
    setIsLoadingConfig(true);
    try {
      const { data, error } = await (supabase
        .from("admin_settings" as any)
        .select("*")
        .order("key") as any);

      if (error) throw error;
      setSettings((data || []) as SettingRow[]);
      setEdits({});
    } catch (e) {
      console.error(e);
      toast.error("Failed to load configuration");
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const getConfigValue = (row: SettingRow): unknown =>
    row.key in edits ? edits[row.key] : row.value;

  const isDirty = Object.keys(edits).length > 0;

  const saveAllConfig = async () => {
    if (!isDirty) return;
    setSavingConfig(true);
    try {
      for (const [key, value] of Object.entries(edits)) {
        const { error } = await (supabase
          .from("admin_settings" as any)
          .update({
            value: value as any,
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("key", key) as any);

        if (error) throw error;
      }
      toast.success("Configuration saved");
      loadConfigSettings();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Group settings by category                                       */
  /* ---------------------------------------------------------------- */

  const groupedSettings = settings.reduce<Record<string, SettingRow[]>>(
    (acc, row) => {
      const { category } = getSettingMeta(row.key);
      if (!acc[category]) acc[category] = [];
      acc[category].push(row);
      return acc;
    },
    {}
  );

  /* Category display order */
  const categoryOrder = [
    "Features",
    "AI & Automation",
    "Rate Limits",
    "System",
    "Other",
  ];
  const sortedCategories = categoryOrder.filter((c) => groupedSettings[c]);

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  const isLoading = isLoadingAccess || isLoadingConfig;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00B8A9]" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      {/* ============================================================ */}
      {/*  Page Header                                                  */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00B8A9]/10">
            <Settings className="h-5 w-5 text-[#00B8A9]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Platform Settings</h1>
            <p className="text-muted-foreground text-sm">
              Registration access, feature flags, and system configuration
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Section 1 — Registration Access Control                      */}
      {/* ============================================================ */}
      <Card className="border-2 border-[#00B8A9]/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#00B8A9]" />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5A623]/10">
                  <Lock className="h-5 w-5 text-[#F5A623]" />
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
                  ? "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20"
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
                  ? "border-[#F5A623]/40 bg-[#F5A623]/5"
                  : "border-muted"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-[#F5A623]" />
                <span className="font-medium text-sm">Invite-Only</span>
                {isInviteOnly && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#F5A623] ml-auto" />
                )}
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Users receive email invitations with magic links
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Shareable invite codes for word-of-mouth growth
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Full referral chain tracking &amp; analytics
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
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
                  <span className="mt-0.5">&bull;</span>
                  Anyone can register with email or OAuth
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  No invite code or link required
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Referral tracking still works for users who share codes
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5">&bull;</span>
                  Best for open launch or growth phases
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Section 2 — System Configuration                             */}
      {/* ============================================================ */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sliders className="h-5 w-5 text-[#00B8A9]" />
                System Configuration
              </CardTitle>
              <CardDescription className="mt-1">
                Feature flags, AI settings, and rate limits
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadConfigSettings}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reload
              </Button>
              <Button
                size="sm"
                className="gradient-teal text-white"
                onClick={saveAllConfig}
                disabled={!isDirty || savingConfig}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingConfig ? "Saving\u2026" : "Save Changes"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isDirty && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
              <Badge
                variant="outline"
                className="text-warning border-warning/30"
              >
                Unsaved
              </Badge>
              You have unsaved changes. Click &ldquo;Save Changes&rdquo; to
              apply.
            </div>
          )}

          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {category}
                </h3>
                <div className="space-y-1">
                  {groupedSettings[category].map((row) => {
                    const currentValue = getConfigValue(row);
                    const isEdited = row.key in edits;
                    const meta = getSettingMeta(row.key);

                    return (
                      <div
                        key={row.key}
                        className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-foreground">
                              {meta.label}
                            </p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs text-xs"
                              >
                                {meta.help}
                              </TooltipContent>
                            </Tooltip>
                            {isEdited && (
                              <Badge
                                variant="outline"
                                className="text-warning border-warning/30 text-[10px]"
                              >
                                modified
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {meta.help.length > 120
                              ? meta.help.substring(0, 120) + "\u2026"
                              : meta.help}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            Key: <code className="font-mono">{row.key}</code>{" "}
                            &middot; Updated{" "}
                            {new Date(row.updated_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex-shrink-0 flex items-center pt-1">
                          {BOOL_KEYS.has(row.key) ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={Boolean(currentValue)}
                                onCheckedChange={(checked) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [row.key]: checked,
                                  }))
                                }
                              />
                              <Label className="text-xs text-muted-foreground w-14">
                                {Boolean(currentValue) ? "Enabled" : "Disabled"}
                              </Label>
                            </div>
                          ) : STRING_KEYS.has(row.key) ? (
                            <Input
                              value={String(currentValue ?? "")}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [row.key]: e.target.value,
                                }))
                              }
                              className="w-48 h-8 text-xs"
                            />
                          ) : (
                            <Input
                              type="number"
                              value={Number(currentValue ?? 0)}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [row.key]: Number(e.target.value),
                                }))
                              }
                              className="w-24 h-8 text-xs"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Section 3 — Quick Stats                                      */}
      {/* ============================================================ */}
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
              <div className="text-2xl font-bold text-[#00B8A9]">
                {stats.totalInvitesSent}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Invites Sent
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-[#F5A623]">
                {stats.pendingInvites}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pending Invites
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  Info Note                                                    */}
      {/* ============================================================ */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">How it works:</strong> When
          invite-only mode is active, the signup page requires a valid invite
          token or code. Existing users can send invites from the{" "}
          <strong>Referral Program</strong> section in their career profile.
          Email invitations send a magic link &mdash; the recipient clicks it
          and completes registration using the invited email address. In public
          access mode, the invite gate is bypassed and anyone can register
          directly. System configuration changes (feature flags, rate limits)
          take effect immediately after saving.
        </div>
      </div>
    </div>
  

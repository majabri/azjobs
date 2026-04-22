import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings, Save, Clock, RefreshCw, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";
import { logger } from "@/lib/logger";

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

const BOOL_KEYS = new Set([
  "auto_apply_enabled",
  "job_discovery_enabled",
  "maintenance_mode",
  "new_user_registration",
  "require_email_verification",
]);

const STRING_KEYS = new Set([
  "ai_model",
  "default_user_role",
  "site_name",
  "site_tagline",
  "support_email",
]);

/* ------------------------------------------------------------------ */
/* Help text for every known setting                                   */
/* ------------------------------------------------------------------ */
const SETTING_HELP: Record<
  string,
  { label: string; help: string; recommendation: string }
> = {
  agent_rate_limit: {
    label: "Agent Rate Limit",
    help: "Maximum number of AI agent API calls allowed per user per hour. This controls how frequently users can trigger AI-powered features like resume analysis, interview prep, and cover letter generation. Setting this too low may frustrate active users; too high may increase API costs.",
    recommendation:
      "Recommended: 50\u2013200. Start at 100 and adjust based on usage patterns and budget.",
  },
  ai_model: {
    label: "AI Model",
    help: "The language model used for all AI-powered features across the platform, including resume scoring, job matching, interview prep questions, and auto-apply cover letters. Changing this affects quality, speed, and cost of every AI interaction.",
    recommendation:
      "Recommended: gpt-4o-mini for cost efficiency, gpt-4o for higher quality, or claude-sonnet-4-20250514 for nuanced analysis.",
  },
  allow_signups: {
    label: "Allow Signups",
    help: "Master switch for new user registration. When set to 0 (disabled), no new accounts can be created regardless of invite status. When set to 1 (enabled), users can register subject to other restrictions like invite-only mode. This is useful for temporarily pausing all registrations during maintenance or capacity issues.",
    recommendation:
      "Recommended: Keep at 1 (enabled) unless you need to freeze registration entirely.",
  },
  auto_apply_enabled: {
    label: "Auto-Apply",
    help: "Controls whether users can use the AI-powered auto-apply feature to automatically submit tailored applications to matching job postings. When disabled, all queued and future auto-apply jobs are paused platform-wide. Existing manual applications are not affected.",
    recommendation:
      "Recommended: Keep enabled. Disable temporarily if you notice quality issues with generated applications or excessive API costs.",
  },
  default_match_threshold: {
    label: "Default Match Threshold",
    help: "The minimum match score (0\u2013100) required for a job to appear in a user\u2019s discovery feed. Higher values mean fewer but more relevant matches; lower values cast a wider net. This sets the default for new users\u2014existing users may have customized their own threshold.",
    recommendation:
      "Recommended: 60\u201380. A value of 70 balances relevance with discovery breadth.",
  },
  default_user_role: {
    label: "Default User Role",
    help: "The role automatically assigned to newly registered users. Common values: \u201cjob_seeker\u201d, \u201chiring_manager\u201d, or blank to let users choose during onboarding. This determines which dashboard and features new users see on first login.",
    recommendation:
      "Recommended: \u201cjob_seeker\u201d for consumer-facing platforms. Leave blank if your platform serves multiple user types.",
  },
  job_discovery_enabled: {
    label: "Job Discovery",
    help: "Controls the AI job-matching engine that surfaces relevant openings to candidates based on their profile, skills, and preferences. Turning this off hides the discovery feed for all users. The matching engine will stop processing new matches but existing saved jobs remain visible.",
    recommendation:
      "Recommended: Keep enabled. Only disable during major data migrations or if the matching engine is producing poor results.",
  },
  maintenance_mode: {
    label: "Maintenance Mode",
    help: "Puts the entire platform into read-only mode. Users will see a maintenance banner and all write operations (applications, profile edits, job posts) are blocked. Use this during deployments, database migrations, or emergency fixes. Users can still browse and read content.",
    recommendation:
      "Recommended: Only enable during planned maintenance windows. Notify users in advance via the platform banner.",
  },
  new_user_registration: {
    label: "New User Registration",
    help: "Secondary registration control that works alongside allow_signups. Both must be enabled for new users to register. This setting is often toggled independently to temporarily pause registrations while keeping the allow_signups master switch on.",
    recommendation:
      "Recommended: Keep enabled unless you need a quick way to pause signups without changing the master switch.",
  },
  daily_apply_limit: {
    label: "Daily Apply Limit",
    help: "Maximum number of job applications a single user can submit per day, combining both manual and auto-apply submissions. Set to 0 for unlimited. This prevents spam and encourages users to focus on quality applications rather than volume.",
    recommendation:
      "Recommended: 20\u201350. This balances user experience with application quality.",
  },
  max_invites_per_day: {
    label: "Max Invites Per Day",
    help: "Maximum invite emails a non-admin user can send per day. Admin users bypass this limit. Controls invite velocity during invite-only periods to prevent abuse while allowing organic growth.",
    recommendation:
      "Recommended: 5\u201310 per day for regular users during invite-only mode.",
  },
  max_applications_per_day: {
    label: "Max Applications Per Day",
    help: "Maximum number of auto-apply applications a single user can submit per day. This specifically governs the AI-driven auto-apply feature and prevents any one user from consuming excessive automation resources. When the limit is reached, queued auto-apply jobs are paused until the next day.",
    recommendation:
      "Recommended: 30–75. Set based on your API budget and desired application quality. A value of 50 is a good starting point.",
  },
  max_daily_applications: {
    label: "Max Daily Applications",
    help: "Platform-wide cap on the total number of job applications (both manual and auto-apply) a single user can submit per day. This is the hard ceiling that applies regardless of application method. It prevents spam, encourages users to be selective, and protects employer inboxes from low-quality volume.",
    recommendation:
      "Recommended: 30–50. Should be equal to or higher than max_applications_per_day to avoid conflicts.",
  },
  max_resume_versions: {
    label: "Max Resume Versions",
    help: "Maximum number of resume versions each user can store on the platform. Each version represents a tailored resume targeting different roles or industries. Older versions are not automatically deleted when the limit is reached—users must manually remove versions to create new ones. Higher limits increase storage usage.",
    recommendation:
      "Recommended: 5–15. A value of 10 gives users enough flexibility to maintain role-specific resumes without excessive storage overhead.",
  },
  require_email_verification: {
    label: "Require Email Verification",
    help: "When enabled, new users must verify their email address by clicking a confirmation link before they can access the platform. This prevents fake accounts, reduces spam registrations, and ensures you have valid contact information for each user. Disabling this allows immediate access after signup.",
    recommendation:
      "Recommended: Keep enabled for production environments. Only disable during testing or invite-only beta periods where users are pre-vetted.",
  },
  session_timeout_minutes: {
    label: "Session Timeout",
    help: "How long a user session remains active (in minutes) before requiring re-authentication. After this period of inactivity, users are automatically logged out and must sign in again. Shorter timeouts improve security; longer timeouts improve convenience. The value 1440 equals 24 hours.",
    recommendation:
      "Recommended: 1440 (24 hours) for general use, 480 (8 hours) for stricter security, or 60 (1 hour) for high-security environments.",
  },
  site_name: {
    label: "Site Name",
    help: "The display name of your platform shown in the browser tab title, email notifications, footer, and branding elements throughout the UI. Changing this updates all dynamic references to the platform name. Leave empty to use the default “iCareerOS” branding.",
    recommendation:
      "Recommended: Set to your organization’s branded name (e.g., “iCareerOS”, “AZ Jobs”). Keep it short and recognizable.",
  },
  site_tagline: {
    label: "Site Tagline",
    help: "A short tagline or subtitle displayed alongside the site name in headers, the login page, and marketing surfaces. This helps communicate your platform’s value proposition at a glance. Leave empty to hide the tagline.",
    recommendation:
      "Recommended: Keep under 60 characters. Focus on your core value prop (e.g., “Intelligent Career Operating System”).",
  },
  support_email: {
    label: "Support Email",
    help: "The email address displayed to users for platform support requests. This appears in error pages, help sections, footer contact links, and automated support-related emails. Ensure this mailbox is actively monitored.",
    recommendation:
      "Recommended: Use a team-monitored address like support@yourdomain.com rather than a personal email.",
  },
  ai_calls_per_hour: {
    label: "AI Calls Per Hour",
    help: "Per-user rate limit for AI-powered features per hour (resume analysis, interview prep, cover letter generation). This is separate from agent_rate_limit and applies specifically to user-initiated AI actions. Set to 0 for unlimited.",
    recommendation:
      "Recommended: 20\u201350 calls per hour. Adjust based on API budget and user activity.",
  },
};

/** Fallback for settings not in the help map. */
function getSettingMeta(key: string) {
  return (
    SETTING_HELP[key] ?? {
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      help: "No additional information available for this setting.",
      recommendation: "Review this setting based on your platform needs.",
    }
  );
}

export default function AdminSettings() {
  const { user } = useAuthReady();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_settings" as any)
        .select("*")
        .order("key");
      if (error) throw error;
      setSettings((data || []) as SettingRow[]);
      setEdits({});
    } catch (e) {
      logger.error(e);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const getValue = (row: SettingRow): unknown => {
    return row.key in edits ? edits[row.key] : row.value;
  };

  const isDirty = Object.keys(edits).length > 0;

  const saveAll = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(edits)) {
        const { error } = await supabase
          .from("admin_settings" as any)
          .update({
            value,
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("key", key);
        if (error) throw error;
      }
      toast.success("Settings saved");
      load();
    } catch (e) {
      logger.error(e);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Platform Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Feature flags, rate limits, and system configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reload
          </Button>
          <Button
            size="sm"
            className="gradient-indigo text-white"
            onClick={saveAll}
            disabled={!isDirty || saving}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving\u2026" : "Save Changes"}
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
          <Badge variant="outline" className="text-warning border-warning/30">
            Unsaved
          </Badge>
          You have unsaved changes. Click \u201cSave Changes\u201d to apply.
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {settings.map((row) => {
              const currentValue = getValue(row);
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
                          className="max-w-sm text-xs leading-relaxed p-3"
                        >
                          <p className="mb-1.5">{meta.help}</p>
                          <p className="text-accent font-medium">
                            {meta.recommendation}
                          </p>
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
                    {row.description && (
                      <p className="text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Key: <code className="font-mono">{row.key}</code>
                      {" \u00b7 "}Updated{" "}
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
                          {currentValue ? "Enabled" : "Disabled"}
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
        </CardContent>
      </Card>
    </div>
  );
}

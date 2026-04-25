import { useState, useRef, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Sparkles,
  Link2,
  Download,
  Loader2,
  Upload,
  FileText,
  User,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Clock,
} from "lucide-react";
import { scrapeUrl } from "@/lib/api/scrapeUrl";
import { parseDocument } from "@/lib/api/parseDocument";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractProfileFromResume } from "@/lib/analysisEngine";

interface ResumeVersionOption {
  id: string;
  version_name: string;
  job_type: string;
  resume_text: string;
}

interface AnalysisFormProps {
  onAnalyze: (jobDesc: string, resume: string, jobLink: string) => void;
  isAnalyzing: boolean;
  isDemo: boolean;
  prefillJob?: string;
  prefillJobLink?: string;
}

// ---------------------------------------------------------------------------
// Inline alert types
// ---------------------------------------------------------------------------

type AlertVariant = "info" | "warning" | "error";

interface InlineAlert {
  variant: AlertVariant;
  message: string;
  showPartialActions?: boolean;
  showBrowserExtract?: boolean; // shows Open-tab + Paste-clipboard flow
  rateLimitSecondsLeft?: number;
}

// ---------------------------------------------------------------------------
// Demo content
// ---------------------------------------------------------------------------

const DEMO_JOB = `Senior Cybersecurity Engineer — Cloud Security

We're looking for an experienced Cybersecurity Engineer to lead our cloud security initiatives.

Requirements:
- 5+ years of cybersecurity experience
- Strong knowledge of cloud security (AWS, Azure, or GCP)
- Experience with SIEM tools and security operations
- Familiarity with compliance frameworks (NIST, ISO 27001, SOC 2)
- Incident response and threat detection skills
- Experience with vulnerability management and penetration testing
- Strong communication and documentation skills
- CISSP, CISM, or equivalent certification preferred
- Experience with zero trust architecture
- Knowledge of identity and access management (IAM)`;

const DEMO_RESUME = `Alex Morgan | Cybersecurity Professional
alex.morgan@email.com | (555) 123-4567 | San Francisco, CA

PROFESSIONAL SUMMARY
Results-driven cybersecurity professional with 6+ years of experience in information security, cloud security, and compliance.

WORK EXPERIENCE
Senior Security Analyst at CloudDefend Inc (3 years)
- Led cloud security assessments across AWS and Azure environments
- Implemented SIEM monitoring using Splunk

CERTIFICATIONS
CISSP, CompTIA Security+, AWS Certified Security Specialty

SKILLS
Cloud Security, AWS, Azure, SIEM, Splunk, Vulnerability Management, Penetration Testing

EDUCATION
B.S. Computer Science — University of California, Berkeley (2017)`;

// ---------------------------------------------------------------------------
// Inline alert banner
// ---------------------------------------------------------------------------

const ALERT_STYLES: Record<
  AlertVariant,
  { container: string; icon: string; IconEl: typeof Info }
> = {
  info: {
    container: "bg-muted/60 border-border text-muted-foreground",
    icon: "text-muted-foreground",
    IconEl: Info,
  },
  warning: {
    container:
      "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
    icon: "text-yellow-500",
    IconEl: AlertTriangle,
  },
  error: {
    container: "bg-destructive/10 border-destructive/30 text-destructive",
    icon: "text-destructive",
    IconEl: AlertCircle,
  },
};

function InlineAlertBanner({
  alert,
  onDismiss,
  onKeep,
  onClear,
  onFocusTextarea,
  onOpenTab,
  onPasteClipboard,
}: {
  alert: InlineAlert;
  onDismiss: () => void;
  onKeep?: () => void;
  onClear?: () => void;
  onFocusTextarea?: () => void;
  onOpenTab?: () => void;
  onPasteClipboard?: () => void;
}) {
  const s = ALERT_STYLES[alert.variant];
  const Icon = s.IconEl;
  return (
    <div
      className={`mt-2 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${s.container}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${s.icon}`} />
      <div className="flex-1 min-w-0">
        <p className="leading-snug">{alert.message}</p>
        {(alert.rateLimitSecondsLeft ?? 0) > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium">
            <Clock className="h-3 w-3" /> Try again in{" "}
            {alert.rateLimitSecondsLeft}s…
          </p>
        )}
        {alert.showPartialActions && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={onKeep}
              className="rounded-md bg-current/10 px-2.5 py-1 text-xs font-medium hover:bg-current/20 transition-colors"
            >
              Looks good, keep it
            </button>
            <button
              onClick={onClear}
              className="rounded-md px-2.5 py-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
            >
              Clear and paste manually
            </button>
          </div>
        )}
        {alert.showBrowserExtract && onOpenTab && onPasteClipboard && (
          <div className="mt-2 flex gap-2 flex-wrap">
            <button
              onClick={onOpenTab}
              className="rounded-md bg-current/10 px-2.5 py-1 text-xs font-medium hover:bg-current/20 transition-colors"
            >
              Open job tab ↗
            </button>
            <button
              onClick={onPasteClipboard}
              className="rounded-md bg-current/10 px-2.5 py-1 text-xs font-medium hover:bg-current/20 transition-colors"
            >
              Paste from clipboard ↓
            </button>
          </div>
        )}
        {alert.variant === "error" &&
          !alert.showPartialActions &&
          !alert.showBrowserExtract &&
          onFocusTextarea && (
            <button
              onClick={onFocusTextarea}
              className="mt-1 text-xs font-medium underline underline-offset-2 hover:opacity-80"
            >
              Paste manually ↓
            </button>
          )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 rounded p-0.5 hover:opacity-70 transition-opacity"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const RATE_LIMIT_SECONDS = 60;

export default function AnalysisForm({
  onAnalyze,
  isAnalyzing,
  isDemo,
  prefillJob,
  prefillJobLink,
}: AnalysisFormProps) {
  const [jobDesc, setJobDesc] = useState("");
  const [resume, setResume] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersionOption[]>(
    [],
  );
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const autoLoadedRef = useRef(false); // ref guard — avoids adding to effect deps
  const [urlAlert, setUrlAlert] = useState<InlineAlert | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  const resumeFileRef = useRef<HTMLInputElement>(null);
  const jobDescRef = useRef<HTMLTextAreaElement>(null);
  const rateLimitTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (rateLimitTimer.current) clearInterval(rateLimitTimer.current);
    },
    [],
  );

  const startRateLimitCountdown = useCallback(() => {
    setRateLimitSeconds(RATE_LIMIT_SECONDS);
    if (rateLimitTimer.current) clearInterval(rateLimitTimer.current);
    rateLimitTimer.current = setInterval(() => {
      setRateLimitSeconds((s) => {
        const next = s - 1;
        if (next <= 0) {
          clearInterval(rateLimitTimer.current!);
          rateLimitTimer.current = null;
          setUrlAlert(null);
          return 0;
        }
        setUrlAlert((prev) =>
          prev ? { ...prev, rateLimitSecondsLeft: next } : prev,
        );
        return next;
      });
    }, 1000);
  }, []);

  const handleScrapeResult = useCallback(
    (result: Awaited<ReturnType<typeof scrapeUrl>>) => {
      if (result.success && result.markdown) {
        setJobDesc(result.markdown);
        if (result.usedFallback) {
          setUrlAlert({
            variant: "info",
            message:
              "Content extracted using enhanced parsing. Please review and edit as needed.",
          });
          setTimeout(() => setUrlAlert(null), 6_000);
        } else {
          setUrlAlert(null);
        }
        return;
      }

      const err = result.error ?? "Could not fetch the job posting.";

      if (err.toLowerCase().includes("too many requests")) {
        setUrlAlert({
          variant: "warning",
          message:
            "You've made too many requests. Please wait 60 seconds before trying again.",
          rateLimitSecondsLeft: RATE_LIMIT_SECONDS,
        });
        startRateLimitCountdown();
        return;
      }

      if (
        err.toLowerCase().includes("security") ||
        err.toLowerCase().includes("cannot be fetched")
      ) {
        setUrlAlert({
          variant: "error",
          message:
            "This URL type isn't supported for security reasons. Please paste the job description manually.",
        });
        return;
      }

      if (result.extractionFailed && result.partialText) {
        setJobDesc(result.partialText);
        setUrlAlert({
          variant: "warning",
          message:
            "We couldn't confirm this is a job listing. We've filled in what we found — please review and edit before saving.",
          showPartialActions: true,
        });
        return;
      }

      // For browser-required sites (Workday, LinkedIn, etc.), offer the open-tab + clipboard flow
      const needsBrowser =
        err.toLowerCase().includes("browser") ||
        err.toLowerCase().includes("workday") ||
        err.toLowerCase().includes("blocks server") ||
        err.toLowerCase().includes("requires a browser") ||
        err.toLowerCase().includes("login") ||
        err.toLowerCase().includes("ip-block");
      setUrlAlert({
        variant: "error",
        message: err,
        showBrowserExtract: needsBrowser,
      });
    },
    [startRateLimitCountdown],
  );
  const handleOpenTab = () => {
    if (jobLink.trim()) {
      window.open(jobLink.trim(), "_blank", "noopener,noreferrer");
      setUrlAlert({
        variant: "warning",
        message:
          'Job opened in new tab — press Ctrl+A then Ctrl+C on that tab to copy all text, then click "Paste from clipboard" below.',
        showBrowserExtract: true,
      });
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 100) {
        setJobDesc(text.slice(0, 8000));
        setUrlAlert(null);
        setTimeout(() => jobDescRef.current?.focus(), 50);
      } else {
        setUrlAlert({
          variant: "error",
          message:
            "Clipboard appears empty. Copy the job page text first (Ctrl+A, Ctrl+C), then try again.",
        });
      }
    } catch {
      setUrlAlert({
        variant: "error",
        message:
          "Clipboard access was denied. Please paste the job description directly into the text box below.",
        showBrowserExtract: false,
      });
      setTimeout(() => jobDescRef.current?.focus(), 50);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    if (isDemo) {
      setJobDesc(DEMO_JOB);
      setResume(DEMO_RESUME);
      return;
    }
    if (prefillJob) setJobDesc(prefillJob);
    if (prefillJobLink) {
      setJobLink(prefillJobLink);
      (async () => {
        setIsFetchingJob(true);
        try {
          handleScrapeResult(await scrapeUrl(prefillJobLink));
        } catch {
          setUrlAlert({
            variant: "error",
            message:
              "Failed to fetch the job posting. Please paste the description manually.",
          });
        } finally {
          setIsFetchingJob(false);
        }
      })();
    }
    const prefillFromUrl = new URLSearchParams(window.location.search).get(
      "prefillJob",
    );
    if (prefillFromUrl) setJobDesc(prefillFromUrl);
    if (!autoLoadedRef.current) {
      autoLoadedRef.current = true;
      autoLoadResume();
    }
    // autoLoadResume uses only stable supabase + state setters; autoLoadedRef is a stable ref
  }, [isDemo, prefillJob, prefillJobLink, handleScrapeResult]);

  const handleFetchJobLink = async () => {
    if (!jobLink.trim() || isFetchingJob || rateLimitSeconds > 0) return;
    setUrlAlert(null);
    setJobDesc(""); // clear stale content before new fetch
    setIsFetchingJob(true);
    try {
      handleScrapeResult(await scrapeUrl(jobLink));
    } catch {
      setUrlAlert({
        variant: "error",
        message:
          "The request timed out. Please try again or paste the description manually.",
      });
    } finally {
      setIsFetchingJob(false);
    }
  };

  const autoLoadResume = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: versions } = await supabase
        .from("resume_versions")
        .select("resume_text, version_name")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (versions?.[0]?.resume_text) {
        setResume(versions[0].resume_text);
        toast.success(`Resume "${versions[0].version_name}" loaded from vault`);
        return;
      }
      const { data: profile } = await supabase
        .from("job_seeker_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (profile?.full_name) {
        const lines: string[] = [];
        lines.push(profile.full_name);
        const contact = [profile.email, profile.phone, profile.location]
          .filter(Boolean)
          .join(" | ");
        if (contact) lines.push(contact);
        if (profile.summary) {
          lines.push("");
          lines.push("PROFESSIONAL SUMMARY");
          lines.push(profile.summary);
        }
        const skills = profile.skills as string[] | null;
        if (skills?.length) {
          lines.push("");
          lines.push("SKILLS");
          lines.push(skills.join(", "));
        }
        setResume(lines.join("\n"));
        toast.info(
          "Resume built from your profile. Upload a full resume for better results.",
        );
      }
    } catch (e) {
      logger.error("Auto-load resume failed:", e);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingResume(true);
    try {
      const result = await parseDocument(file);
      if (result.success && result.text) {
        setResume(result.text);
        toast.success("Resume extracted!");
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            const versionName =
              file.name.replace(/\.[^.]+$/, "") || "Uploaded Resume";
            await supabase.from("resume_versions").insert({
              user_id: session.user.id,
              version_name: versionName,
              job_type: null,
              resume_text: result.text,
            });
            const extracted = extractProfileFromResume(result.text);
            if (extracted.skills.length) {
              const { data } = await supabase
                .from("job_seeker_profiles")
                .select("skills")
                .eq("user_id", session.user.id)
                .maybeSingle();
              const current = (data?.skills as string[]) || [];
              const newSkills = extracted.skills.filter(
                (s) =>
                  !current
                    .map((c) => c.toLowerCase())
                    .includes(s.toLowerCase()),
              );
              if (newSkills.length) {
                await supabase.from("job_seeker_profiles").upsert(
                  {
                    user_id: session.user.id,
                    skills: [...current, ...newSkills],
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" },
                );
                toast.success(
                  `${newSkills.length} new skill(s) synced to profile`,
                );
              }
            }
          }
        } catch (skillSyncErr) {
          console.warn(
            "[AnalysisForm] Skill sync failed silently:",
            skillSyncErr,
          );
        }
      } else {
        toast.error(result.error || "Could not extract text");
      }
    } catch (parseErr) {
      console.error("[AnalysisForm] Document parse error:", parseErr);
      toast.error("Failed to parse document");
    } finally {
      setIsUploadingResume(false);
      if (resumeFileRef.current) resumeFileRef.current.value = "";
    }
  };

  const handleLoadFromProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        return;
      }
      const { data: versionData } = await supabase
        .from("resume_versions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (versionData?.length) {
        setResumeVersions(
          versionData.map((v: any) => ({
            id: v.id,
            version_name: v.version_name,
            job_type: v.job_type || "",
            resume_text: v.resume_text,
          })),
        );
        setShowVersionPicker(true);
      } else if (resume.trim()) {
        const { data: saved } = await supabase
          .from("resume_versions")
          .insert({
            user_id: session.user.id,
            version_name: "My Resume",
            job_type: null,
            resume_text: resume,
          })
          .select()
          .single();
        if (saved) {
          setResumeVersions([
            {
              id: saved.id,
              version_name: "My Resume",
              job_type: "",
              resume_text: resume,
            },
          ]);
          setShowVersionPicker(true);
          toast.success("Resume saved to vault automatically!");
        }
      } else {
        toast.info("No resume versions found. Upload one in your Profile.");
      }
    } catch {
      toast.error("Failed to load versions");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchDisabled =
    !jobLink.trim() || isFetchingJob || rateLimitSeconds > 0;

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          {isDemo ? (
            <>
              See how <span className="text-accent">iCareerOS</span> works
            </>
          ) : (
            <>
              Analyze Your <span className="text-accent">Job Fit</span>
            </>
          )}
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Paste a job description and your resume. Get your fit score, gaps, and
          AI-optimized resume in seconds.
        </p>
        {isDemo && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Demo Mode — no account needed
          </div>
        )}
      </div>

      {/* URL fetch row */}
      <div className="mb-4">
        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
          <Link2 className="w-3.5 h-3.5 text-accent" /> Job Posting URL{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          <Input
            className="bg-card border-border text-sm flex-1"
            placeholder="https://company.com/jobs/..."
            value={jobLink}
            onChange={(e) => setJobLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFetchJobLink();
            }}
            disabled={isFetchingJob}
            type="url"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={fetchDisabled}
            onClick={handleFetchJobLink}
            title={
              rateLimitSeconds > 0
                ? `Rate limited — try again in ${rateLimitSeconds}s`
                : undefined
            }
          >
            {isFetchingJob ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : rateLimitSeconds > 0 ? (
              <Clock className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="ml-1.5">
              {rateLimitSeconds > 0 ? `${rateLimitSeconds}s` : "Fetch"}
            </span>
          </Button>
        </div>

        {/* Inline alert directly below URL row */}
        {urlAlert && (
          <InlineAlertBanner
            alert={urlAlert}
            onDismiss={() => setUrlAlert(null)}
            onKeep={() => setUrlAlert(null)}
            onClear={() => {
              setJobDesc("");
              setUrlAlert(null);
              jobDescRef.current?.focus();
            }}
            onFocusTextarea={() => {
              jobDescRef.current?.focus();
              setUrlAlert(null);
            }}
            onOpenTab={handleOpenTab}
            onPasteClipboard={handlePasteClipboard}
          />
        )}
      </div>

      {/* Content grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Job Description
          </label>
          <Textarea
            ref={jobDescRef}
            className="h-64 resize-none bg-card border-border text-sm"
            placeholder="Paste the full job description here..."
            value={jobDesc}
            onChange={(e) => {
              setJobDesc(e.target.value);
              if (urlAlert?.variant === "info") setUrlAlert(null); // dismiss info on first edit
            }}
          />
          <p className="text-xs text-muted-foreground">
            {jobDesc.length} characters
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-accent" /> Your Resume
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="text-xs h-8 gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90"
                disabled={isUploadingResume || isDemo}
                onClick={() => resumeFileRef.current?.click()}
              >
                {isUploadingResume ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Upload className="w-3 h-3 mr-1" />
                )}{" "}
                Upload
              </Button>
              <input
                ref={resumeFileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleResumeUpload}
              />
              {!isDemo && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={isLoadingProfile}
                  onClick={handleLoadFromProfile}
                >
                  {isLoadingProfile ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <User className="w-3 h-3 mr-1" />
                  )}{" "}
                  Vault
                </Button>
              )}
            </div>
          </div>
          <Textarea
            className="h-64 resize-none bg-card border-border text-sm"
            placeholder="Your resume auto-loads from your vault. You can also paste or upload here."
            value={resume}
            onChange={(e) => setResume(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {resume.length} characters
          </p>
        </div>
      </div>

      {/* Version picker modal */}
      {showVersionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="font-display font-bold text-foreground text-lg mb-4">
              Choose a Resume Version
            </h3>
            <div className="space-y-2 mb-4">
              {resumeVersions.map((v) => (
                <button
                  key={v.id}
                  className="w-full text-left p-3 rounded-xl border border-border hover:border-accent transition-colors"
                  onClick={() => {
                    setResume(v.resume_text);
                    setShowVersionPicker(false);
                    toast.success(`Loaded "${v.version_name}"`);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {v.version_name}
                    </span>
                    {v.job_type && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {v.job_type}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {v.resume_text.slice(0, 80)}...
                  </p>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowVersionPicker(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Analyze button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          className="gradient-indigo text-white font-semibold text-lg px-12 py-6 rounded-xl shadow-indigo-500/20 hover:opacity-90"
          disabled={!jobDesc.trim() || !resume.trim() || isAnalyzing}
          onClick={() => onAnalyze(jobDesc, resume, jobLink)}
        >
          {isAnalyzing ? (
            <>
              <Sparkles className="w-5 h-5 mr-2 animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              <Target className="w-5 h-5 mr-2" /> Analyze My Fit
            </>
          )}
        </Button>
      </div>

      {isAnalyzing && (
        <div className="mt-6 max-w-sm mx-auto">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full gradient-indigo rounded-full animate-pulse"
              style={{ width: "60%" }}
            />
          </div>
          <p className="text-center text-muted-foreground text-sm mt-3">
            Matching skills and identifying gaps…
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Target, Sparkles, Link2, Download, Loader2, Upload, FileText, User,
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

export default function AnalysisForm({ onAnalyze, isAnalyzing, isDemo, prefillJob, prefillJobLink }: AnalysisFormProps) {
  const [jobDesc, setJobDesc] = useState("");
  const [resume, setResume] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersionOption[]>([]);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const resumeFileRef = useRef<HTMLInputElement>(null);

  // Auto-load resume from vault on mount & handle prefill from navigation
  useEffect(() => {
    if (isDemo) {
      setJobDesc(DEMO_JOB);
      setResume(DEMO_RESUME);
      return;
    }

    // Handle prefill from navigation state (e.g. from Job Search "Check My Chances")
    if (prefillJob) setJobDesc(prefillJob);
    if (prefillJobLink) {
      setJobLink(prefillJobLink);
      (async () => {
        setIsFetchingJob(true);
        try {
          const result = await scrapeUrl(prefillJobLink);
          if (result.success && result.markdown) {
            setJobDesc(result.markdown);
            toast.success("Job description fetched from link!");
          } else if (result.extractionFailed) {
            toast.warning(result.error || "Could not extract job description. Please paste it manually.", { duration: 6000 });
            if (result.partialText) setJobDesc(result.partialText);
          }
        } catch (e) { console.error("[AnalysisForm] URL fetch failed:", e); }
        finally { setIsFetchingJob(false); }
      })();
    }

    const params = new URLSearchParams(window.location.search);
    const prefillFromUrl = params.get("prefillJob");
    if (prefillFromUrl) setJobDesc(prefillFromUrl);

    if (!autoLoaded) {
      autoLoadResume();
      setAutoLoaded(true);
    }
  }, [isDemo, prefillJob, prefillJobLink]);

  const autoLoadResume = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Try resume vault first
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

      // Fallback: build from profile
      const { data: profile } = await supabase
        .from("job_seeker_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile?.full_name) {
        const lines: string[] = [];
        if (profile.full_name) lines.push(profile.full_name);
        const contact = [profile.email, profile.phone, profile.location].filter(Boolean).join(" | ");
        if (contact) lines.push(contact);
        if (profile.summary) { lines.push(""); lines.push("PROFESSIONAL SUMMARY"); lines.push(profile.summary); }
        const skills = profile.skills as string[] | null;
        if (skills?.length) { lines.push(""); lines.push("SKILLS"); lines.push(skills.join(", ")); }
        setResume(lines.join("\n"));
        toast.info("Resume built from your profile. Upload a full resume for better results.");
      }
    } catch (e) {
      console.error("Auto-load resume failed:", e);
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
        // Sync skills to profile
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const extracted = extractProfileFromResume(result.text);
            if (extracted.skills.length) {
              const { data } = await supabase
                .from("job_seeker_profiles")
                .select("skills")
                .eq("user_id", session.user.id)
                .maybeSingle();
              const current = (data?.skills as string[]) || [];
              const newSkills = extracted.skills.filter(s => !current.map(c => c.toLowerCase()).includes(s.toLowerCase()));
              if (newSkills.length) {
                await supabase.from("job_seeker_profiles").upsert({
                  user_id: session.user.id,
                  skills: [...current, ...newSkills],
                  updated_at: new Date().toISOString(),
                } as any, { onConflict: "user_id" });
                toast.success(`${newSkills.length} new skill(s) synced to profile`);
              }
            }
          }
        } catch (e) { console.error("[AnalysisForm] Skill sync failed:", e); }
      } else {
        toast.error(result.error || "Could not extract text");
      }
    } catch (e) {
      console.error("[AnalysisForm] Resume upload failed:", e);
      toast.error("Failed to parse document");
    } finally {
      setIsUploadingResume(false);
      if (resumeFileRef.current) resumeFileRef.current.value = "";
    }
  };

  const handleFetchJobLink = async () => {
    if (!jobLink.trim()) return;
    setIsFetchingJob(true);
    try {
      const result = await scrapeUrl(jobLink);
      if (result.success && result.markdown) {
        setJobDesc(result.markdown);
        toast.success("Job description fetched!");
      } else if (result.extractionFailed) {
        toast.warning(
          result.error || "Could not extract the job description. Please paste it below instead.",
          { duration: 6000 }
        );
        if (result.partialText) setJobDesc(result.partialText);
      } else {
        toast.error(result.error || "Could not fetch");
      }
    } catch {
      toast.error("Failed to fetch job posting. Try pasting the description manually.");
    } finally {
      setIsFetchingJob(false);
    }
  };

  const handleLoadFromProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const { data: versionData } = await supabase
        .from("resume_versions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (versionData?.length) {
        setResumeVersions(versionData.map((v: any) => ({
          id: v.id, version_name: v.version_name, job_type: v.job_type || "", resume_text: v.resume_text,
        })));
        setShowVersionPicker(true);
      } else {
        toast.info("No resume versions found. Upload one in your Profile.");
      }
    } catch {
      toast.error("Failed to load versions");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          {isDemo ? (
            <>See how <span className="text-accent">FitCheck</span> works</>
          ) : (
            <>Analyze Your <span className="text-accent">Job Fit</span></>
          )}
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Paste a job description and your resume. Get your fit score, gaps, and AI-optimized resume in seconds.
        </p>
        {isDemo && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Demo Mode — no account needed
          </div>
        )}
      </div>

      {/* Job link fetch */}
      <div className="mb-4">
        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
          <Link2 className="w-3.5 h-3.5 text-accent" /> Job Posting URL <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          <Input
            className="bg-card border-border text-sm flex-1"
            placeholder="https://company.com/jobs/..."
            value={jobLink}
            onChange={(e) => setJobLink(e.target.value)}
            type="url"
          />
          <Button variant="outline" size="sm" disabled={!jobLink.trim() || isFetchingJob} onClick={handleFetchJobLink}>
            {isFetchingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="ml-1.5">Fetch</span>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Job Description</label>
          <Textarea
            className="h-64 resize-none bg-card border-border text-sm"
            placeholder="Paste the full job description here..."
            value={jobDesc}
            onChange={(e) => setJobDesc(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{jobDesc.length} characters</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-accent" /> Your Resume
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="default" size="sm"
                className="text-xs h-8 gradient-teal text-white shadow-teal hover:opacity-90"
                disabled={isUploadingResume || isDemo}
                onClick={() => resumeFileRef.current?.click()}
              >
                {isUploadingResume ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                Upload
              </Button>
              <input ref={resumeFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} />
              {!isDemo && (
                <Button variant="outline" size="sm" className="text-xs h-7" disabled={isLoadingProfile} onClick={handleLoadFromProfile}>
                  {isLoadingProfile ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <User className="w-3 h-3 mr-1" />}
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
          <p className="text-xs text-muted-foreground">{resume.length} characters</p>
        </div>
      </div>

      {/* Version Picker Modal */}
      {showVersionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="font-display font-bold text-foreground text-lg mb-4">Choose a Resume Version</h3>
            <div className="space-y-2 mb-4">
              {resumeVersions.map((v) => (
                <button
                  key={v.id}
                  className="w-full text-left p-3 rounded-xl border border-border hover:border-accent transition-colors"
                  onClick={() => { setResume(v.resume_text); setShowVersionPicker(false); toast.success(`Loaded "${v.version_name}"`); }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{v.version_name}</span>
                    {v.job_type && <Badge variant="outline" className="text-xs capitalize">{v.job_type}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{v.resume_text.slice(0, 80)}...</p>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowVersionPicker(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          className="gradient-teal text-white font-semibold text-lg px-12 py-6 rounded-xl shadow-teal hover:opacity-90"
          disabled={!jobDesc.trim() || !resume.trim() || isAnalyzing}
          onClick={() => onAnalyze(jobDesc, resume, jobLink)}
        >
          {isAnalyzing ? (
            <><Sparkles className="w-5 h-5 mr-2 animate-spin" /> Analyzing…</>
          ) : (
            <><Target className="w-5 h-5 mr-2" /> Analyze My Fit</>
          )}
        </Button>
      </div>

      {isAnalyzing && (
        <div className="mt-6 max-w-sm mx-auto">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full gradient-teal rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
          <p className="text-center text-muted-foreground text-sm mt-3">Matching skills and identifying gaps…</p>
        </div>
      )}
    </div>
  );
}

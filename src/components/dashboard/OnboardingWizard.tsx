import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload, UserCircle, Target, Sparkles, ChevronRight, CheckCircle2,
  Loader2, FileText, ArrowRight, Rocket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/api/parseDocument";
import { extractProfileFromResume } from "@/lib/analysisEngine";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

type WizardStep = "welcome" | "resume" | "preferences" | "done";

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("welcome");
  const [loading, setLoading] = useState(true);
  const [shouldShow, setShouldShow] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Preferences
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [salaryMin, setSalaryMin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { checkOnboardingStatus(); }, []);

  const checkOnboardingStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const [profileRes, resumeRes] = await Promise.all([
        supabase.from("job_seeker_profiles").select("full_name, skills, target_job_titles").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("resume_versions").select("id").eq("user_id", session.user.id).limit(1),
      ]);

      const profile = profileRes.data;
      const hasProfile = !!(profile?.full_name && (profile?.skills as string[])?.length > 0);
      const hasResume = !!(resumeRes.data && resumeRes.data.length > 0);

      if (!hasProfile && !hasResume) {
        setShouldShow(true);
      }
      
      if (profile?.target_job_titles) {
        setJobTitles(profile.target_job_titles as string[]);
      }
    } catch (e) { logger.error(e); }
    finally { setLoading(false); }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setExtracting(false);
    try {
      const result = await parseDocument(file);
      if (!result.success || !result.text) { toast.error("Could not extract text"); return; }

      setExtracting(true);

      // Save to resume vault
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from("resume_versions").insert({
        user_id: session.user.id,
        version_name: "Default",
        resume_text: result.text,
      } as any);

      // Extract profile via edge function
      const { data: extractData, error: fnErr } = await supabase.functions.invoke("extract-profile-fields", {
        body: { resumeText: result.text },
      });

      if (!fnErr && extractData) {
        const { profile: extracted } = extractData;
        const local = extractProfileFromResume(result.text);
        
        if (extracted) {
          const payload: any = {
            user_id: session.user.id,
            full_name: extracted.full_name || null,
            email: extracted.email || null,
            phone: extracted.phone || null,
            location: extracted.location || null,
            summary: extracted.summary || null,
            linkedin_url: extracted.linkedin_url || null,
            skills: extracted.skills?.length ? extracted.skills : null,
            work_experience: extracted.work_experience?.length ? extracted.work_experience : null,
            education: extracted.education?.length ? extracted.education : null,
            certifications: extracted.certifications?.length ? extracted.certifications : null,
            career_level: local.careerLevel || null,
            target_job_titles: local.jobTitles.length ? local.jobTitles : null,
            updated_at: new Date().toISOString(),
          };

          await supabase.from("job_seeker_profiles").upsert(payload, { onConflict: "user_id" });
          
          if (local.jobTitles.length) setJobTitles(local.jobTitles);
          toast.success("Resume uploaded & profile auto-filled!");
        }
      }

      setStep("preferences");
    } catch (e) {
      logger.error(e);
      toast.error("Failed to process resume");
    } finally {
      setUploading(false);
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("job_seeker_profiles").upsert({
        user_id: session.user.id,
        target_job_titles: jobTitles.length ? jobTitles : null,
        remote_only: remoteOnly,
        salary_min: salaryMin || null,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
      toast.success("Preferences saved!");
      setStep("done");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const addTitle = () => {
    const t = titleInput.trim();
    if (t && !jobTitles.includes(t)) { setJobTitles([...jobTitles, t]); setTitleInput(""); }
  };

  if (loading || !shouldShow || dismissed) return null;

  const steps = [
    { key: "welcome", label: "Welcome" },
    { key: "resume", label: "Upload Resume" },
    { key: "preferences", label: "Preferences" },
    { key: "done", label: "Ready!" },
  ];
  const currentIdx = steps.findIndex(s => s.key === step);
  const progress = Math.round(((currentIdx + 1) / steps.length) * 100);

  return (
    <Card className="p-6 border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
      {/* Progress */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-accent" />
          <span className="font-display font-bold text-foreground text-sm">Getting Started</span>
        </div>
        <span className="text-xs text-muted-foreground">Step {currentIdx + 1} of {steps.length}</span>
      </div>
      <Progress value={progress} className="h-1.5 mb-6" />

      {/* Step: Welcome */}
      {step === "welcome" && (
        <div className="text-center py-4">
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Welcome to iCareerOS!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Let's set up your profile in under 2 minutes. Upload your resume and we'll do the rest.
          </p>
          <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90" onClick={() => setStep("resume")}>
            <ArrowRight className="w-4 h-4 mr-2" /> Let's Go
          </Button>
        </div>
      )}

      {/* Step: Resume Upload */}
      {step === "resume" && (
        <div className="text-center py-4">
          <FileText className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Upload Your Resume</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Upload a PDF or Word doc. AI will extract your skills, experience, and certifications automatically.
          </p>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} />
          <div className="flex flex-col items-center gap-3">
            <Button
              className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90 px-8"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || extracting}
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {extracting ? "Extracting profile..." : "Uploading..."}</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Upload Resume</>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setStep("preferences")}>
              Skip — I'll fill in manually
            </Button>
          </div>
        </div>
      )}

      {/* Step: Preferences */}
      {step === "preferences" && (
        <div className="py-4 max-w-md mx-auto">
          <h2 className="font-display text-xl font-bold text-foreground mb-2 text-center">Set Your Job Preferences</h2>
          <p className="text-muted-foreground mb-6 text-center text-sm">
            Tell us what you're looking for so we can match you with the right jobs.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">Target Job Titles</label>
              <div className="flex gap-2">
                <Input value={titleInput} onChange={e => setTitleInput(e.target.value)} placeholder="e.g. Product Manager" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTitle())} />
                <Button variant="outline" size="sm" onClick={addTitle}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {jobTitles.map((t, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setJobTitles(jobTitles.filter((_, idx) => idx !== i))}>
                    {t} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">Minimum Salary</label>
              <Input value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="e.g. 80000" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} className="accent-[hsl(var(--accent))]" />
              <label className="text-sm text-foreground">Remote only</label>
            </div>
          </div>
          <div className="flex justify-center mt-6">
            <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90 px-8" onClick={handleSavePreferences} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save & Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="text-center py-4">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-2">You're All Set!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Your profile is ready. Start analyzing job postings to see your fit score and get AI-optimized resumes.
          </p>
          <div className="flex gap-3 justify-center">
            <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90" onClick={() => { setDismissed(true); navigate("/job-seeker"); }}>
              <Target className="w-4 h-4 mr-2" /> Analyze a Job
            </Button>
            <Button variant="outline" onClick={() => setDismissed(true)}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

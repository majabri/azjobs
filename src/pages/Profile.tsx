import { useState, useEffect, useRef } from "react";
import PortfolioEditor from "@/components/PortfolioEditor";
import ProfilePdfExport from "@/components/ProfilePdfExport";
import ReferralDashboard from "@/components/ReferralDashboard";
import EmailPreferences from "@/components/EmailPreferences";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Save, Upload, Plus, X, Loader2, Briefcase, GraduationCap,
  Award, User, FileText, Settings, Trash2, Edit2, DollarSign, Bot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/api/parseDocument";
import { extractProfileFromResume } from "@/lib/analysisEngine";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";

interface WorkExperience {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface Education {
  degree: string;
  institution: string;
  year: string;
}

interface ResumeVersion {
  id?: string;
  version_name: string;
  job_type: string;
  resume_text: string;
}

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  work_experience: WorkExperience[];
  education: Education[];
  certifications: string[];
  preferred_job_types: string[];
  career_level: string;
  target_job_titles: string[];
  salary_min: string;
  salary_max: string;
  remote_only: boolean;
  min_match_score: number;
}

const emptyProfile: ProfileData = {
  full_name: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  skills: [],
  work_experience: [],
  education: [],
  certifications: [],
  preferred_job_types: [],
  career_level: "",
  target_job_titles: [],
  salary_min: "",
  salary_max: "",
  remote_only: false,
  min_match_score: 60,
};

const JOB_TYPE_OPTIONS = [
  "remote", "hybrid", "in-office", "full-time", "part-time", "contract", "short-term",
];

function computeCompleteness(p: ProfileData): number {
  const fields = [
    !!p.full_name,
    !!p.email,
    !!p.phone,
    !!p.location,
    !!p.summary,
    p.skills.length > 0,
    p.work_experience.length > 0,
    p.education.length > 0,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Resume versions
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [newVersion, setNewVersion] = useState<ResumeVersion>({ version_name: "", job_type: "", resume_text: "" });
  const [showNewVersion, setShowNewVersion] = useState(false);

  useEffect(() => {
    loadProfile();
    loadVersions();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("job_seeker_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          location: data.location || "",
          summary: data.summary || "",
          skills: (data.skills as string[]) || [],
          work_experience: (data.work_experience as unknown as WorkExperience[]) || [],
          education: (data.education as unknown as Education[]) || [],
          certifications: (data.certifications as string[]) || [],
          preferred_job_types: ((data as any).preferred_job_types as string[]) || [],
          career_level: (data as any).career_level || "",
          target_job_titles: ((data as any).target_job_titles as string[]) || [],
          salary_min: (data as any).salary_min || "",
          salary_max: (data as any).salary_max || "",
          remote_only: (data as any).remote_only || false,
          min_match_score: (data as any).min_match_score ?? 60,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("resume_versions" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVersions((data as any[])?.map((v: any) => ({
        id: v.id,
        version_name: v.version_name,
        job_type: v.job_type || "",
        resume_text: v.resume_text,
      })) || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const payload = {
        user_id: session.user.id,
        full_name: profile.full_name || null,
        email: profile.email || null,
        phone: profile.phone || null,
        location: profile.location || null,
        summary: profile.summary || null,
        skills: profile.skills.length ? profile.skills : null,
        work_experience: profile.work_experience.length ? profile.work_experience : null,
        education: profile.education.length ? profile.education : null,
        certifications: profile.certifications.length ? profile.certifications : null,
        preferred_job_types: profile.preferred_job_types.length ? profile.preferred_job_types : null,
        career_level: profile.career_level || null,
        target_job_titles: profile.target_job_titles.length ? profile.target_job_titles : null,
        salary_min: profile.salary_min || null,
        salary_max: profile.salary_max || null,
        remote_only: profile.remote_only,
        min_match_score: profile.min_match_score,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("job_seeker_profiles")
        .upsert(payload as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile saved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleImportResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await parseDocument(file);
      if (!result.success || !result.text) {
        toast.error(result.error || "Could not extract text");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error("Please sign in"); return; }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-profile-fields`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ resumeText: result.text }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed to extract profile" }));
        toast.error(err.error || "Failed to extract profile");
        return;
      }
      const { profile: extracted } = await resp.json();

      // Run local analysis engine for career level, job titles, and additional skills/certs
      const localProfile = extractProfileFromResume(result.text);

      if (extracted) {
        setProfile((prev) => ({
          ...prev,
          full_name: extracted.full_name || prev.full_name,
          email: extracted.email || prev.email,
          phone: extracted.phone || prev.phone,
          location: extracted.location || prev.location,
          summary: extracted.summary || prev.summary,
          skills: extracted.skills?.length ? extracted.skills : prev.skills,
          work_experience: extracted.work_experience?.length ? extracted.work_experience : prev.work_experience,
          education: extracted.education?.length ? extracted.education : prev.education,
          certifications: extracted.certifications?.length ? extracted.certifications : prev.certifications,
          career_level: localProfile.careerLevel || prev.career_level,
          target_job_titles: localProfile.jobTitles.length ? localProfile.jobTitles : prev.target_job_titles,
        }));

        // Merge local engine skills/certs that AI might have missed
        setProfile((prev) => {
          const normalizedSkills = prev.skills.map(s => s.toLowerCase());
          const extraSkills = localProfile.skills.filter(s => !normalizedSkills.includes(s.toLowerCase()));
          const normalizedCerts = prev.certifications.map(c => c.toLowerCase());
          const extraCerts = localProfile.certifications.filter(c => !normalizedCerts.includes(c.toLowerCase()));
          return {
            ...prev,
            skills: extraSkills.length ? [...prev.skills, ...extraSkills] : prev.skills,
            certifications: extraCerts.length ? [...prev.certifications, ...extraCerts] : prev.certifications,
          };
        });

        const messages: string[] = ["Profile fields extracted!"];
        if (localProfile.careerLevel) messages.push(`Career level: ${localProfile.careerLevel}`);
        if (localProfile.jobTitles.length) messages.push(`${localProfile.jobTitles.length} job title(s) detected`);
        toast.success(messages.join(" · "));
      }
    } catch {
      toast.error("Failed to import resume");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Skills
  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !profile.skills.includes(s)) {
      setProfile({ ...profile, skills: [...profile.skills, s] });
      setSkillInput("");
    }
  };
  const removeSkill = (i: number) => setProfile({ ...profile, skills: profile.skills.filter((_, idx) => idx !== i) });

  // Certifications
  const addCert = () => {
    const c = certInput.trim();
    if (c && !profile.certifications.includes(c)) {
      setProfile({ ...profile, certifications: [...profile.certifications, c] });
      setCertInput("");
    }
  };
  const removeCert = (i: number) => setProfile({ ...profile, certifications: profile.certifications.filter((_, idx) => idx !== i) });

  // Work experience
  const addWorkExp = () => setProfile({ ...profile, work_experience: [...profile.work_experience, { title: "", company: "", startDate: "", endDate: "", description: "" }] });
  const updateWorkExp = (i: number, field: keyof WorkExperience, value: string) => {
    const updated = [...profile.work_experience];
    updated[i] = { ...updated[i], [field]: value };
    setProfile({ ...profile, work_experience: updated });
  };
  const removeWorkExp = (i: number) => setProfile({ ...profile, work_experience: profile.work_experience.filter((_, idx) => idx !== i) });

  // Education
  const addEdu = () => setProfile({ ...profile, education: [...profile.education, { degree: "", institution: "", year: "" }] });
  const updateEdu = (i: number, field: keyof Education, value: string) => {
    const updated = [...profile.education];
    updated[i] = { ...updated[i], [field]: value };
    setProfile({ ...profile, education: updated });
  };
  const removeEdu = (i: number) => setProfile({ ...profile, education: profile.education.filter((_, idx) => idx !== i) });

  // Job type preferences
  const toggleJobType = (type: string) => {
    setProfile((prev) => ({
      ...prev,
      preferred_job_types: prev.preferred_job_types.includes(type)
        ? prev.preferred_job_types.filter((t) => t !== type)
        : [...prev.preferred_job_types, type],
    }));
  };

  // Resume versions CRUD
  const saveVersion = async (version: ResumeVersion) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      if (version.id) {
        await (supabase.from("resume_versions" as any) as any).update({
          version_name: version.version_name,
          job_type: version.job_type || null,
          resume_text: version.resume_text,
          updated_at: new Date().toISOString(),
        }).eq("id", version.id);
      } else {
        await (supabase.from("resume_versions" as any) as any).insert({
          user_id: session.user.id,
          version_name: version.version_name,
          job_type: version.job_type || null,
          resume_text: version.resume_text,
        });
      }
      toast.success("Resume version saved!");
      loadVersions();
      setShowNewVersion(false);
      setEditingVersion(null);
    } catch {
      toast.error("Failed to save resume version");
    }
  };

  const deleteVersion = async (id: string) => {
    try {
      await (supabase.from("resume_versions" as any) as any).delete().eq("id", id);
      toast.success("Version deleted");
      loadVersions();
    } catch {
      toast.error("Failed to delete version");
    }
  };

  const completeness = computeCompleteness(profile);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/job-seeker")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <span className="text-lg font-bold text-foreground">My Profile</span>
          </div>
          <div className="flex items-center gap-2">
            <ProfilePdfExport profile={profile} />
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Completeness Indicator */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Profile Completeness</h3>
            <span className={`text-sm font-bold ${completeness === 100 ? "text-success" : completeness >= 60 ? "text-accent" : "text-warning"}`}>
              {completeness}%
            </span>
          </div>
          <Progress value={completeness} className="h-2" />
          {completeness < 100 && (
            <p className="text-xs text-muted-foreground mt-2">
              Complete your profile to get better job matches and analysis results.
            </p>
          )}
        </Card>

        {/* Import from Resume */}
        <Card className="p-6 border-dashed border-2 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-4">
            <FileText className="w-8 h-8 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Import from Resume</h3>
              <p className="text-sm text-muted-foreground">Upload a PDF or Word document to auto-fill your profile fields using AI.</p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleImportResume} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                {importing ? "Extracting..." : "Upload Resume"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Personal Info */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-primary" /> Personal Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="jane@email.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 (555) 123-4567" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="City, State" />
            </div>
          </div>
        </section>

        {/* Summary */}
        <section>
          <Label>Professional Summary</Label>
          <Textarea
            value={profile.summary}
            onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
            placeholder="Brief overview of your professional background and goals..."
            className="mt-1"
            rows={4}
          />
        </section>

        {/* Skills */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Skills</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.skills.map((s, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {s}
                <button onClick={() => removeSkill(i)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="Add a skill..."
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
          </div>
        </section>

        {/* Career Level */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-primary" /> Career Level
          </h2>
          {profile.career_level ? (
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-accent text-accent-foreground text-sm px-3 py-1">
                {profile.career_level}
              </Badge>
              <button onClick={() => setProfile({ ...profile, career_level: "" })} className="text-xs text-muted-foreground hover:text-destructive">
                Clear
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Upload a resume to auto-detect your career level, or set it manually below.</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {["Entry-Level / Junior", "Mid-Level", "Senior", "Manager", "Senior Manager / Principal", "Director", "VP / Senior Leadership", "C-Level / Executive"].map((level) => (
              <Badge
                key={level}
                variant={profile.career_level === level ? "default" : "outline"}
                className={`cursor-pointer text-xs ${
                  profile.career_level === level
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent/10"
                }`}
                onClick={() => setProfile({ ...profile, career_level: level })}
              >
                {level}
              </Badge>
            ))}
          </div>
        </section>

        {/* Target Job Titles */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-primary" /> Target Job Titles
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.target_job_titles.map((t, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {t}
                <button onClick={() => setProfile({ ...profile, target_job_titles: profile.target_job_titles.filter((_, idx) => idx !== i) })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              id="title-input"
              placeholder="Add a target job title..."
              className="max-w-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val && !profile.target_job_titles.includes(val)) {
                    setProfile({ ...profile, target_job_titles: [...profile.target_job_titles, val] });
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
            <Button variant="outline" size="sm" onClick={() => {
              const el = document.getElementById("title-input") as HTMLInputElement;
              const val = el?.value.trim();
              if (val && !profile.target_job_titles.includes(val)) {
                setProfile({ ...profile, target_job_titles: [...profile.target_job_titles, val] });
                el.value = "";
              }
            }}><Plus className="w-4 h-4" /></Button>
          </div>
        </section>

        {/* Auto-Apply Preferences */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <Bot className="w-4 h-4 text-primary" /> Auto-Apply Defaults
          </h2>
          <p className="text-xs text-muted-foreground mb-4">These defaults are used by the Auto-Apply Agent and Job Search. You can override them per session.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Min Salary</Label>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={profile.salary_min} onChange={(e) => setProfile({ ...profile, salary_min: e.target.value })} placeholder="80,000" />
                </div>
              </div>
              <div>
                <Label>Max Salary</Label>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={profile.salary_max} onChange={(e) => setProfile({ ...profile, salary_max: e.target.value })} placeholder="150,000" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={profile.remote_only} onCheckedChange={(v) => setProfile({ ...profile, remote_only: v })} />
              <Label className="text-sm">Remote Only</Label>
            </div>
            <div>
              <Label className="text-sm font-semibold">Minimum Match Score: {profile.min_match_score}%</Label>
              <input
                type="range"
                min={30}
                max={90}
                value={profile.min_match_score}
                onChange={(e) => setProfile({ ...profile, min_match_score: parseInt(e.target.value) })}
                className="w-full mt-1 accent-[hsl(var(--accent))]"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More Jobs (30%)</span>
                <span>Higher Quality (90%)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Job Preferences */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-primary" /> Job Preferences
          </h2>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPE_OPTIONS.map((type) => (
              <Badge
                key={type}
                variant={profile.preferred_job_types.includes(type) ? "default" : "outline"}
                className={`cursor-pointer capitalize ${
                  profile.preferred_job_types.includes(type)
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent/10"
                }`}
                onClick={() => toggleJobType(type)}
              >
                {type}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Click to toggle your preferred job types.</p>
        </section>

        {/* Work Experience */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-primary" /> Work Experience
          </h2>
          <div className="space-y-4">
            {profile.work_experience.map((exp, i) => (
              <Card key={i} className="p-4 relative">
                <button onClick={() => removeWorkExp(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Job Title</Label><Input value={exp.title} onChange={(e) => updateWorkExp(i, "title", e.target.value)} placeholder="Product Manager" /></div>
                  <div><Label>Company</Label><Input value={exp.company} onChange={(e) => updateWorkExp(i, "company", e.target.value)} placeholder="Acme Corp" /></div>
                  <div><Label>Start Date</Label><Input value={exp.startDate} onChange={(e) => updateWorkExp(i, "startDate", e.target.value)} placeholder="Jan 2020" /></div>
                  <div><Label>End Date</Label><Input value={exp.endDate} onChange={(e) => updateWorkExp(i, "endDate", e.target.value)} placeholder="Present" /></div>
                </div>
                <div className="mt-3">
                  <Label>Description</Label>
                  <Textarea value={exp.description} onChange={(e) => updateWorkExp(i, "description", e.target.value)} placeholder="Key responsibilities and achievements..." rows={3} />
                </div>
              </Card>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={addWorkExp}>
            <Plus className="w-4 h-4 mr-1" /> Add Experience
          </Button>
        </section>

        {/* Education */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <GraduationCap className="w-4 h-4 text-primary" /> Education
          </h2>
          <div className="space-y-4">
            {profile.education.map((edu, i) => (
              <Card key={i} className="p-4 relative">
                <button onClick={() => removeEdu(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label>Degree</Label><Input value={edu.degree} onChange={(e) => updateEdu(i, "degree", e.target.value)} placeholder="B.S. Computer Science" /></div>
                  <div><Label>Institution</Label><Input value={edu.institution} onChange={(e) => updateEdu(i, "institution", e.target.value)} placeholder="State University" /></div>
                  <div><Label>Year</Label><Input value={edu.year} onChange={(e) => updateEdu(i, "year", e.target.value)} placeholder="2020" /></div>
                </div>
              </Card>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={addEdu}>
            <Plus className="w-4 h-4 mr-1" /> Add Education
          </Button>
        </section>

        {/* Certifications */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-primary" /> Certifications
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.certifications.map((c, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {c}
                <button onClick={() => removeCert(i)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCert())}
              placeholder="Add a certification..."
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addCert}><Plus className="w-4 h-4" /></Button>
          </div>
        </section>

        {/* Resume Versions */}
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" /> Resume Versions
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create different resume versions tailored for different job types.
          </p>

          <div className="space-y-3">
            {versions.map((v, i) => (
              <Card key={v.id || i} className="p-4">
                {editingVersion === i ? (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label>Version Name</Label><Input value={v.version_name} onChange={(e) => { const u = [...versions]; u[i] = { ...u[i], version_name: e.target.value }; setVersions(u); }} /></div>
                      <div><Label>Job Type</Label><Input value={v.job_type} onChange={(e) => { const u = [...versions]; u[i] = { ...u[i], job_type: e.target.value }; setVersions(u); }} placeholder="e.g. remote, technical" /></div>
                    </div>
                    <div><Label>Resume Text</Label><Textarea value={v.resume_text} onChange={(e) => { const u = [...versions]; u[i] = { ...u[i], resume_text: e.target.value }; setVersions(u); }} rows={6} /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveVersion(v)}><Save className="w-3.5 h-3.5 mr-1" /> Save</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditingVersion(null); loadVersions(); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{v.version_name}</span>
                        {v.job_type && <Badge variant="outline" className="text-xs capitalize">{v.job_type}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.resume_text.slice(0, 150)}...</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingVersion(i)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => v.id && deleteVersion(v.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {showNewVersion ? (
            <Card className="p-4 mt-3 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Version Name</Label><Input value={newVersion.version_name} onChange={(e) => setNewVersion({ ...newVersion, version_name: e.target.value })} placeholder="e.g. Technical, Management" /></div>
                <div><Label>Job Type</Label><Input value={newVersion.job_type} onChange={(e) => setNewVersion({ ...newVersion, job_type: e.target.value })} placeholder="e.g. remote, full-time" /></div>
              </div>
              <div><Label>Resume Text</Label><Textarea value={newVersion.resume_text} onChange={(e) => setNewVersion({ ...newVersion, resume_text: e.target.value })} rows={6} placeholder="Paste or write your resume version here..." /></div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveVersion(newVersion)} disabled={!newVersion.version_name.trim()}>
                  <Save className="w-3.5 h-3.5 mr-1" /> Save Version
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowNewVersion(false); setNewVersion({ version_name: "", job_type: "", resume_text: "" }); }}>Cancel</Button>
              </div>
            </Card>
          ) : (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowNewVersion(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Resume Version
            </Button>
          )}
        </section>

        {/* Bottom Save */}
        {/* Portfolio */}
        <PortfolioEditor />

        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Profile
          </Button>
        </div>
      </main>
    </div>
  );
}

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Save, Upload, Plus, X, Loader2, Briefcase, GraduationCap, Award, User, FileText, Settings, DollarSign, Bot, Linkedin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/api/parseDocument";
import { extractProfileFromResume } from "@/lib/analysisEngine";
import { toast } from "sonner";

interface WorkExperience { title: string; company: string; startDate: string; endDate: string; description: string; }
interface Education { degree: string; institution: string; year: string; }

export interface ProfileData {
  full_name: string; email: string; phone: string; location: string; summary: string;
  linkedin_url: string;
  skills: string[]; work_experience: WorkExperience[]; education: Education[];
  certifications: string[]; preferred_job_types: string[]; career_level: string;
  target_job_titles: string[]; salary_min: string; salary_max: string;
  remote_only: boolean; min_match_score: number;
}

export const emptyProfile: ProfileData = {
  full_name: "", email: "", phone: "", location: "", summary: "",
  linkedin_url: "",
  skills: [], work_experience: [], education: [], certifications: [],
  preferred_job_types: [], career_level: "", target_job_titles: [],
  salary_min: "", salary_max: "", remote_only: false, min_match_score: 60,
};

const JOB_TYPE_OPTIONS = ["remote", "hybrid", "in-office", "full-time", "part-time", "contract"];
const CAREER_LEVELS = ["Entry-Level / Junior", "Mid-Level", "Senior", "Manager", "Director", "VP / Senior Leadership", "C-Level / Executive"];

function computeCompleteness(p: ProfileData): number {
  const fields = [!!p.full_name, !!p.email, !!p.location, !!p.summary, p.skills.length > 0, p.work_experience.length > 0, p.education.length > 0];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

interface Props {
  profile: ProfileData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  onSave: () => Promise<void>;
  saving: boolean;
}

export default function ProfileForm({ profile, setProfile, onSave, saving }: Props) {
  const [importing, setImporting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImportResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await parseDocument(file);
      if (!result.success || !result.text) { toast.error(result.error || "Could not extract text"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error("Please sign in"); return; }
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-profile-fields`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText: result.text }),
      });
      if (!resp.ok) { toast.error("Failed to extract profile"); return; }
      const { profile: extracted } = await resp.json();
      const local = extractProfileFromResume(result.text);
      if (extracted) {
        setProfile(prev => ({
          ...prev,
          full_name: extracted.full_name || prev.full_name,
          email: extracted.email || prev.email,
          phone: extracted.phone || prev.phone,
          location: extracted.location || prev.location,
          summary: extracted.summary || prev.summary,
          linkedin_url: extracted.linkedin_url || prev.linkedin_url,
          skills: extracted.skills?.length ? extracted.skills : prev.skills,
          work_experience: extracted.work_experience?.length ? extracted.work_experience : prev.work_experience,
          education: extracted.education?.length ? extracted.education : prev.education,
          certifications: extracted.certifications?.length ? extracted.certifications : prev.certifications,
          career_level: local.careerLevel || prev.career_level,
          target_job_titles: local.jobTitles.length ? local.jobTitles : prev.target_job_titles,
        }));
        toast.success("Profile fields extracted!");
      }
    } catch { toast.error("Failed to import resume"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const addSkill = () => { const s = skillInput.trim(); if (s && !profile.skills.includes(s)) { setProfile({ ...profile, skills: [...profile.skills, s] }); setSkillInput(""); } };
  const addCert = () => { const c = certInput.trim(); if (c && !profile.certifications.includes(c)) { setProfile({ ...profile, certifications: [...profile.certifications, c] }); setCertInput(""); } };
  const addWorkExp = () => setProfile({ ...profile, work_experience: [...profile.work_experience, { title: "", company: "", startDate: "", endDate: "", description: "" }] });
  const updateWorkExp = (i: number, field: keyof WorkExperience, value: string) => { const u = [...profile.work_experience]; u[i] = { ...u[i], [field]: value }; setProfile({ ...profile, work_experience: u }); };
  const addEdu = () => setProfile({ ...profile, education: [...profile.education, { degree: "", institution: "", year: "" }] });
  const updateEdu = (i: number, field: keyof Education, value: string) => { const u = [...profile.education]; u[i] = { ...u[i], [field]: value }; setProfile({ ...profile, education: u }); };

  const completeness = computeCompleteness(profile);

  return (
    <div className="space-y-8">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-foreground">My Profile</span>
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
        </Button>
      </div>

      {/* Completeness */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Profile Completeness</h3>
          <span className={`text-sm font-bold ${completeness === 100 ? "text-success" : completeness >= 60 ? "text-accent" : "text-warning"}`}>{completeness}%</span>
        </div>
        <Progress value={completeness} className="h-2" />
      </Card>

      {/* Import */}
      <Card className="p-6 border-dashed border-2 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-4">
          <FileText className="w-8 h-8 text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Import from Resume</h3>
            <p className="text-sm text-muted-foreground">Upload PDF/DOCX to auto-fill profile using AI.</p>
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
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><User className="w-4 h-4 text-primary" /> Personal Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Full Name</Label><Input value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} placeholder="Jane Doe" /></div>
          <div><Label>Email</Label><Input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="jane@email.com" /></div>
          <div><Label>Phone</Label><Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 555-123-4567" /></div>
          <div><Label>Location</Label><Input value={profile.location} onChange={e => setProfile({ ...profile, location: e.target.value })} placeholder="City, State" /></div>
          <div className="sm:col-span-2">
            <Label className="flex items-center gap-2"><Linkedin className="w-4 h-4 text-primary" /> LinkedIn Profile URL</Label>
            <Input
              value={profile.linkedin_url}
              onChange={e => setProfile({ ...profile, linkedin_url: e.target.value })}
              placeholder="https://www.linkedin.com/in/your-profile"
            />
          </div>
        </div>
      </section>

      {/* Summary */}
      <section>
        <Label>Professional Summary</Label>
        <Textarea value={profile.summary} onChange={e => setProfile({ ...profile, summary: e.target.value })} placeholder="Brief overview..." className="mt-1" rows={4} />
      </section>

      {/* Skills */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Skills</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {profile.skills.map((s, i) => <Badge key={i} variant="secondary" className="gap-1">{s}<button onClick={() => setProfile({ ...profile, skills: profile.skills.filter((_, idx) => idx !== i) })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button></Badge>)}
        </div>
        <div className="flex gap-2">
          <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} placeholder="Add a skill..." className="max-w-xs" />
          <Button variant="outline" size="sm" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
        </div>
      </section>

      {/* Career Level */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3"><Briefcase className="w-4 h-4 text-primary" /> Career Level <span className="text-xs text-muted-foreground font-normal">(select multiple)</span></h2>
        <div className="flex flex-wrap gap-2">
          {CAREER_LEVELS.map(level => {
            const levels = profile.career_level ? profile.career_level.split(", ").filter(Boolean) : [];
            const isSelected = levels.includes(level);
            return (
              <Badge
                key={level}
                variant={isSelected ? "default" : "outline"}
                className={`cursor-pointer text-xs ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                onClick={() => {
                  const newLevels = isSelected ? levels.filter(l => l !== level) : [...levels, level];
                  setProfile({ ...profile, career_level: newLevels.join(", ") });
                }}
              >{level}</Badge>
            );
          })}
        </div>
      </section>

      {/* Target Job Titles */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3"><Briefcase className="w-4 h-4 text-primary" /> Target Job Titles</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {profile.target_job_titles.map((t, i) => <Badge key={i} variant="secondary" className="gap-1">{t}<button onClick={() => setProfile({ ...profile, target_job_titles: profile.target_job_titles.filter((_, idx) => idx !== i) })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button></Badge>)}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Add a target title..." className="max-w-sm" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const val = (e.target as HTMLInputElement).value.trim(); if (val && !profile.target_job_titles.includes(val)) { setProfile({ ...profile, target_job_titles: [...profile.target_job_titles, val] }); (e.target as HTMLInputElement).value = ""; } } }} />
          <Button variant="outline" size="sm" onClick={() => {}}><Plus className="w-4 h-4" /></Button>
        </div>
      </section>

      {/* Job Preferences */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><Bot className="w-4 h-4 text-primary" /> Job Preferences</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Min Salary</Label><div className="flex items-center gap-1 mt-1"><DollarSign className="w-4 h-4 text-muted-foreground" /><Input value={profile.salary_min} onChange={e => setProfile({ ...profile, salary_min: e.target.value })} placeholder="80,000" /></div></div>
            <div><Label>Max Salary</Label><div className="flex items-center gap-1 mt-1"><DollarSign className="w-4 h-4 text-muted-foreground" /><Input value={profile.salary_max} onChange={e => setProfile({ ...profile, salary_max: e.target.value })} placeholder="150,000" /></div></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={profile.remote_only} onCheckedChange={v => setProfile({ ...profile, remote_only: v })} /><Label>Remote Only</Label></div>
          <div>
            <Label className="text-sm font-semibold">Minimum Fit Score: {profile.min_match_score}%</Label>
            <input type="range" min={30} max={90} value={profile.min_match_score} onChange={e => setProfile({ ...profile, min_match_score: parseInt(e.target.value) })} className="w-full mt-1 accent-[hsl(var(--accent))]" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>More Jobs (30%)</span><span>Higher Quality (90%)</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPE_OPTIONS.map(type => <Badge key={type} variant={profile.preferred_job_types.includes(type) ? "default" : "outline"} className={`cursor-pointer capitalize ${profile.preferred_job_types.includes(type) ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`} onClick={() => setProfile(prev => ({ ...prev, preferred_job_types: prev.preferred_job_types.includes(type) ? prev.preferred_job_types.filter(t => t !== type) : [...prev.preferred_job_types, type] }))}>{type}</Badge>)}
          </div>
        </div>
      </section>

      {/* Work Experience */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><Briefcase className="w-4 h-4 text-primary" /> Work Experience</h2>
        <div className="space-y-4">
          {profile.work_experience.map((exp, i) => (
            <Card key={i} className="p-4 relative">
              <button onClick={() => setProfile({ ...profile, work_experience: profile.work_experience.filter((_, idx) => idx !== i) })} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Job Title</Label><Input value={exp.title} onChange={e => updateWorkExp(i, "title", e.target.value)} placeholder="Product Manager" /></div>
                <div><Label>Company</Label><Input value={exp.company} onChange={e => updateWorkExp(i, "company", e.target.value)} placeholder="Acme Corp" /></div>
                <div><Label>Start Date</Label><Input value={exp.startDate} onChange={e => updateWorkExp(i, "startDate", e.target.value)} placeholder="Jan 2020" /></div>
                <div><Label>End Date</Label><Input value={exp.endDate} onChange={e => updateWorkExp(i, "endDate", e.target.value)} placeholder="Present" /></div>
              </div>
              <div className="mt-3"><Label>Description</Label><Textarea value={exp.description} onChange={e => updateWorkExp(i, "description", e.target.value)} placeholder="Key responsibilities..." rows={3} /></div>
            </Card>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={addWorkExp}><Plus className="w-4 h-4 mr-1" /> Add Experience</Button>
      </section>

      {/* Education */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><GraduationCap className="w-4 h-4 text-primary" /> Education</h2>
        <div className="space-y-4">
          {profile.education.map((edu, i) => (
            <Card key={i} className="p-4 relative">
              <button onClick={() => setProfile({ ...profile, education: profile.education.filter((_, idx) => idx !== i) })} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Degree</Label><Input value={edu.degree} onChange={e => updateEdu(i, "degree", e.target.value)} placeholder="B.S. Computer Science" /></div>
                <div><Label>Institution</Label><Input value={edu.institution} onChange={e => updateEdu(i, "institution", e.target.value)} placeholder="University" /></div>
                <div><Label>Year</Label><Input value={edu.year} onChange={e => updateEdu(i, "year", e.target.value)} placeholder="2020" /></div>
              </div>
            </Card>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={addEdu}><Plus className="w-4 h-4 mr-1" /> Add Education</Button>
      </section>

      {/* Certifications */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><Award className="w-4 h-4 text-primary" /> Certifications</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {profile.certifications.map((c, i) => <Badge key={i} variant="secondary" className="gap-1">{c}<button onClick={() => setProfile({ ...profile, certifications: profile.certifications.filter((_, idx) => idx !== i) })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button></Badge>)}
        </div>
        <div className="flex gap-2">
          <Input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCert())} placeholder="Add a certification..." className="max-w-xs" />
          <Button variant="outline" size="sm" onClick={addCert}><Plus className="w-4 h-4" /></Button>
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={onSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save Profile</Button>
      </div>
    </div>
  );
}

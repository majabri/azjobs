import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, Upload, Plus, X, Loader2, Briefcase, GraduationCap, Award, User, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/api/parseDocument";
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
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
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
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
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
      if (extracted) {
        setProfile({
          full_name: extracted.full_name || profile.full_name,
          email: extracted.email || profile.email,
          phone: extracted.phone || profile.phone,
          location: extracted.location || profile.location,
          summary: extracted.summary || profile.summary,
          skills: extracted.skills?.length ? extracted.skills : profile.skills,
          work_experience: extracted.work_experience?.length ? extracted.work_experience : profile.work_experience,
          education: extracted.education?.length ? extracted.education : profile.education,
          certifications: extracted.certifications?.length ? extracted.certifications : profile.certifications,
        });
        toast.success("Profile fields extracted from resume!");
      }
    } catch {
      toast.error("Failed to import resume");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !profile.skills.includes(s)) {
      setProfile({ ...profile, skills: [...profile.skills, s] });
      setSkillInput("");
    }
  };

  const removeSkill = (i: number) => {
    setProfile({ ...profile, skills: profile.skills.filter((_, idx) => idx !== i) });
  };

  const addCert = () => {
    const c = certInput.trim();
    if (c && !profile.certifications.includes(c)) {
      setProfile({ ...profile, certifications: [...profile.certifications, c] });
      setCertInput("");
    }
  };

  const removeCert = (i: number) => {
    setProfile({ ...profile, certifications: profile.certifications.filter((_, idx) => idx !== i) });
  };

  const addWorkExp = () => {
    setProfile({
      ...profile,
      work_experience: [...profile.work_experience, { title: "", company: "", startDate: "", endDate: "", description: "" }],
    });
  };

  const updateWorkExp = (i: number, field: keyof WorkExperience, value: string) => {
    const updated = [...profile.work_experience];
    updated[i] = { ...updated[i], [field]: value };
    setProfile({ ...profile, work_experience: updated });
  };

  const removeWorkExp = (i: number) => {
    setProfile({ ...profile, work_experience: profile.work_experience.filter((_, idx) => idx !== i) });
  };

  const addEdu = () => {
    setProfile({
      ...profile,
      education: [...profile.education, { degree: "", institution: "", year: "" }],
    });
  };

  const updateEdu = (i: number, field: keyof Education, value: string) => {
    const updated = [...profile.education];
    updated[i] = { ...updated[i], [field]: value };
    setProfile({ ...profile, education: updated });
  };

  const removeEdu = (i: number) => {
    setProfile({ ...profile, education: profile.education.filter((_, idx) => idx !== i) });
  };

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
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
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
                  <div>
                    <Label>Job Title</Label>
                    <Input value={exp.title} onChange={(e) => updateWorkExp(i, "title", e.target.value)} placeholder="Product Manager" />
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input value={exp.company} onChange={(e) => updateWorkExp(i, "company", e.target.value)} placeholder="Acme Corp" />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input value={exp.startDate} onChange={(e) => updateWorkExp(i, "startDate", e.target.value)} placeholder="Jan 2020" />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input value={exp.endDate} onChange={(e) => updateWorkExp(i, "endDate", e.target.value)} placeholder="Present" />
                  </div>
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
                  <div>
                    <Label>Degree</Label>
                    <Input value={edu.degree} onChange={(e) => updateEdu(i, "degree", e.target.value)} placeholder="B.S. Computer Science" />
                  </div>
                  <div>
                    <Label>Institution</Label>
                    <Input value={edu.institution} onChange={(e) => updateEdu(i, "institution", e.target.value)} placeholder="State University" />
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Input value={edu.year} onChange={(e) => updateEdu(i, "year", e.target.value)} placeholder="2020" />
                  </div>
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

        {/* Bottom Save */}
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

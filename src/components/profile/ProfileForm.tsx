import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Save, Upload, Plus, X, Loader2, Briefcase, GraduationCap, Award, User, FileText, DollarSign, Linkedin, Target, MapPin, Sparkles, ChevronDown, BookmarkPlus, FolderOpen, Info, Lightbulb } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  search_mode?: string;
}

export const emptyProfile: ProfileData = {
  full_name: "", email: "", phone: "", location: "", summary: "",
  linkedin_url: "",
  skills: [], work_experience: [], education: [], certifications: [],
  preferred_job_types: [], career_level: "", target_job_titles: [],
  salary_min: "", salary_max: "", remote_only: false, min_match_score: 60,
  search_mode: "balanced",
};

const JOB_TYPE_OPTIONS = ["full-time", "part-time", "contract", "short-term"];
const WORK_MODE_OPTIONS = ["remote", "hybrid", "in-office"];
const CAREER_LEVELS = ["Entry-Level / Junior", "Mid-Level", "Senior", "Manager", "Director", "VP / Senior Leadership", "C-Level / Executive"];

const MARKET_BENCHMARKS: Record<string, { min: number; max: number }> = {
  "entry": { min: 50000, max: 80000 }, "junior": { min: 60000, max: 90000 },
  "mid": { min: 85000, max: 130000 }, "senior": { min: 120000, max: 175000 },
  "lead": { min: 140000, max: 200000 }, "staff": { min: 160000, max: 220000 },
  "principal": { min: 180000, max: 250000 }, "director": { min: 160000, max: 240000 },
  "vp": { min: 200000, max: 300000 }, "manager": { min: 110000, max: 170000 },
  "c-level": { min: 250000, max: 400000 }, "executive": { min: 250000, max: 400000 },
};

function getSalaryGuidance(careerLevel: string, titles: string[]): { min: number; max: number } | null {
  const levels = careerLevel.toLowerCase();
  for (const [key, range] of Object.entries(MARKET_BENCHMARKS)) {
    if (levels.includes(key) || titles.some(t => t.toLowerCase().includes(key))) return range;
  }
  if (levels.includes("senior")) return MARKET_BENCHMARKS["senior"];
  if (levels.includes("mid")) return MARKET_BENCHMARKS["mid"];
  if (levels.includes("entry") || levels.includes("junior")) return MARKET_BENCHMARKS["entry"];
  return null;
}

function computeCompleteness(p: ProfileData): number {
  const fields = [!!p.full_name, !!p.email, !!p.location, !!p.summary, p.skills.length > 0, p.work_experience.length > 0, p.education.length > 0];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function parseLocation(location: string): { city: string; state: string; country: string } {
  const parts = location.split(",").map(p => p.trim());
  if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts[2] };
  if (parts.length === 2) return { city: parts[0], state: parts[1], country: "" };
  return { city: parts[0] || "", state: "", country: "" };
}

function buildLocation(city: string, state: string, country: string): string {
  return [city, state, country].filter(Boolean).join(", ");
}

interface Props {
  profile: ProfileData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  onSave: () => Promise<void>;
  saving: boolean;
}

interface SearchPreset {
  id: string;
  name: string;
  criteria: Record<string, any>;
}

export default function ProfileForm({ profile, setProfile, onSave, saving }: Props) {
  const [importing, setImporting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(true);
  const [suggestingTitles, setSuggestingTitles] = useState(false);
  const [presets, setPresets] = useState<SearchPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loc = parseLocation(profile.location);

  // Load presets & missing skills on mount
  useEffect(() => {
    loadPresets();
    loadMissingSkills();
  }, []);

  const loadPresets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await (supabase.from("search_presets" as any) as any)
      .select("id, name, criteria")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (data) setPresets(data);
  };

  const loadMissingSkills = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("analysis_history")
      .select("gaps")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.gaps && Array.isArray(data.gaps)) {
      const gaps = (data.gaps as any[]).slice(0, 5).map(g => g.area || g.skill || g).filter(s => typeof s === "string");
      setMissingSkills(gaps);
    }
  };

  const savePreset = async () => {
    if (!presetName.trim()) { toast.error("Enter a preset name"); return; }
    setSavingPreset(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const criteria = {
        target_job_titles: profile.target_job_titles,
        career_level: profile.career_level,
        location: profile.location,
        preferred_job_types: profile.preferred_job_types,
        salary_min: profile.salary_min,
        salary_max: profile.salary_max,
        remote_only: profile.remote_only,
        min_match_score: profile.min_match_score,
        search_mode: profile.search_mode,
      };
      await (supabase.from("search_presets" as any) as any).insert({
        user_id: session.user.id, name: presetName.trim(), criteria,
      });
      setPresetName("");
      toast.success("Search preset saved!");
      loadPresets();
    } catch { toast.error("Failed to save preset"); }
    finally { setSavingPreset(false); }
  };

  const loadPreset = (preset: SearchPreset) => {
    const c = preset.criteria;
    setProfile(prev => ({
      ...prev,
      target_job_titles: c.target_job_titles || prev.target_job_titles,
      career_level: c.career_level || prev.career_level,
      location: c.location || prev.location,
      preferred_job_types: c.preferred_job_types || prev.preferred_job_types,
      salary_min: c.salary_min || prev.salary_min,
      salary_max: c.salary_max || prev.salary_max,
      remote_only: c.remote_only ?? prev.remote_only,
      min_match_score: c.min_match_score ?? prev.min_match_score,
      search_mode: c.search_mode || prev.search_mode,
    }));
    toast.success(`Loaded preset: ${preset.name}`);
  };

  const deletePreset = async (id: string) => {
    await (supabase.from("search_presets" as any) as any).delete().eq("id", id);
    setPresets(prev => prev.filter(p => p.id !== id));
    toast.success("Preset deleted");
  };

  const suggestTitles = async () => {
    if (profile.skills.length === 0 && profile.work_experience.length === 0) {
      toast.error("Add skills or experience first"); return;
    }
    setSuggestingTitles(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-profile-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ resumeText: `Skills: ${profile.skills.join(", ")}. Experience: ${profile.work_experience.map(w => `${w.title} at ${w.company}`).join("; ")}` }),
      });
      if (!resp.ok) throw new Error("Failed");
      const { profile: extracted } = await resp.json();
      if (extracted?.target_job_titles?.length || extracted?.job_titles?.length) {
        const suggestions = (extracted.target_job_titles || extracted.job_titles || []).filter((t: string) => !profile.target_job_titles.includes(t));
        if (suggestions.length > 0) {
          setProfile(prev => ({ ...prev, target_job_titles: [...prev.target_job_titles, ...suggestions.slice(0, 5)] }));
          toast.success(`Added ${Math.min(suggestions.length, 5)} suggested titles`);
        } else toast.info("No new suggestions found");
      } else toast.info("No suggestions found");
    } catch { toast.error("Failed to suggest titles"); }
    finally { setSuggestingTitles(false); }
  };

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
  const salaryGuide = getSalaryGuidance(profile.career_level, profile.target_job_titles);

  const workModes = profile.preferred_job_types.filter(t => WORK_MODE_OPTIONS.includes(t));
  const jobTypes = profile.preferred_job_types.filter(t => JOB_TYPE_OPTIONS.includes(t));

  const toggleWorkMode = (mode: string) => {
    const current = profile.preferred_job_types;
    if (current.includes(mode)) {
      setProfile({ ...profile, preferred_job_types: current.filter(t => t !== mode), remote_only: mode === "remote" ? false : profile.remote_only });
    } else {
      setProfile({ ...profile, preferred_job_types: [...current, mode], remote_only: mode === "remote" ? true : profile.remote_only });
    }
  };

  const toggleJobType = (type: string) => {
    const current = profile.preferred_job_types;
    setProfile({ ...profile, preferred_job_types: current.includes(type) ? current.filter(t => t !== type) : [...current, type] });
  };

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
          <div className="sm:col-span-2">
            <Label className="flex items-center gap-2"><Linkedin className="w-4 h-4 text-primary" /> LinkedIn Profile URL</Label>
            <Input value={profile.linkedin_url} onChange={e => setProfile({ ...profile, linkedin_url: e.target.value })} placeholder="https://www.linkedin.com/in/your-profile" />
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

      {/* ═══════════════════════════════════════════════════════════════════
          SEARCH & MATCH CRITERIA — the core new section
          ═══════════════════════════════════════════════════════════════════ */}
      <Collapsible open={searchOpen} onOpenChange={setSearchOpen}>
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CollapsibleTrigger className="w-full p-5 flex items-center justify-between cursor-pointer hover:bg-primary/10 rounded-t-lg transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <h2 className="text-base font-bold text-foreground">Search & Match Criteria</h2>
                <p className="text-xs text-muted-foreground">Define what jobs you're looking for</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${searchOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>

          <CollapsibleContent className="px-5 pb-5 space-y-6">
            {/* Saved Presets */}
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mr-1">Presets:</span>
                {presets.map(p => (
                  <Badge key={p.id} variant="outline" className="cursor-pointer gap-1 hover:bg-accent/10" onClick={() => loadPreset(p)}>
                    {p.name}
                    <button onClick={(e) => { e.stopPropagation(); deletePreset(p.id); }} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Target Job Titles */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground">Target Job Titles</h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={suggestTitles} disabled={suggestingTitles}>
                  {suggestingTitles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI Suggest
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.target_job_titles.map((t, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">{t}
                    <button onClick={() => setProfile({ ...profile, target_job_titles: profile.target_job_titles.filter((_, idx) => idx !== i) })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add a target title..." className="max-w-sm" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const val = (e.target as HTMLInputElement).value.trim(); if (val && !profile.target_job_titles.includes(val)) { setProfile({ ...profile, target_job_titles: [...profile.target_job_titles, val] }); (e.target as HTMLInputElement).value = ""; } } }} />
                <Button variant="outline" size="sm" onClick={() => {}}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>

            {/* Career Level */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-primary" /> Career Level <span className="text-xs text-muted-foreground font-normal">(select multiple)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {CAREER_LEVELS.map(level => {
                  const levels = profile.career_level ? profile.career_level.split(", ").filter(Boolean) : [];
                  const isSelected = levels.includes(level);
                  return (
                    <Badge key={level} variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                      onClick={() => {
                        const newLevels = isSelected ? levels.filter(l => l !== level) : [...levels, level];
                        setProfile({ ...profile, career_level: newLevels.join(", ") });
                      }}
                    >{level}</Badge>
                  );
                })}
              </div>
            </div>

            {/* Location — structured fields */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary" /> Location
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={loc.city} onChange={e => setProfile({ ...profile, location: buildLocation(e.target.value, loc.state, loc.country) })} placeholder="e.g. London, Berlin, NYC" />
                </div>
                <div>
                  <Label className="text-xs">State / Province</Label>
                  <Input value={loc.state} onChange={e => setProfile({ ...profile, location: buildLocation(loc.city, e.target.value, loc.country) })} placeholder="e.g. CA, Ontario" />
                </div>
                <div>
                  <Label className="text-xs">Country</Label>
                  <Input value={loc.country} onChange={e => setProfile({ ...profile, location: buildLocation(loc.city, loc.state, e.target.value) })} placeholder="e.g. USA, UK, Germany" />
                </div>
              </div>
            </div>

            {/* Work Mode */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Work Mode</h3>
              <div className="flex flex-wrap gap-2">
                {WORK_MODE_OPTIONS.map(mode => (
                  <Badge key={mode} variant={workModes.includes(mode) ? "default" : "outline"}
                    className={`cursor-pointer capitalize ${workModes.includes(mode) ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                    onClick={() => toggleWorkMode(mode)}
                  >{mode}</Badge>
                ))}
              </div>
            </div>

            {/* Job Type */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Job Type</h3>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPE_OPTIONS.map(type => (
                  <Badge key={type} variant={jobTypes.includes(type) ? "default" : "outline"}
                    className={`cursor-pointer capitalize ${jobTypes.includes(type) ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                    onClick={() => toggleJobType(type)}
                  >{type}</Badge>
                ))}
              </div>
            </div>

            {/* Salary Range with guidance */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" /> Salary Range
              </h3>
              {salaryGuide && (
                <p className="text-xs text-accent mb-2 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  Suggested: ${salaryGuide.min.toLocaleString()}–${salaryGuide.max.toLocaleString()} based on your level
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Minimum</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Input value={profile.salary_min} onChange={e => setProfile({ ...profile, salary_min: e.target.value })} placeholder={salaryGuide ? salaryGuide.min.toLocaleString() : "80,000"} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Maximum</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Input value={profile.salary_max} onChange={e => setProfile({ ...profile, salary_max: e.target.value })} placeholder={salaryGuide ? salaryGuide.max.toLocaleString() : "150,000"} />
                  </div>
                </div>
              </div>
            </div>

            {/* Minimum Fit Score slider */}
            <TooltipProvider>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Minimum Fit Score: {profile.min_match_score}%</h3>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Lower score = more job opportunities shown. Higher score = better fit, fewer results. We recommend 50–70% for most searches.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Slider
                  value={[profile.min_match_score]}
                  onValueChange={([v]) => setProfile({ ...profile, min_match_score: v })}
                  min={30} max={90} step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>More Jobs (30%)</span><span>Higher Quality (90%)</span>
                </div>
              </div>
            </TooltipProvider>

            {/* Quality vs Volume toggle */}
            <TooltipProvider>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Search Mode</h3>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p><strong>Quality:</strong> Fewer, highly relevant results. <strong>Balanced:</strong> Good mix. <strong>Volume:</strong> Maximum results, looser matching.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex gap-2">
                  {(["quality", "balanced", "volume"] as const).map(mode => (
                    <Badge key={mode} variant={profile.search_mode === mode ? "default" : "outline"}
                      className={`cursor-pointer capitalize ${profile.search_mode === mode ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                      onClick={() => setProfile({ ...profile, search_mode: mode })}
                    >{mode}</Badge>
                  ))}
                </div>
              </div>
            </TooltipProvider>

            {/* Save Preset */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name..." className="max-w-[200px] h-8 text-sm" />
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={savePreset} disabled={savingPreset}>
                {savingPreset ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
                Save Preset
              </Button>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Top Missing Skills insight */}
      {missingSkills.length > 0 && (
        <Card className="p-4 border-accent/30 bg-accent/5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-accent" /> Top Missing Skills
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Based on your recent job analyses. Add these to strengthen your profile.</p>
          <div className="flex flex-wrap gap-2">
            {missingSkills.map((skill, i) => (
              <Badge key={i} variant="outline" className="cursor-pointer gap-1 border-accent/30 hover:bg-accent/10"
                onClick={() => {
                  if (!profile.skills.includes(skill)) {
                    setProfile(prev => ({ ...prev, skills: [...prev.skills, skill] }));
                    setMissingSkills(prev => prev.filter(s => s !== skill));
                    toast.success(`Added "${skill}" to your skills`);
                  }
                }}
              >
                <Plus className="w-3 h-3" /> {skill}
              </Badge>
            ))}
          </div>
        </Card>
      )}

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
    </div>
  );
}

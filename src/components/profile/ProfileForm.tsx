import { useState, useRef, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Save, Upload, Plus, X, Loader2, Briefcase, GraduationCap, Award, User,
  FileText, DollarSign, Linkedin, Target, MapPin, Sparkles, ChevronDown, BookmarkPlus, FolderOpen, Info, Lightbulb
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { parseDocument } from "@/lib/api/parseDocument";
import { extractProfileFromResume } from "@/lib/analysisEngine";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

import { profileSchema, type ProfileFormValues } from "@/lib/schemas/profile.schema";

const JOB_TYPE_OPTIONS = ["full-time", "part-time", "contract", "short-term"];
const WORK_MODE_OPTIONS = ["remote", "hybrid", "in-office"];
const CAREER_LEVELS = ["Entry-Level / Junior", "Mid-Level", "Senior", "Manager", "Director", "VP / Senior Leadership", "C-Level / Executive"];

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Germany", "France", "Australia",
  "India", "Netherlands", "Sweden", "Switzerland", "Ireland", "Singapore",
  "United Arab Emirates", "Japan", "Brazil", "Mexico", "Spain", "Italy",
  "South Korea", "New Zealand", "Israel", "Poland", "Portugal", "Belgium",
  "Denmark", "Norway", "Finland", "Austria", "Czech Republic", "South Africa",
  "Nigeria", "Kenya", "Egypt", "Saudi Arabia", "Qatar", "China", "Philippines",
  "Indonesia", "Malaysia", "Thailand", "Vietnam", "Colombia", "Argentina", "Chile",
];

const STATES_BY_COUNTRY: Record<string, string[]> = {
  "United States": ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"],
  "Canada": ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Nova Scotia","Ontario","Prince Edward Island","Quebec","Saskatchewan"],
  "United Kingdom": ["England","Scotland","Wales","Northern Ireland"],
  "Australia": ["New South Wales","Victoria","Queensland","South Australia","Western Australia","Tasmania","ACT","Northern Territory"],
  "India": ["Andhra Pradesh","Delhi","Gujarat","Karnataka","Maharashtra","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal","Rajasthan","Kerala"],
  "Germany": ["Bavaria","Berlin","Hamburg","Hesse","North Rhine-Westphalia","Baden-Württemberg","Saxony","Lower Saxony"],
  "Brazil": ["São Paulo","Rio de Janeiro","Minas Gerais","Bahia","Paraná"],
  "Mexico": ["Mexico City","Jalisco","Nuevo León","Puebla","Guanajuato"],
  "United Arab Emirates": ["Abu Dhabi","Dubai","Sharjah","Ajman"],
};

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

function computeCompleteness(p: ProfileFormValues): number {
  const fields = [!!p.full_name, !!p.email, !!p.location, !!p.summary, (p.skills || []).length > 0, (p.work_experience || []).length > 0, (p.education || []).length > 0];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function parseLocation(location: string): { city: string; state: string; country: string } {
  const parts = location ? location.split(",").map(p => p.trim()) : [];
  if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts[2] };
  if (parts.length === 2) return { city: parts[0], state: parts[1], country: "" };
  return { city: parts[0] || "", state: "", country: "" };
}

function buildLocation(city: string, state: string, country: string): string {
  return [city, state, country].filter(Boolean).join(", ");
}

interface Props {
  initialData: ProfileFormValues;
}

interface SearchPreset {
  id: string;
  name: string;
  criteria: Record<string, any>;
}

export default function ProfileForm({ initialData }: Props) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialData,
  });

  const { fields: workExpFields, append: appendWorkExp, remove: removeWorkExp } = useFieldArray({
    control: form.control,
    name: "work_experience",
  });

  const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({
    control: form.control,
    name: "education",
  });

  const [saving, setSaving] = useState(false);
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

  const locStr = form.watch("location") || "";
  const loc = parseLocation(locStr);
  const completeness = computeCompleteness(form.watch());
  const salaryGuide = getSalaryGuidance(form.watch("career_level") || "", form.watch("target_job_titles") || []);
  const preferredJobTypes = form.watch("preferred_job_types") || [];
  const workModes = preferredJobTypes.filter(t => WORK_MODE_OPTIONS.includes(t));
  const jobTypes = preferredJobTypes.filter(t => JOB_TYPE_OPTIONS.includes(t));

  useEffect(() => {
    loadPresets();
    loadMissingSkills();
  }, []);

  const loadPresets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("search_presets")
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
      const gaps = (data.gaps as Array<{ area?: string; skill?: string } | string>).slice(0, 5).map(g => typeof g === "string" ? g : (g as { area?: string; skill?: string }).area || (g as { area?: string; skill?: string }).skill || String(g)).filter(s => typeof s === "string");
      setMissingSkills(gaps);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      
      const payload = {
        user_id: session.user.id,
        full_name: data.full_name || null,
        email: data.email || null,
        phone: data.phone || null,
        location: data.location || null,
        summary: data.summary || null,
        linkedin_url: data.linkedin_url || null,
        skills: data.skills && data.skills.length ? data.skills : null,
        work_experience: data.work_experience && data.work_experience.length ? data.work_experience : null,
        education: data.education && data.education.length ? data.education : null,
        certifications: data.certifications && data.certifications.length ? data.certifications : null,
        preferred_job_types: data.preferred_job_types && data.preferred_job_types.length ? data.preferred_job_types : null,
        career_level: data.career_level || null,
        target_job_titles: data.target_job_titles && data.target_job_titles.length ? data.target_job_titles : null,
        salary_min: data.salary_min || null,
        salary_max: data.salary_max || null,
        remote_only: data.remote_only,
        min_match_score: data.min_match_score,
        search_mode: data.search_mode || "balanced",
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase.from("job_seeker_profiles").upsert(payload as Parameters<ReturnType<typeof supabase.from<"job_seeker_profiles">>["upsert"]>[0], { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile saved!");
    } catch (e) {
      logger.error(e);
      toast.error("Failed to save profile");
    } finally { setSaving(false); }
  };

  const savePreset = async () => {
    if (!presetName.trim()) { toast.error("Enter a preset name"); return; }
    setSavingPreset(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const data = form.getValues();
      const criteria = {
        target_job_titles: data.target_job_titles,
        career_level: data.career_level,
        location: data.location,
        preferred_job_types: data.preferred_job_types,
        salary_min: data.salary_min,
        salary_max: data.salary_max,
        remote_only: data.remote_only,
        min_match_score: data.min_match_score,
        search_mode: data.search_mode,
      };
      await supabase.from("search_presets").insert({
        user_id: session.user.id, name: presetName.trim(), criteria: criteria as Json,
      });
      setPresetName("");
      toast.success("Search preset saved!");
      loadPresets();
    } catch { toast.error("Failed to save preset"); }
    finally { setSavingPreset(false); }
  };

  const loadPreset = (preset: SearchPreset) => {
    const c = preset.criteria;
    form.setValue("target_job_titles", c.target_job_titles || []);
    form.setValue("career_level", c.career_level || "");
    form.setValue("location", c.location || "");
    form.setValue("preferred_job_types", c.preferred_job_types || []);
    form.setValue("salary_min", c.salary_min || "");
    form.setValue("salary_max", c.salary_max || "");
    form.setValue("remote_only", c.remote_only ?? false);
    form.setValue("min_match_score", c.min_match_score ?? 60);
    form.setValue("search_mode", c.search_mode || "balanced");
    toast.success(`Loaded preset: ${preset.name}`);
  };

  const deletePreset = async (id: string) => {
    await supabase.from("search_presets").delete().eq("id", id);
    setPresets(prev => prev.filter(p => p.id !== id));
    toast.success("Preset deleted");
  };

  const suggestTitles = async () => {
    const data = form.watch();
    if (!data.skills?.length && !data.work_experience?.length) {
      toast.error("Add skills or experience first"); return;
    }
    setSuggestingTitles(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const { data: extractResult, error: extractError } = await supabase.functions.invoke('extract-profile-fields', {
        body: { resumeText: `Skills: ${data.skills.join(", ")}. Experience: ${data.work_experience.map(w => `${w.title} at ${w.company}`).join("; ")}` },
      });
      if (extractError) throw extractError;
      const { profile: extracted } = extractResult;
      if (extracted?.target_job_titles?.length || extracted?.job_titles?.length) {
        const current = data.target_job_titles || [];
        const suggestions = (extracted.target_job_titles || extracted.job_titles || []).filter((t: string) => !current.includes(t));
        if (suggestions.length > 0) {
          form.setValue("target_job_titles", [...current, ...suggestions.slice(0, 5)]);
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
      if (!result.success || !result.text) {
        toast.error(result.error || "Could not extract text");
        return;
      }
      const local = extractProfileFromResume(result.text);

      let extracted: any = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const { data: fnData, error: fnError } = await supabase.functions.invoke("extract-profile-fields", {
            body: { resumeText: result.text },
          });
          if (!fnError && fnData) {
            extracted = fnData.profile;
          }
        }
      } catch (aiErr) {
        logger.warn("AI profile extraction unavailable, using local extraction:", aiErr);
      }

      const prev = form.getValues();
      form.reset({
        ...prev,
        full_name: extracted?.full_name || prev.full_name,
        email: extracted?.email || prev.email,
        phone: extracted?.phone || prev.phone,
        location: (extracted?.location && extracted.location !== '<UNKNOWN>' && extracted.location.trim() !== '') ? extracted.location : prev.location,
        summary: extracted?.summary || prev.summary,
        linkedin_url: extracted?.linkedin_url || prev.linkedin_url,
        skills: extracted?.skills?.length ? extracted.skills : local.skills?.length ? local.skills : prev.skills,
        work_experience: extracted?.work_experience?.length ? extracted.work_experience : prev.work_experience,
        education: extracted?.education?.length ? extracted.education : prev.education,
        certifications: extracted?.certifications?.length ? extracted.certifications : local.certifications?.length ? local.certifications : prev.certifications,
        career_level: local.careerLevel || prev.career_level,
        target_job_titles: local.jobTitles.length ? local.jobTitles : prev.target_job_titles,
      });

      if (extracted) toast.success("Profile fields extracted!");
      else toast.success("Basic profile info extracted — AI enhancement unavailable.");
    } catch (err) {
      logger.error("Resume import error:", err);
      toast.error("Failed to import resume. Please try again.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addSkill = () => { const s = skillInput.trim(); const current = form.getValues("skills") || []; if (s && !current.includes(s)) { form.setValue("skills", [...current, s]); setSkillInput(""); } };
  const addCert = () => { const c = certInput.trim(); const current = form.getValues("certifications") || []; if (c && !current.includes(c)) { form.setValue("certifications", [...current, c]); setCertInput(""); } };

  const toggleWorkMode = (mode: string) => {
    const current = form.getValues("preferred_job_types") || [];
    if (current.includes(mode)) {
      form.setValue("preferred_job_types", current.filter(t => t !== mode));
      if (mode === "remote") form.setValue("remote_only", false);
    } else {
      form.setValue("preferred_job_types", [...current, mode]);
      if (mode === "remote") form.setValue("remote_only", true);
    }
  };

  const toggleJobType = (type: string) => {
    const current = form.getValues("preferred_job_types") || [];
    form.setValue("preferred_job_types", current.includes(type) ? current.filter(t => t !== type) : [...current, type]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-foreground">My Profile</span>
          <Button type="submit" disabled={saving || !form.formState.isDirty} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
          </Button>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Profile Completeness</h3>
            <span className={`text-sm font-bold ${completeness === 100 ? "text-success" : completeness >= 60 ? "text-accent" : "text-warning"}`}>{completeness}%</span>
          </div>
          <Progress value={completeness} className="h-2" />
        </Card>

        <Card className="p-6 border-dashed border-2 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-4">
            <FileText className="w-8 h-8 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Import from Resume</h3>
              <p className="text-sm text-muted-foreground">Upload PDF/DOCX to auto-fill profile using AI.</p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleImportResume} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                {importing ? "Extracting..." : "Upload Resume"}
              </Button>
            </div>
          </div>
        </Card>

        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><User className="w-4 h-4 text-primary" /> Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="jane@email.com" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="+1 555-123-4567" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="linkedin_url" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel className="flex items-center gap-2"><Linkedin className="w-4 h-4 text-primary" /> LinkedIn Profile URL</FormLabel>
                <FormControl><Input placeholder="https://www.linkedin.com/in/your-profile" {...field} /></FormControl><FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        <section>
          <FormField control={form.control} name="summary" render={({ field }) => (
            <FormItem><FormLabel>Professional Summary</FormLabel><FormControl><Textarea placeholder="Brief overview..." rows={4} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Skills</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {(form.watch("skills") || []).map((s, i) => (
              <Badge key={i} variant="secondary" className="gap-1">{s}
                <button type="button" onClick={() => form.setValue("skills", form.getValues("skills").filter((_, idx) => idx !== i), { shouldDirty: true })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} placeholder="Add a skill..." className="max-w-xs" />
            <Button type="button" variant="outline" size="sm" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
          </div>
        </section>

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
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mr-1">Presets:</span>
                  {presets.map(p => (
                    <Badge key={p.id} variant="outline" className="cursor-pointer gap-1 hover:bg-accent/10" onClick={() => loadPreset(p)}>
                      {p.name}
                      <button type="button" onClick={(e) => { e.stopPropagation(); deletePreset(p.id); }} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Target Job Titles</h3>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={suggestTitles} disabled={suggestingTitles}>
                    {suggestingTitles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Suggest
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(form.watch("target_job_titles") || []).map((t, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">{t}
                      <button type="button" onClick={() => form.setValue("target_job_titles", form.getValues("target_job_titles").filter((_, idx) => idx !== i), { shouldDirty: true })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add a target title..." className="max-w-sm" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const val = (e.target as HTMLInputElement).value.trim(); if (val) { const cur = form.getValues("target_job_titles") || []; if (!cur.includes(val)) form.setValue("target_job_titles", [...cur, val], { shouldDirty: true }); (e.target as HTMLInputElement).value = ""; } } }} />
                  <Button type="button" variant="outline" size="sm"><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-primary" /> Career Level <span className="text-xs text-muted-foreground font-normal">(select multiple)</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {CAREER_LEVELS.map(level => {
                    const cLevel = form.watch("career_level") || "";
                    const levels = cLevel ? cLevel.split(", ").filter(Boolean) : [];
                    const isSelected = levels.includes(level);
                    return (
                      <Badge key={level} variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer text-xs ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                        onClick={() => {
                          const newLevels = isSelected ? levels.filter(l => l !== level) : [...levels, level];
                          form.setValue("career_level", newLevels.join(", "), { shouldDirty: true });
                        }}
                      >{level}</Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-primary" /> Location
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Country</Label>
                    <Select value={loc.country} onValueChange={(val) => { const newCountry = val === "__clear__" ? "" : val; form.setValue("location", buildLocation("", "", newCountry), { shouldDirty: true }); }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__" className="text-muted-foreground italic">— Clear —</SelectItem>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">State / Province</Label>
                    {loc.country && STATES_BY_COUNTRY[loc.country] ? (
                      <Select value={loc.state} onValueChange={(val) => { const newState = val === "__clear__" ? "" : val; form.setValue("location", buildLocation(loc.city, newState, loc.country), { shouldDirty: true }); }}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select state / province" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__clear__" className="text-muted-foreground italic">— Clear —</SelectItem>
                          {STATES_BY_COUNTRY[loc.country].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input className="mt-1" value={loc.state} onChange={e => form.setValue("location", buildLocation(loc.city, e.target.value, loc.country), { shouldDirty: true })} placeholder={loc.country ? "Type state / province" : "Select country first"} disabled={!loc.country} />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input className="mt-1" value={loc.city} onChange={e => form.setValue("location", buildLocation(e.target.value, loc.state, loc.country), { shouldDirty: true })} placeholder={loc.country ? "e.g. London, Berlin, NYC" : "Select country first"} disabled={!loc.country} />
                  </div>
                </div>
              </div>

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

              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-primary" /> Salary Range
                </h3>
                {salaryGuide && (
                  <p className="text-xs text-accent mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> Suggested: ${salaryGuide.min.toLocaleString()}–${salaryGuide.max.toLocaleString()} based on your level
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="salary_min" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Minimum</FormLabel>
                      <div className="flex items-center gap-1 mt-1">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <FormControl><Input placeholder={salaryGuide ? salaryGuide.min.toLocaleString() : "80,000"} {...field} /></FormControl>
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="salary_max" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Maximum</FormLabel>
                      <div className="flex items-center gap-1 mt-1">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <FormControl><Input placeholder={salaryGuide ? salaryGuide.max.toLocaleString() : "150,000"} {...field} /></FormControl>
                      </div>
                    </FormItem>
                  )} />
                </div>
              </div>

              <TooltipProvider>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Minimum Fit Score: {form.watch("min_match_score")}%</h3>
                    <Tooltip>
                      <TooltipTrigger asChild><button type="button"><Info className="w-4 h-4 text-muted-foreground" /></button></TooltipTrigger>
                      <TooltipContent className="max-w-xs"><p>Lower score = more job opportunities. Higher score = better fit.</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <Slider value={[form.watch("min_match_score") || 60]} onValueChange={([v]) => form.setValue("min_match_score", v, { shouldDirty: true })} min={30} max={90} step={5} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>More Jobs (30%)</span><span>Higher Quality (90%)</span></div>
                </div>
              </TooltipProvider>

              <TooltipProvider>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Search Mode</h3>
                    <Tooltip>
                      <TooltipTrigger asChild><button type="button"><Info className="w-4 h-4 text-muted-foreground" /></button></TooltipTrigger>
                      <TooltipContent className="max-w-xs"><p><strong>Quality:</strong> Fewer, highly relevant results. <strong>Balanced:</strong> Good mix. <strong>Volume:</strong> Maximum results.</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    {(["quality", "balanced", "volume"] as const).map(mode => (
                      <Badge key={mode} variant={form.watch("search_mode") === mode ? "default" : "outline"}
                        className={`cursor-pointer capitalize ${form.watch("search_mode") === mode ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                        onClick={() => form.setValue("search_mode", mode, { shouldDirty: true })}
                      >{mode}</Badge>
                    ))}
                  </div>
                </div>
              </TooltipProvider>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name..." className="max-w-[200px] h-8 text-sm" />
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={savePreset} disabled={savingPreset}>
                  {savingPreset ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />} Save Preset
                </Button>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {missingSkills.length > 0 && (
          <Card className="p-4 border-accent/30 bg-accent/5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-accent" /> Top Missing Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {missingSkills.map((skill, i) => (
                <Badge key={i} variant="outline" className="cursor-pointer gap-1 border-accent/30 hover:bg-accent/10"
                  onClick={() => {
                    const current = form.getValues("skills") || [];
                    if (!current.includes(skill)) {
                      form.setValue("skills", [...current, skill], { shouldDirty: true });
                      setMissingSkills(prev => prev.filter(s => s !== skill));
                      toast.success(`Added "${skill}" to your skills`);
                    }
                  }}
                ><Plus className="w-3 h-3" /> {skill}</Badge>
              ))}
            </div>
          </Card>
        )}

        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><Briefcase className="w-4 h-4 text-primary" /> Work Experience</h2>
          <div className="space-y-4">
            {workExpFields.map((field, index) => (
              <Card key={field.id} className="p-4 relative">
                <button type="button" onClick={() => removeWorkExp(index)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name={`work_experience.${index}.title`} render={({ field }) => (
                    <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input placeholder="Product Manager" {...field} /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={form.control} name={`work_experience.${index}.company`} render={({ field }) => (
                    <FormItem><FormLabel>Company</FormLabel><FormControl><Input placeholder="Acme Corp" {...field} /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={form.control} name={`work_experience.${index}.startDate`} render={({ field }) => (
                    <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input placeholder="Jan 2020" {...field} /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={form.control} name={`work_experience.${index}.endDate`} render={({ field }) => (
                    <FormItem><FormLabel>End Date</FormLabel><FormControl><Input placeholder="Present" {...field} /></FormControl><FormMessage/></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`work_experience.${index}.description`} render={({ field }) => (
                  <FormItem className="mt-3"><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Key responsibilities..." rows={3} {...field} /></FormControl><FormMessage/></FormItem>
                )} />
              </Card>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendWorkExp({ title: "", company: "", startDate: "", endDate: "", description: "" })}><Plus className="w-4 h-4 mr-1" /> Add Experience</Button>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><GraduationCap className="w-4 h-4 text-primary" /> Education</h2>
          <div className="space-y-4">
            {eduFields.map((field, index) => (
              <Card key={field.id} className="p-4 relative">
                <button type="button" onClick={() => removeEdu(index)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField control={form.control} name={`education.${index}.degree`} render={({ field }) => (
                    <FormItem><FormLabel>Degree</FormLabel><FormControl><Input placeholder="B.S. Computer Science" {...field} /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={form.control} name={`education.${index}.institution`} render={({ field }) => (
                    <FormItem><FormLabel>Institution</FormLabel><FormControl><Input placeholder="University" {...field} /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={form.control} name={`education.${index}.year`} render={({ field }) => (
                    <FormItem><FormLabel>Year</FormLabel><FormControl><Input placeholder="2020" {...field} /></FormControl><FormMessage/></FormItem>
                  )} />
                </div>
              </Card>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => appendEdu({ degree: "", institution: "", year: "" })}><Plus className="w-4 h-4 mr-1" /> Add Education</Button>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><Award className="w-4 h-4 text-primary" /> Certifications</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {(form.watch("certifications") || []).map((c, i) => (
              <Badge key={i} variant="secondary" className="gap-1">{c}
                <button type="button" onClick={() => form.setValue("certifications", form.getValues("certifications").filter((_, idx) => idx !== i), { shouldDirty: true })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCert())} placeholder="Add a certification..." className="max-w-xs" />
            <Button type="button" variant="outline" size="sm" onClick={addCert}><Plus className="w-4 h-4" /></Button>
          </div>
        </section>
      </form>
    </Form>
  );
}

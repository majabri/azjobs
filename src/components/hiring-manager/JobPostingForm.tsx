import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAgentInvocation } from "@/hooks/useAgentInvocation";
import SkillsTagInput from "./SkillsTagInput";
import JobPostingPreview from "./JobPostingPreview";

const DRAFT_KEY = "icareeros_job_posting_draft";

const BENEFITS_OPTIONS = [
  "Health Insurance",
  "Dental Insurance",
  "Vision Insurance",
  "401(k) Match",
  "Unlimited PTO",
  "Remote Work",
  "Stock Options",
  "Flexible Hours",
  "Professional Development",
  "Gym Membership",
  "Parental Leave",
  "Life Insurance",
];

export interface JobPostingFormData {
  id?: string;
  title: string;
  company: string;
  description: string;
  salaryMin: string;
  salaryMax: string;
  remoteType: string;
  skills: string[];
  experienceLevel: string;
  benefits: string[];
  location: string;
  jobType: string;
  requirements: string;
  niceToHaves: string;
}

const EMPTY_FORM: JobPostingFormData = {
  title: "",
  company: "",
  description: "",
  salaryMin: "",
  salaryMax: "",
  remoteType: "on-site",
  skills: [],
  experienceLevel: "",
  benefits: [],
  location: "",
  jobType: "full-time",
  requirements: "",
  niceToHaves: "",
};

interface Props {
  editing?: JobPostingFormData | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function JobPostingForm({ editing, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<JobPostingFormData>(editing || EMPTY_FORM);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const { invoke: generateJobPosting, loading: generating } =
    useAgentInvocation<{
      title?: string;
      description?: string;
      requirements?: string;
      nice_to_haves?: string;
      salary_suggestion_min?: number;
      salary_suggestion_max?: number;
    }>("generate-job-posting", { errorMessage: "AI generation failed" });

  // Load draft from localStorage on mount (only for new postings)
  useEffect(() => {
    if (!editing) {
      try {
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) setForm(JSON.parse(draft));
      } catch {
        /* ignore */
      }
    }
  }, [editing]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!editing) {
      const timer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [form, editing]);

  const update = useCallback(
    <K extends keyof JobPostingFormData>(
      key: K,
      val: JobPostingFormData[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  const toggleBenefit = (benefit: string) => {
    setForm((prev) => ({
      ...prev,
      benefits: prev.benefits.includes(benefit)
        ? prev.benefits.filter((b) => b !== benefit)
        : [...prev.benefits, benefit],
    }));
  };

  const validateStep1 = () => {
    if (!form.title.trim()) {
      toast.error("Job title is required");
      return false;
    }
    if (!form.company.trim()) {
      toast.error("Company name is required");
      return false;
    }
    if (!form.description.trim()) {
      toast.error("Job description is required");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleAIGenerate = async () => {
    if (!form.title.trim()) {
      toast.error("Enter a job title first");
      return;
    }
    const data = await generateJobPosting({
      title: form.title,
      company: form.company,
      department: "",
    });
    if (!data) return;
    setForm((prev) => ({
      ...prev,
      title: data.title || prev.title,
      description: data.description || prev.description,
      requirements: data.requirements || prev.requirements,
      niceToHaves: data.nice_to_haves || prev.niceToHaves,
      salaryMin: data.salary_suggestion_min
        ? String(data.salary_suggestion_min)
        : prev.salaryMin,
      salaryMax: data.salary_suggestion_max
        ? String(data.salary_suggestion_max)
        : prev.salaryMax,
    }));
    toast.success("AI generated your job posting!");
  };

  const handleSubmit = async (asDraft = false) => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in");
      setSaving(false);
      return;
    }

    const payload = {
      user_id: session.user.id,
      title: form.title,
      company: form.company,
      description: form.description,
      location: form.location || null,
      job_type: form.jobType,
      is_remote: form.remoteType === "remote",
      remote_type: form.remoteType,
      salary_min: form.salaryMin ? Number(form.salaryMin) : null,
      salary_max: form.salaryMax ? Number(form.salaryMax) : null,
      requirements: form.requirements || null,
      nice_to_haves: form.niceToHaves || null,
      experience_level: form.experienceLevel || null,
      status: asDraft ? "draft" : "active",
      updated_at: new Date().toISOString(),
    } as any;

    let error;
    if (form.id) {
      ({ error } = await supabase
        .from("job_postings")
        .update(payload)
        .eq("id", form.id));
    } else {
      ({ error } = await supabase.from("job_postings").insert(payload as any));
    }

    if (error) {
      toast.error("Failed to save posting");
    } else {
      toast.success(
        form.id
          ? "Posting updated!"
          : asDraft
            ? "Draft saved!"
            : "Posting published!",
      );
      localStorage.removeItem(DRAFT_KEY);
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form */}
      <div className="lg:col-span-3 space-y-5">
        {/* Step indicator */}
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
              step === 1
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            1. Basic Info
          </button>
          <div className="w-8 h-px bg-border" />
          <button
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
              step === 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            2. Details
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {/* AI Helper */}
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> AI Job Description
                Writer
              </p>
              <p className="text-xs text-muted-foreground">
                Enter a job title, then click generate to auto-fill the
                description
              </p>
              <Button
                onClick={handleAIGenerate}
                disabled={generating || !form.title.trim()}
                size="sm"
                className="gap-2"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generating ? "Generating..." : "Generate with AI"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Job Title *
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="Senior Software Engineer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Company *
                </label>
                <Input
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                  placeholder="Acme Inc"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Job Description *
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className="h-48 resize-none"
                placeholder="Describe the role, responsibilities, and what makes this position exciting..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Salary Min ($)
                </label>
                <Input
                  type="number"
                  value={form.salaryMin}
                  onChange={(e) => update("salaryMin", e.target.value)}
                  placeholder="80000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Salary Max ($)
                </label>
                <Input
                  type="number"
                  value={form.salaryMax}
                  onChange={(e) => update("salaryMax", e.target.value)}
                  placeholder="120000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Location
                </label>
                <Input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="New York, NY"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Job Type
                </label>
                <Select
                  value={form.jobType}
                  onValueChange={(v) => update("jobType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleNext} className="gap-2">
                Next: Details <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Remote Type
              </label>
              <Select
                value={form.remoteType}
                onValueChange={(v) => update("remoteType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-site">On-site</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Required Skills
              </label>
              <SkillsTagInput
                value={form.skills}
                onChange={(s) => update("skills", s)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Experience Level
              </label>
              <Select
                value={form.experienceLevel}
                onValueChange={(v) => update("experienceLevel", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid-Level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead / Principal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Benefits
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BENEFITS_OPTIONS.map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={form.benefits.includes(b)}
                      onCheckedChange={() => toggleBenefit(b)}
                    />
                    {b}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Requirements
              </label>
              <Textarea
                value={form.requirements}
                onChange={(e) => update("requirements", e.target.value)}
                className="h-24 resize-none"
                placeholder="- 5+ years experience with React..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Nice to Have
              </label>
              <Textarea
                value={form.niceToHaves}
                onChange={(e) => update("niceToHaves", e.target.value)}
                className="h-20 resize-none"
                placeholder="- Kubernetes experience..."
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSubmit(true)}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Draft
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {form.id ? "Update" : "Publish"} Posting
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="lg:col-span-2 hidden lg:block">
        <JobPostingPreview data={form} />
      </div>
    </div>
  );
}

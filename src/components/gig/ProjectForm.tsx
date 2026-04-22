import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import SkillsTagInput from "@/components/hiring-manager/SkillsTagInput";
import type { Project } from "./types";

interface FormData {
  id?: string;
  title: string;
  description: string;
  budgetMin: string;
  budgetMax: string;
  timelineDays: string;
  skills: string[];
  deliverables: string;
}

const EMPTY: FormData = {
  title: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
  timelineDays: "",
  skills: [],
  deliverables: "",
};

interface Props {
  editing?: Project | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function ProjectForm({ editing, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        id: editing.id,
        title: editing.title,
        description: editing.description,
        budgetMin: editing.budget_min?.toString() || "",
        budgetMax: editing.budget_max?.toString() || "",
        timelineDays: editing.timeline_days?.toString() || "",
        skills: editing.skills_required || [],
        deliverables: (editing.deliverables || []).join("\n"),
      });
    }
  }, [editing]);

  const update = useCallback(
    <K extends keyof FormData>(k: K, v: FormData[K]) => {
      setForm((prev) => ({ ...prev, [k]: v }));
    },
    [],
  );

  const validate1 = () => {
    if (!form.title.trim()) {
      toast.error("Project title is required");
      return false;
    }
    if (!form.description.trim()) {
      toast.error("Description is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (asDraft = false) => {
    if (!validate1()) {
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
      employer_id: session.user.id,
      title: form.title,
      description: form.description,
      budget_min: form.budgetMin ? Number(form.budgetMin) : 0,
      budget_max: form.budgetMax ? Number(form.budgetMax) : 0,
      timeline_days: form.timelineDays ? Number(form.timelineDays) : 0,
      skills_required: form.skills,
      deliverables: form.deliverables
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      status: asDraft ? "draft" : "open",
      updated_at: new Date().toISOString(),
    } as any;

    let error;
    if (form.id) {
      ({ error } = await supabase
        .from("projects")
        .update(payload as any)
        .eq("id", form.id));
    } else {
      ({ error } = await supabase.from("projects").insert(payload as any));
    }

    if (error) toast.error("Failed to save project");
    else {
      toast.success(form.id ? "Project updated!" : "Project posted!");
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setStep(1)}
          className={`px-3 py-1.5 rounded-full transition-colors ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          1. Project Info
        </button>
        <div className="w-8 h-px bg-border" />
        <button
          onClick={() => {
            if (validate1()) setStep(2);
          }}
          className={`px-3 py-1.5 rounded-full transition-colors ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          2. Requirements
        </button>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Project Title *
            </label>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Build a React Dashboard"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description *
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="h-40 resize-none"
              placeholder="Describe the project scope, goals, and expectations..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Budget Min ($)
              </label>
              <Input
                type="number"
                value={form.budgetMin}
                onChange={(e) => update("budgetMin", e.target.value)}
                placeholder="1000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Budget Max ($)
              </label>
              <Input
                type="number"
                value={form.budgetMax}
                onChange={(e) => update("budgetMax", e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Timeline (days)
              </label>
              <Input
                type="number"
                value={form.timelineDays}
                onChange={(e) => update("timelineDays", e.target.value)}
                placeholder="30"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (validate1()) setStep(2);
              }}
              className="gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
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
              Deliverables (one per line)
            </label>
            <Textarea
              value={form.deliverables}
              onChange={(e) => update("deliverables", e.target.value)}
              className="h-28 resize-none"
              placeholder="Responsive dashboard UI\nAPI integration\nDocumentation"
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
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{" "}
                Save Draft
              </Button>
              <Button onClick={() => handleSubmit(false)} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{" "}
                {form.id ? "Update" : "Post"} Project
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

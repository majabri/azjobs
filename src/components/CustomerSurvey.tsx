/**
 * CustomerSurvey — Public feedback survey on the landing page.
 * Collects role-specific interview questions, optional contact info, and callback preference.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Loader2,
  CheckCircle,
  User,
  Briefcase,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Role = "job_seeker" | "hiring_manager" | "both";

const JOB_SEEKER_QUESTIONS = [
  "How do you currently decide whether you are a good fit for a job before applying?",
  "Tell me about the last time you applied and got rejected—what feedback did you receive, if any?",
  "What do you do after receiving a rejection? Do you change anything in your approach?",
  "Where in the application process do you feel the most uncertainty or frustration?",
  "If you had a tool that showed exactly how you match a job and where you fall short, how would you use it?",
];

const HIRING_MANAGER_QUESTIONS = [
  "How do you currently determine whether a candidate is a good fit for a role?",
  "What does your screening process look like from application to shortlist?",
  "Where does the process break down or become inefficient?",
  "How do you handle high volumes of applicants?",
  "If you had a standardized way to compare candidates against role requirements, how would that change your workflow?",
];

const ROLE_OPTIONS: {
  value: Role;
  label: string;
  icon: typeof User;
  desc: string;
}[] = [
  {
    value: "job_seeker",
    label: "Job Seeker",
    icon: User,
    desc: "I'm looking for jobs",
  },
  {
    value: "hiring_manager",
    label: "Hiring Manager",
    icon: Briefcase,
    desc: "I hire candidates",
  },
  { value: "both", label: "Both", icon: Users, desc: "I do both" },
];

export default function CustomerSurvey() {
  const [role, setRole] = useState<Role | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsCallback, setWantsCallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const questions: string[] = [];
  if (role === "job_seeker" || role === "both")
    questions.push(...JOB_SEEKER_QUESTIONS);
  if (role === "hiring_manager" || role === "both")
    questions.push(...HIRING_MANAGER_QUESTIONS);

  const answeredCount = questions.filter(
    (q) => (answers[q] || "").trim().length > 0,
  ).length;
  const canSubmit = role && answeredCount >= 1;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const structuredAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        if ((answers[q] || "").trim()) structuredAnswers[q] = answers[q].trim();
      });

      const { error } = await supabase.from("customer_surveys").insert({
        role,
        email: email.trim() || null,
        phone: phone.trim() || null,
        wants_callback: wantsCallback,
        answers: structuredAnswers,
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success("Thank you for your feedback!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit survey. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto border-accent/30">
        <CardContent className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-2xl font-display font-bold text-primary">
            Thank You!
          </h3>
          <p className="text-muted-foreground">
            Your feedback helps us build a better platform.{" "}
            {wantsCallback && "We'll reach out to you soon!"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto border-border shadow-card">
      <CardHeader className="text-center pb-2">
        <div className="w-12 h-12 gradient-indigo rounded-xl flex items-center justify-center mx-auto mb-3 shadow-indigo-500/20">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-2xl font-display">
          Help Us Build the Perfect Tool
        </CardTitle>
        <CardDescription className="text-base">
          Tell us about your experience — your feedback shapes iCareerOS's
          future.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        {/* Step 1: Role Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">I am a…</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ROLE_OPTIONS.map((opt) => {
              const selected = role === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-accent bg-accent/10 shadow-sm"
                      : "border-border hover:border-accent/40 hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setRole(opt.value);
                    setAnswers({});
                  }}
                >
                  <opt.icon
                    className={`w-6 h-6 ${selected ? "text-accent" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${selected ? "text-accent" : "text-foreground"}`}
                  >
                    {opt.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Questions based on role */}
        {role && (
          <div className="space-y-5 animate-fade-in">
            {role === "both" && (
              <Badge variant="secondary" className="text-xs">
                Showing questions for both Job Seekers and Hiring Managers
              </Badge>
            )}

            {(role === "job_seeker" || role === "both") && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <User className="w-4 h-4" /> Job Seeker Questions
                </h4>
                {JOB_SEEKER_QUESTIONS.map((q, i) => (
                  <div key={`js-${i}`} className="space-y-1.5">
                    <Label className="text-sm text-foreground leading-snug">
                      {q}
                    </Label>
                    <Textarea
                      placeholder="Share your experience…"
                      value={answers[q] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [q]: e.target.value }))
                      }
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {(role === "hiring_manager" || role === "both") && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Hiring Manager Questions
                </h4>
                {HIRING_MANAGER_QUESTIONS.map((q, i) => (
                  <div key={`hm-${i}`} className="space-y-1.5">
                    <Label className="text-sm text-foreground leading-snug">
                      {q}
                    </Label>
                    <Textarea
                      placeholder="Share your experience…"
                      value={answers[q] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [q]: e.target.value }))
                      }
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Contact Info (optional) */}
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground font-medium">
                Contact Information (optional)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="survey-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="survey-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="survey-phone" className="text-xs">
                    Phone Number
                  </Label>
                  <Input
                    id="survey-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="callback"
                  checked={wantsCallback}
                  onCheckedChange={(v) => setWantsCallback(v === true)}
                />
                <Label htmlFor="callback" className="text-sm cursor-pointer">
                  I'd like a follow-up call to discuss my feedback
                </Label>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {answeredCount}/{questions.length} questions answered
              </span>
              <Button
                className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90"
                disabled={!canSubmit || loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                    Submitting…
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

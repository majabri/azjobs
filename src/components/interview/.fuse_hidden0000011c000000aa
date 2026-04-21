import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldAlert, Eye, CheckCircle2, XCircle, AlertTriangle, Zap } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useAgentInvocation } from "@/hooks/useAgentInvocation";

interface SimulationResult {
  ats_stage: {
    passed: boolean;
    score: number;
    keyword_matches: string[];
    missing_keywords: string[];
    formatting_issues: string[];
    rejection_reasons: string[];
  };
  recruiter_stage: {
    passed: boolean;
    score: number;
    first_impression: string;
    strengths: string[];
    red_flags: string[];
    rejection_reasons: string[];
  };
  fix_suggestions: {
    priority: string;
    area: string;
    suggestion: string;
    impact: string;
  }[];
  overall_survival_rate: number;
}

interface Props {
  resumeText?: string;
  jobDescription?: string;
  jobTitle?: string;
}

export default function RejectionSimulator({ resumeText: initialResume, jobDescription: initialJd, jobTitle }: Props) {
  const [resumeText, setResumeText] = useState(initialResume || "");
  const [jobDescription, setJobDescription] = useState(initialJd || "");
  const { invoke, loading } = useAgentInvocation<SimulationResult>("simulate-rejection", {
    errorMessage: "Simulation failed",
  });
  const [result, setResult] = useState<SimulationResult | null>(null);

  const runSimulation = async () => {
    if (!resumeText.trim() || !jobDescription.trim()) {
      toast.error("Both resume and job description are required");
      return;
    }
    const data = await invoke({ resumeText, jobDescription, jobTitle });
    if (data) setResult(data);
  };

  const priorityColor = (p: string) => {
    if (p === "critical") return "border-destructive/30 text-destructive";
    if (p === "high") return "border-warning/30 text-warning";
    return "border-border text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {!initialResume && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Resume</label>
            <Textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume..." className="h-32" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Job Description</label>
            <Textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description..." className="h-32" />
          </div>
        </div>
      )}

      <Button onClick={runSimulation} disabled={loading} className="gradient-indigo text-white">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
        {loading ? "Simulating rejection..." : "Simulate Rejection"}
      </Button>

      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Survival Rate */}
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Overall Survival Rate</span>
                <span className={`text-2xl font-display font-bold ${result.overall_survival_rate >= 60 ? "text-success" : result.overall_survival_rate >= 30 ? "text-warning" : "text-destructive"}`}>
                  {result.overall_survival_rate}%
                </span>
              </div>
              <Progress value={result.overall_survival_rate} className="h-3" />
            </CardContent>
          </Card>

          {/* ATS Stage */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent" />
                Stage 1: ATS Filter
                {result.ats_stage.passed
                  ? <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="w-3 h-3 mr-1" />PASSED</Badge>
                  : <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />REJECTED</Badge>
                }
                <span className="ml-auto text-sm text-muted-foreground">{result.ats_stage.score}%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.ats_stage.keyword_matches.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Matched Keywords</p>
                  <div className="flex flex-wrap gap-1">{result.ats_stage.keyword_matches.map(k => <Badge key={k} variant="outline" className="text-xs border-success/30 text-success">{k}</Badge>)}</div>
                </div>
              )}
              {result.ats_stage.missing_keywords.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Missing Keywords</p>
                  <div className="flex flex-wrap gap-1">{result.ats_stage.missing_keywords.map(k => <Badge key={k} variant="outline" className="text-xs border-destructive/30 text-destructive">{k}</Badge>)}</div>
                </div>
              )}
              {result.ats_stage.formatting_issues.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Formatting Issues</p>
                  <ul className="text-xs text-muted-foreground space-y-1">{result.ats_stage.formatting_issues.map((f, i) => <li key={i} className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 text-warning mt-0.5 flex-shrink-0" />{f}</li>)}</ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recruiter Stage */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4 text-accent" />
                Stage 2: Recruiter Skim (6 seconds)
                {result.recruiter_stage.passed
                  ? <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="w-3 h-3 mr-1" />PASSED</Badge>
                  : <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />REJECTED</Badge>
                }
                <span className="ml-auto text-sm text-muted-foreground">{result.recruiter_stage.score}%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground italic">"{result.recruiter_stage.first_impression}"</p>
              {result.recruiter_stage.red_flags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Red Flags</p>
                  <ul className="text-xs space-y-1">{result.recruiter_stage.red_flags.map((f, i) => <li key={i} className="flex items-start gap-1 text-destructive"><XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />{f}</li>)}</ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fix Suggestions */}
          {result.fix_suggestions.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" /> Fix These to Improve Your Chances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.fix_suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                      <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${priorityColor(s.priority)}`}>{s.priority}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.area}</p>
                        <p className="text-xs text-muted-foreground">{s.suggestion}</p>
                        <p className="text-xs text-accent mt-1">Impact: {s.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

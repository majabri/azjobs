import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Target, Copy, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ScoreReport() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (analysisId) loadReport();
  }, [analysisId]);

  const loadReport = async () => {
    try {
      const { data, error } = await supabase
        .from("analysis_history" as any)
        .select("overall_score, matched_skills, gaps, strengths, improvement_plan, job_title, company, summary, created_at")
        .eq("id", analysisId!)
        .maybeSingle() as any;

      if (error || !data) { setNotFound(true); return; }
      setReport(data);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-primary mb-2">Report Not Found</h1>
        <p className="text-muted-foreground">This score report doesn't exist or is no longer available.</p>
      </div>
    </div>
  );

  const matchedSkills = (report.matched_skills as string[]) || [];
  const gaps = (report.gaps as string[]) || [];
  const strengths = (report.strengths as string[]) || [];
  const plan = (report.improvement_plan as string[]) || [];
  const scoreColor = report.overall_score >= 75 ? "text-success" : report.overall_score >= 50 ? "text-accent" : "text-destructive";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mx-auto mb-4 ${report.overall_score >= 75 ? "border-success bg-success/10" : report.overall_score >= 50 ? "border-accent bg-accent/10" : "border-destructive bg-destructive/10"}`}>
            <span className={`font-display text-3xl font-bold ${scoreColor}`}>{report.overall_score}%</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-primary">FitCheck Score Report</h1>
          {(report.job_title || report.company) && (
            <p className="text-muted-foreground mt-1">{report.job_title}{report.company ? ` at ${report.company}` : ""}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{new Date(report.created_at).toLocaleDateString()}</p>
        </div>

        {/* Summary */}
        {report.summary && (
          <Card className="p-5">
            <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
          </Card>
        )}

        {/* Matched Skills */}
        {matchedSkills.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success" /> Matched Skills</h3>
            <div className="flex flex-wrap gap-2">
              {matchedSkills.map((s, i) => <Badge key={i} variant="secondary" className="bg-success/10 text-success border-success/20">{s}</Badge>)}
            </div>
          </Card>
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Gaps to Address</h3>
            <div className="flex flex-wrap gap-2">
              {gaps.map((g, i) => <Badge key={i} variant="outline" className="border-destructive/30 text-destructive">{g}</Badge>)}
            </div>
          </Card>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-primary mb-3">Key Strengths</h3>
            <ul className="space-y-1">
              {strengths.map((s, i) => <li key={i} className="text-sm text-foreground flex items-start gap-2"><CheckCircle className="w-3 h-3 mt-1 text-success flex-shrink-0" />{s}</li>)}
            </ul>
          </Card>
        )}

        {/* Improvement Plan */}
        {plan.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-primary mb-3">Improvement Plan</h3>
            <ol className="space-y-1 list-decimal list-inside">
              {plan.map((p, i) => <li key={i} className="text-sm text-foreground">{p}</li>)}
            </ol>
          </Card>
        )}

        {/* Share */}
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="w-4 h-4 mr-1" /> Copy Link
          </Button>
        </div>

        <div className="text-center pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">Powered by FitCheck</p>
        </div>
      </div>
    </div>
  );
}

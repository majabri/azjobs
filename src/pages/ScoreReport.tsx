import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle, XCircle, Target, Copy, Share2,
  TrendingUp, DollarSign, Zap, Award, ArrowUpRight,
} from "lucide-react";
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

  useEffect(() => {
    // Dynamic OG meta tags for sharing
    if (report) {
      const title = `iCareerOS: ${report.overall_score}% Match${report.job_title ? ` — ${report.job_title}` : ""}`;
      const desc = report.summary || `Scored ${report.overall_score}% on iCareerOS career analysis`;
      document.title = title;

      const setMeta = (prop: string, content: string) => {
        let el = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`);
        if (!el) {
          el = document.createElement("meta");
          if (prop.startsWith("og:")) el.setAttribute("property", prop);
          else el.setAttribute("name", prop);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      };

      setMeta("og:title", title);
      setMeta("og:description", desc);
      setMeta("og:type", "article");
      setMeta("og:url", window.location.href);
      setMeta("twitter:title", title);
      setMeta("twitter:description", desc);
      setMeta("twitter:card", "summary_large_image");
    }
  }, [report]);

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

  const shareReport = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `iCareerOS: ${report.overall_score}% Match`,
          text: report.summary || `I scored ${report.overall_score}% on iCareerOS`,
          url: window.location.href,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
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

  const matchedSkills = (report.matched_skills as any[]) || [];
  const matched = matchedSkills.filter((s: any) => typeof s === "object" ? s.matched : true);
  const unmatched = matchedSkills.filter((s: any) => typeof s === "object" ? !s.matched : false);
  const gaps = (report.gaps as any[]) || [];
  const strengths = (report.strengths as string[]) || [];
  const plan = (report.improvement_plan as string[]) || [];
  const scoreColor = report.overall_score >= 75 ? "text-success" : report.overall_score >= 50 ? "text-accent" : "text-destructive";
  const ringBorder = report.overall_score >= 75 ? "border-success" : report.overall_score >= 50 ? "border-accent" : "border-destructive";
  const ringBg = report.overall_score >= 75 ? "bg-success/10" : report.overall_score >= 50 ? "bg-accent/10" : "bg-destructive/10";

  // Compute interview probability estimate
  const interviewProb = Math.min(95, Math.max(5, report.overall_score * 0.8 + (strengths.length * 3)));
  const gapImpact = gaps.length > 0 ? Math.round(gaps.length * 5.5) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        {/* Header */}
        <div className="text-center">
          <Badge variant="outline" className="mb-4 text-accent border-accent/30">Career Report Card</Badge>
          <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center mx-auto mb-4 ${ringBorder} ${ringBg}`}>
            <div className="text-center">
              <span className={`font-display text-3xl font-bold ${scoreColor}`}>{report.overall_score}%</span>
              <p className="text-[10px] text-muted-foreground">FIT SCORE</p>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-primary">iCareerOS Career Report Card</h1>
          {(report.job_title || report.company) && (
            <p className="text-muted-foreground mt-1">{report.job_title}{report.company ? ` at ${report.company}` : ""}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{new Date(report.created_at).toLocaleDateString()}</p>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <Award className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="font-display font-bold text-primary text-lg">{interviewProb}%</p>
            <p className="text-[10px] text-muted-foreground">Interview Probability</p>
          </Card>
          <Card className="p-3 text-center">
            <CheckCircle className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="font-display font-bold text-primary text-lg">{matched.length}/{matchedSkills.length}</p>
            <p className="text-[10px] text-muted-foreground">Skills Matched</p>
          </Card>
          <Card className="p-3 text-center">
            <Zap className="w-4 h-4 text-warning mx-auto mb-1" />
            <p className="font-display font-bold text-primary text-lg">{gaps.length}</p>
            <p className="text-[10px] text-muted-foreground">Gaps to Fix</p>
          </Card>
        </div>

        {/* Potential Impact */}
        {gapImpact > 0 && (
          <Card className="p-4 border-accent/20 bg-accent/5">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-accent flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Fixing all gaps could increase your score by +{gapImpact}%</p>
                <p className="text-xs text-muted-foreground">Estimated interview probability: {Math.min(95, interviewProb + gapImpact)}%</p>
              </div>
            </div>
          </Card>
        )}

        {/* Summary */}
        {report.summary && (
          <Card className="p-5">
            <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
          </Card>
        )}

        {/* Matched Skills */}
        {matched.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success" /> Matched Skills</h3>
            <div className="flex flex-wrap gap-2">
              {matched.map((s: any, i: number) => (
                <Badge key={i} variant="secondary" className="bg-success/10 text-success border-success/20">
                  {typeof s === "object" ? s.skill : s}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Missing Skills */}
        {unmatched.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Missing Skills</h3>
            <div className="flex flex-wrap gap-2">
              {unmatched.map((s: any, i: number) => (
                <Badge key={i} variant="outline" className="border-destructive/30 text-destructive">
                  {typeof s === "object" ? s.skill : s}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Gaps with quantified impact */}
        {gaps.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Gaps to Address</h3>
            <div className="space-y-2">
              {gaps.map((g: any, i: number) => {
                const delta = Math.round(5 + (gaps.length - i) * 2.5);
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <span className="text-sm text-foreground">{typeof g === "object" ? g.area : g}</span>
                    <Badge variant="outline" className="text-accent border-accent/30 text-[10px]">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />+{delta}% if fixed
                    </Badge>
                  </div>
                );
              })}
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
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-accent" /> Improvement Plan</h3>
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
          <Button size="sm" className="gradient-teal text-white" onClick={shareReport}>
            <Share2 className="w-4 h-4 mr-1" /> Share Report
          </Button>
        </div>

        {/* CTA */}
        <Card className="p-5 text-center border-accent/20 bg-accent/5">
          <p className="text-sm text-foreground mb-2">Want your own Career Report Card?</p>
          <Button size="sm" className="gradient-teal text-white" onClick={() => window.location.href = "/"}>
            <Target className="w-4 h-4 mr-1" /> Get Your Free Score
          </Button>
        </Card>

        <div className="text-center pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">Powered by iCareerOS — AI Career Intelligence</p>
        </div>
      </div>
    </div>
  );
}

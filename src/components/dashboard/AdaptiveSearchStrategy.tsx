import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Target, Loader2, RefreshCw, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HelpTooltip from "@/components/HelpTooltip";
import { logger } from '@/lib/logger';

interface StrategyInsight {
  type: "improvement" | "warning" | "tip";
  title: string;
  detail: string;
}

interface StrategyData {
  totalApps: number;
  interviews: number;
  rejections: number;
  ghosted: number;
  offers: number;
  conversionRate: number;
  avgScore: number;
  weeklyTrend: "improving" | "declining" | "stable";
  insights: StrategyInsight[];
  keywordAdjustments: string[];
  toneRecommendation: string;
}

export default function AdaptiveSearchStrategy() {
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStrategy(); }, []);

  const loadStrategy = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load applications
      const { data: apps } = await supabase
        .from("job_applications")
        .select("status, applied_at, response_days, notes")
        .eq("user_id", session.user.id)
        .order("applied_at", { ascending: false });

      // Load analyses
      const { data: analyses } = await supabase.from("analysis_history")
        .select("overall_score, gaps, matched_skills, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const allApps = apps || [];
      const allAnalyses = analyses || [];

      const interviews = allApps.filter(a => a.status === "interview").length;
      const rejections = allApps.filter(a => a.status === "rejected").length;
      const offers = allApps.filter(a => a.status === "offer").length;
      const ghosted = allApps.filter(a => a.status === "applied" && a.response_days === null).length;
      const totalApps = allApps.length;
      const conversionRate = totalApps > 0 ? Math.round((interviews / totalApps) * 100) : 0;

      // Score trend
      const scores = allAnalyses.map((a) => a.overall_score as number).filter(Boolean);
      const avgScore = scores.length ? Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length) : 0;
      const recentScores = scores.slice(0, 5);
      const olderScores = scores.slice(5, 10);
      const recentAvg = recentScores.length ? recentScores.reduce((s: number, v: number) => s + v, 0) / recentScores.length : 0;
      const olderAvg = olderScores.length ? olderScores.reduce((s: number, v: number) => s + v, 0) / olderScores.length : 0;
      const weeklyTrend = recentAvg > olderAvg + 3 ? "improving" : recentAvg < olderAvg - 3 ? "declining" : "stable";

      // Generate insights from patterns
      const insights: StrategyInsight[] = [];
      
      if (totalApps > 5 && conversionRate < 15) {
        insights.push({ type: "warning", title: "Low Interview Rate", detail: `Only ${conversionRate}% of your applications get interviews. Focus on fewer, higher-match jobs rather than volume.` });
      }
      if (totalApps > 5 && conversionRate >= 25) {
        insights.push({ type: "improvement", title: "Strong Conversion", detail: `${conversionRate}% interview rate is above average. Your targeting is working well.` });
      }
      if (ghosted > totalApps * 0.5 && totalApps > 3) {
        insights.push({ type: "warning", title: "High Ghost Rate", detail: `${Math.round((ghosted / totalApps) * 100)}% of applications got no response. Try following up within 5 days and applying to smaller companies.` });
      }
      if (rejections > interviews && totalApps > 3) {
        insights.push({ type: "tip", title: "Resume Keyword Mismatch", detail: "More rejections than interviews suggests your resume isn't matching ATS keywords. Use the AI optimizer for each application." });
      }

      // Common gaps across analyses
      const gapCounts: Record<string, number> = {};
      allAnalyses.forEach((a) => {
        (Array.isArray(a.gaps) ? a.gaps : []).forEach((g: { area: string }) => {
          gapCounts[g.area] = (gapCounts[g.area] || 0) + 1;
        });
      });
      const topGaps = Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (topGaps.length > 0) {
        insights.push({ type: "tip", title: "Recurring Gaps", detail: `You're consistently missing: ${topGaps.map(([k]) => k).join(", ")}. Adding these skills or keywords to your resume could significantly improve match rates.` });
      }

      const keywordAdjustments = topGaps.map(([k]) => k);
      const toneRecommendation = conversionRate < 15 
        ? "Shift to more results-oriented language with quantified achievements" 
        : conversionRate < 30 
          ? "Good tone — add more specifics about impact and scale"
          : "Your resume tone is working well — keep the current approach";

      setStrategy({
        totalApps, interviews, rejections, ghosted, offers,
        conversionRate, avgScore, weeklyTrend, insights,
        keywordAdjustments, toneRecommendation,
      });
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-accent mr-2" />
          <span className="text-sm text-muted-foreground">Analyzing your search strategy...</span>
        </div>
      </Card>
    );
  }

  if (!strategy || strategy.totalApps < 2) return null;

  const trendIcon = strategy.weeklyTrend === "improving" ? "📈" : strategy.weeklyTrend === "declining" ? "📉" : "📊";
  const trendColor = strategy.weeklyTrend === "improving" ? "text-success" : strategy.weeklyTrend === "declining" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground flex items-center gap-1.5">Your Strategy Is {strategy.weeklyTrend === "improving" ? "Improving" : strategy.weeklyTrend === "declining" ? "Needs Work" : "Stable"} <HelpTooltip text="Tracks your job search performance week over week — conversion rates, interview success, and keyword effectiveness — and suggests adjustments." /></h3>
            <p className="text-xs text-muted-foreground">Weekly Search Strategy Update</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={loadStrategy}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <div className="bg-muted/30 rounded-lg p-3 text-center border border-border">
          <div className="text-xl font-display font-bold text-primary">{strategy.totalApps}</div>
          <div className="text-[10px] text-muted-foreground">Applied</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center border border-border">
          <div className="text-xl font-display font-bold text-success">{strategy.interviews}</div>
          <div className="text-[10px] text-muted-foreground">Interviews</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center border border-border">
          <div className="text-xl font-display font-bold text-destructive">{strategy.rejections}</div>
          <div className="text-[10px] text-muted-foreground">Rejected</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center border border-border">
          <div className="text-xl font-display font-bold text-muted-foreground">{strategy.ghosted}</div>
          <div className="text-[10px] text-muted-foreground">No Response</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center border border-border">
          <div className={`text-xl font-display font-bold ${strategy.conversionRate >= 20 ? "text-success" : strategy.conversionRate >= 10 ? "text-warning" : "text-destructive"}`}>
            {strategy.conversionRate}%
          </div>
          <div className="text-[10px] text-muted-foreground">Interview Rate</div>
        </div>
      </div>

      {/* Trend */}
      <div className={`flex items-center gap-2 mb-4 text-sm ${trendColor}`}>
        <span>{trendIcon}</span>
        <span className="font-semibold">Trend: {strategy.weeklyTrend}</span>
        <span className="text-xs text-muted-foreground">• Avg fit score: {strategy.avgScore}%</span>
      </div>

      {/* Insights */}
      {strategy.insights.length > 0 && (
        <div className="space-y-2 mb-4">
          {strategy.insights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${
              insight.type === "warning" ? "bg-destructive/5 border-destructive/20" :
              insight.type === "improvement" ? "bg-success/5 border-success/20" :
              "bg-accent/5 border-accent/20"
            }`}>
              {insight.type === "warning" ? <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" /> :
               insight.type === "improvement" ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" /> :
               <Sparkles className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />}
              <div>
                <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                <p className="text-xs text-muted-foreground">{insight.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      <div className="grid sm:grid-cols-2 gap-4">
        {strategy.keywordAdjustments.length > 0 && (
          <div className="bg-muted/20 rounded-lg p-3 border border-border">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
              <Target className="w-3 h-3 text-accent" /> Add These Keywords
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {strategy.keywordAdjustments.map(k => (
                <Badge key={k} variant="outline" className="text-xs border-accent/30 text-accent">{k}</Badge>
              ))}
            </div>
          </div>
        )}
        <div className="bg-muted/20 rounded-lg p-3 border border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-accent" /> Tone Adjustment
          </h4>
          <p className="text-xs text-muted-foreground">{strategy.toneRecommendation}</p>
        </div>
      </div>
    </Card>
  );
}

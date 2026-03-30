import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Send, Target, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HelpTooltip from "@/components/HelpTooltip";

interface Metrics {
  appsThisMonth: number;
  appsLastMonth: number;
  avgScoreTrend: number; // positive = improving
  avgScore: number;
  interviewRate: number; // % of apps that reached interview
  totalApps: number;
  totalInterviews: number;
}

export default function ProgressMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMetrics(); }, []);

  const loadMetrics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [appsRes, historyRes] = await Promise.all([
        supabase.from("job_applications").select("applied_at, status, interview_stage").eq("user_id", session.user.id),
        supabase.from("analysis_history" as any).select("overall_score, created_at").eq("user_id", session.user.id).order("created_at", { ascending: true }).limit(50) as any,
      ]);

      const apps = appsRes.data || [];
      const history = (historyRes.data || []) as { overall_score: number; created_at: string }[];

      const appsThisMonth = apps.filter(a => a.applied_at >= thisMonthStart).length;
      const appsLastMonth = apps.filter(a => a.applied_at >= lastMonthStart && a.applied_at < thisMonthStart).length;

      const interviews = apps.filter(a => a.status === "interview" || a.interview_stage);
      const interviewRate = apps.length > 0 ? Math.round((interviews.length / apps.length) * 100) : 0;

      // Score trend: compare avg of last 5 vs prev 5
      let avgScoreTrend = 0;
      let avgScore = 0;
      if (history.length > 0) {
        avgScore = Math.round(history.reduce((s, h) => s + h.overall_score, 0) / history.length);
        if (history.length >= 4) {
          const half = Math.floor(history.length / 2);
          const oldAvg = history.slice(0, half).reduce((s, h) => s + h.overall_score, 0) / half;
          const newAvg = history.slice(half).reduce((s, h) => s + h.overall_score, 0) / (history.length - half);
          avgScoreTrend = Math.round(newAvg - oldAvg);
        }
      }

      setMetrics({
        appsThisMonth,
        appsLastMonth,
        avgScoreTrend,
        avgScore,
        interviewRate,
        totalApps: apps.length,
        totalInterviews: interviews.length,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <Card className="p-6 flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-accent" /></Card>;
  if (!metrics) return null;

  const appsDelta = metrics.appsThisMonth - metrics.appsLastMonth;
  const TrendIcon = appsDelta > 0 ? TrendingUp : appsDelta < 0 ? TrendingDown : Minus;
  const trendColor = appsDelta > 0 ? "text-success" : appsDelta < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Send className="w-4 h-4 text-accent" />
          <div className={`flex items-center gap-0.5 text-xs ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {Math.abs(appsDelta)}
          </div>
        </div>
        <p className="font-display font-bold text-primary text-2xl">{metrics.appsThisMonth}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">Apps This Month <HelpTooltip text="Number of job applications you submitted this calendar month, compared to last month." /></p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Target className="w-4 h-4 text-accent" />
        </div>
        <p className="font-display font-bold text-primary text-2xl">{metrics.avgScore}%</p>
        <p className="text-xs text-muted-foreground">
          Avg Fit Score
          {metrics.avgScoreTrend !== 0 && (
            <span className={metrics.avgScoreTrend > 0 ? "text-success" : "text-destructive"}>
              {" "}({metrics.avgScoreTrend > 0 ? "+" : ""}{metrics.avgScoreTrend})
            </span>
          )}
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Award className="w-4 h-4 text-accent" />
        </div>
        <p className="font-display font-bold text-primary text-2xl">{metrics.interviewRate}%</p>
        <p className="text-xs text-muted-foreground">Interview Rate</p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <BarChart3 className="w-4 h-4 text-accent" />
        </div>
        <p className="font-display font-bold text-primary text-2xl">{metrics.totalApps}</p>
        <p className="text-xs text-muted-foreground">Total Applications</p>
      </Card>
    </div>
  );
}

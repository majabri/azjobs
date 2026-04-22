import { Card } from "@/components/ui/card";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Send,
  Target,
  Award,
} from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";
import { useJobApplications } from "@/hooks/queries/useJobApplications";
import { useAnalysisHistory } from "@/hooks/queries/useAnalysisHistory";

interface Metrics {
  appsThisMonth: number;
  appsLastMonth: number;
  avgScoreTrend: number;
  avgScore: number;
  interviewRate: number;
  totalApps: number;
  totalInterviews: number;
}

function computeMetrics(
  apps: {
    applied_at: string | null;
    status: string | null;
    interview_stage?: string | null;
  }[],
  history: { overall_score: number; created_at: string }[],
): Metrics {
  const now = new Date();
  const thisMonthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const lastMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
  ).toISOString();

  const appsThisMonth = apps.filter(
    (a) => (a.applied_at ?? "") >= thisMonthStart,
  ).length;
  const appsLastMonth = apps.filter((a) => {
    const at = a.applied_at ?? "";
    return at >= lastMonthStart && at < thisMonthStart;
  }).length;

  const interviews = apps.filter(
    (a) => a.status === "interview" || a.interview_stage,
  );
  const interviewRate =
    apps.length > 0 ? Math.round((interviews.length / apps.length) * 100) : 0;

  // Sort ascending (hook returns descending)
  const sortedHistory = [...history].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  let avgScoreTrend = 0;
  let avgScore = 0;
  if (sortedHistory.length > 0) {
    avgScore = Math.round(
      sortedHistory.reduce((s, h) => s + h.overall_score, 0) /
        sortedHistory.length,
    );
    if (sortedHistory.length >= 4) {
      const half = Math.floor(sortedHistory.length / 2);
      const oldAvg =
        sortedHistory.slice(0, half).reduce((s, h) => s + h.overall_score, 0) /
        half;
      const newAvg =
        sortedHistory.slice(half).reduce((s, h) => s + h.overall_score, 0) /
        (sortedHistory.length - half);
      avgScoreTrend = Math.round(newAvg - oldAvg);
    }
  }

  return {
    appsThisMonth,
    appsLastMonth,
    avgScoreTrend,
    avgScore,
    interviewRate,
    totalApps: apps.length,
    totalInterviews: interviews.length,
  };
}

export default function ProgressMetrics() {
  const { data: appsData = [], isLoading: appsLoading } = useJobApplications();
  const { data: historyData = [], isLoading: historyLoading } =
    useAnalysisHistory(50);

  const loading = appsLoading || historyLoading;

  if (loading)
    return (
      <Card className="p-6 flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </Card>
    );

  const metrics = computeMetrics(
    appsData.map((a) => ({
      applied_at: a.applied_at ?? null,
      status: a.status ?? null,
      interview_stage: (a as any)["interview_stage"] ?? null,
    })) as any,
    historyData.map((h) => ({
      overall_score: h.overall_score,
      created_at: h.created_at,
    })),
  );

  const appsDelta = metrics.appsThisMonth - metrics.appsLastMonth;
  const TrendIcon =
    appsDelta > 0 ? TrendingUp : appsDelta < 0 ? TrendingDown : Minus;
  const trendColor =
    appsDelta > 0
      ? "text-success"
      : appsDelta < 0
        ? "text-destructive"
        : "text-muted-foreground";

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
        <p className="font-display font-bold text-primary text-2xl">
          {metrics.appsThisMonth}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          Apps This Month{" "}
          <HelpTooltip text="Number of job applications you submitted this calendar month, compared to last month." />
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Target className="w-4 h-4 text-accent" />
        </div>
        <p className="font-display font-bold text-primary text-2xl">
          {metrics.avgScore}%
        </p>
        <p className="text-xs text-muted-foreground">
          Avg Fit Score
          {metrics.avgScoreTrend !== 0 && (
            <span
              className={
                metrics.avgScoreTrend > 0 ? "text-success" : "text-destructive"
              }
            >
              {" "}
              ({metrics.avgScoreTrend > 0 ? "+" : ""}
              {metrics.avgScoreTrend})
            </span>
          )}
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Award className="w-4 h-4 text-accent" />
        </div>
        <p className="font-display font-bold text-primary text-2xl">
          {metrics.interviewRate}%
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          Interview Rate{" "}
          <HelpTooltip text="Percentage of your applications that progressed to an interview stage." />
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <BarChart3 className="w-4 h-4 text-accent" />
        </div>
        <p className="font-display font-bold text-primary text-2xl">
          {metrics.totalApps}
        </p>
        <p className="text-xs text-muted-foreground">Total Applications</p>
      </Card>
    </div>
  );
}

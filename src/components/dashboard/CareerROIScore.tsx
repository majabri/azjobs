import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  TrendingUp,
  DollarSign,
  Award,
  Target,
  Zap,
} from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";
import { useJobApplications } from "@/hooks/queries/useJobApplications";
import { useAnalysisHistory } from "@/hooks/queries/useAnalysisHistory";
import { useOffers } from "@/hooks/queries/useOffers";

interface ROIData {
  overallROI: number;
  marketValueDelta: number;
  interviewConversionImprovement: number;
  totalCompGains: number;
  fitScoreGrowth: number;
  appsToInterview: number;
  bestOfferVsMarket: number;
  weeklyTrend: "up" | "down" | "flat";
}

function computeROI(
  apps: {
    status: string;
    interview_stage: string | null;
    applied_at: string | null;
  }[],
  history: { overall_score: number; created_at: string }[],
  offers: {
    base_salary: number | null;
    bonus: number | null;
    equity: number | null;
    total_comp: number | null;
    market_rate: number | null;
    status: string;
  }[],
): ROIData {
  // Fit score growth
  let fitScoreGrowth = 0;
  if (history.length >= 4) {
    const half = Math.floor(history.length / 2);
    const oldAvg =
      history.slice(0, half).reduce((s, h) => s + h.overall_score, 0) / half;
    const newAvg =
      history.slice(half).reduce((s, h) => s + h.overall_score, 0) /
      (history.length - half);
    fitScoreGrowth = Math.round(newAvg - oldAvg);
  }

  // Interview conversion
  const interviews = apps.filter(
    (a) => a.status === "interview" || a.interview_stage,
  );
  const interviewRate =
    apps.length > 0 ? (interviews.length / apps.length) * 100 : 0;
  const interviewConversionImprovement = Math.round(interviewRate);

  // Compensation gains
  const acceptedOffers = offers.filter((o) => o.status === "accepted");
  let totalCompGains = 0;
  let bestOfferVsMarket = 0;
  let marketValueDelta = 0;

  const offersPool = acceptedOffers.length > 0 ? acceptedOffers : offers;
  if (offersPool.length > 0) {
    let bestComp = 0;
    let bestOfferData = offersPool[0];
    for (const o of offersPool) {
      const comp =
        o.total_comp || (o.base_salary || 0) + (o.bonus || 0) + (o.equity || 0);
      if (comp > bestComp) {
        bestComp = comp;
        bestOfferData = o;
      }
    }
    totalCompGains = bestComp;
    if ((bestOfferData.market_rate || 0) > 0) {
      bestOfferVsMarket = Math.round(
        ((bestComp - (bestOfferData.market_rate || 0)) /
          (bestOfferData.market_rate || 1)) *
          100,
      );
      marketValueDelta = bestComp - (bestOfferData.market_rate || 0);
    }
  }

  // Overall ROI: weighted composite
  const scoreComponent = Math.min(100, Math.max(0, 50 + fitScoreGrowth * 2));
  const interviewComponent = Math.min(100, interviewConversionImprovement * 3);
  const compComponent =
    bestOfferVsMarket > 0 ? Math.min(100, 50 + bestOfferVsMarket * 2) : 30;
  const overallROI = Math.round(
    scoreComponent * 0.3 + interviewComponent * 0.35 + compComponent * 0.35,
  );

  // Weekly trend
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const recentScores = history.filter((h) => h.created_at >= oneWeekAgo);
  const olderScores = history.filter((h) => h.created_at < oneWeekAgo);
  let weeklyTrend: "up" | "down" | "flat" = "flat";
  if (recentScores.length > 0 && olderScores.length > 0) {
    const recentAvg =
      recentScores.reduce((s, h) => s + h.overall_score, 0) /
      recentScores.length;
    const olderAvg =
      olderScores.reduce((s, h) => s + h.overall_score, 0) / olderScores.length;
    weeklyTrend =
      recentAvg > olderAvg + 2
        ? "up"
        : recentAvg < olderAvg - 2
          ? "down"
          : "flat";
  }

  return {
    overallROI: Math.max(5, Math.min(99, overallROI)),
    marketValueDelta,
    interviewConversionImprovement,
    totalCompGains,
    fitScoreGrowth,
    appsToInterview:
      apps.length > 0
        ? Math.round(apps.length / Math.max(1, interviews.length))
        : 0,
    bestOfferVsMarket,
    weeklyTrend,
  };
}

export default function CareerROIScore() {
  const { data: apps = [], isLoading: appsLoading } = useJobApplications();
  const { data: history = [], isLoading: historyLoading } =
    useAnalysisHistory();
  const { data: offers = [], isLoading: offersLoading } = useOffers();

  const loading = appsLoading || historyLoading || offersLoading;

  if (loading)
    return (
      <Card className="p-6 flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </Card>
    );

  // Sort history ascending by created_at (useAnalysisHistory may return desc)
  const sortedHistory = [...history].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  const data = computeROI(
    apps.map((a) => ({
      status: a.status || "",
      interview_stage: (a as any)["interview_stage"] ?? null,
      applied_at: a.applied_at ?? null,
    })) as any,
    sortedHistory.map((h) => ({
      overall_score: h.overall_score,
      created_at: h.created_at,
    })),
    offers.map((o) => ({
      base_salary: o.base_salary,
      bonus: o.bonus,
      equity: o.equity,
      total_comp: o.total_comp,
      market_rate: o.market_rate,
      status: o.status,
    })),
  );

  const roiColor =
    data.overallROI >= 70
      ? "hsl(var(--success))"
      : data.overallROI >= 40
        ? "hsl(var(--accent))"
        : "hsl(var(--warning))";
  const chartData = [{ name: "ROI", value: data.overallROI, fill: roiColor }];

  return (
    <Card className="p-6 border-accent/20">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg gradient-indigo flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-display font-bold text-primary text-lg flex items-center gap-1.5">
            Career ROI Score{" "}
            <HelpTooltip text="Measures your overall career progress based on fit scores, interview rates, compensation gains, and application outcomes. Higher is better." />
          </h2>
          <p className="text-xs text-muted-foreground">
            Your measurable career progress
          </p>
        </div>
        <Badge
          variant="outline"
          className={`ml-auto ${
            data.weeklyTrend === "up"
              ? "text-success border-success/30"
              : data.weeklyTrend === "down"
                ? "text-destructive border-destructive/30"
                : "text-muted-foreground"
          }`}
        >
          {data.weeklyTrend === "up"
            ? "↑ Trending Up"
            : data.weeklyTrend === "down"
              ? "↓ Trending Down"
              : "→ Stable"}
        </Badge>
      </div>

      <div className="flex items-center gap-6">
        {/* Radial chart */}
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              data={chartData}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background={{ fill: "hsl(var(--muted))" }}
                dataKey="value"
                cornerRadius={8}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="relative -mt-[85px] text-center">
            <span
              className="font-display text-3xl font-bold"
              style={{ color: roiColor }}
            >
              {data.overallROI}
            </span>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          <MetricPill
            icon={<TrendingUp className="w-3.5 h-3.5 text-accent" />}
            label="Fit Score Growth"
            value={`${data.fitScoreGrowth > 0 ? "+" : ""}${data.fitScoreGrowth}%`}
            positive={data.fitScoreGrowth > 0}
          />
          <MetricPill
            icon={<Award className="w-3.5 h-3.5 text-accent" />}
            label="Interview Rate"
            value={`${data.interviewConversionImprovement}%`}
            positive={data.interviewConversionImprovement > 15}
          />
          <MetricPill
            icon={<DollarSign className="w-3.5 h-3.5 text-accent" />}
            label="Comp vs Market"
            value={
              data.bestOfferVsMarket !== 0
                ? `${data.bestOfferVsMarket > 0 ? "+" : ""}${data.bestOfferVsMarket}%`
                : "—"
            }
            positive={data.bestOfferVsMarket > 0}
          />
          <MetricPill
            icon={<Target className="w-3.5 h-3.5 text-accent" />}
            label="Apps per Interview"
            value={data.appsToInterview > 0 ? `${data.appsToInterview}` : "—"}
            positive={data.appsToInterview > 0 && data.appsToInterview <= 5}
          />
        </div>
      </div>

      {data.totalCompGains > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/20 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-success" />
          <div>
            <p className="text-xs text-muted-foreground">
              Best Offer Total Compensation
            </p>
            <p className="font-display font-bold text-success text-lg">
              ${data.totalCompGains.toLocaleString()}
            </p>
          </div>
          {data.marketValueDelta > 0 && (
            <Badge className="ml-auto bg-success/10 text-success border-success/20">
              +${data.marketValueDelta.toLocaleString()} vs market
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}

function MetricPill({
  icon,
  label,
  value,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
      {icon}
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p
          className={`text-sm font-bold ${positive ? "text-success" : "text-foreground"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  TrendingUp,
  Search,
  Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface AgentRun {
  id: string;
  user_id: string;
  status: string;
  agents_completed: string[];
  agent_timings: Record<string, number>;
  jobs_found: number;
  jobs_matched: number;
  applications_sent: number;
  errors: string[];
  started_at: string;
  completed_at: string | null;
}

interface AgentStat {
  agent: string;
  label: string;
  runs: number;
  successes: number;
  failures: number;
  avgTime: number;
}

const AGENT_META: { key: string; label: string }[] = [
  { key: "discovery", label: "Job Discovery" },
  { key: "matching", label: "Match & Score" },
  { key: "optimization", label: "Resume Optimizer" },
  { key: "application", label: "Application Agent" },
  { key: "learning", label: "Learning Engine" },
];

export default function AdminAgents() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const { data } = await supabase
        .from("agent_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      const all: AgentRun[] = (data as unknown as AgentRun[]) || [];
      setRuns(all);

      const agentStats: AgentStat[] = AGENT_META.map(({ key, label }) => {
        let runs = 0,
          successes = 0,
          failures = 0,
          totalTime = 0;
        for (const run of all) {
          const completed = (run.agents_completed as string[]) || [];
          const timings = (run.agent_timings as Record<string, number>) || {};
          const errs = (run.errors as string[]) || [];
          if (completed.includes(key) || timings[key] != null) {
            runs++;
            if (errs.some((e) => e.toLowerCase().includes(key))) failures++;
            else successes++;
            if (timings[key]) totalTime += timings[key];
          }
        }
        return {
          agent: key,
          label,
          runs,
          successes,
          failures,
          avgTime: runs > 0 ? Math.round(totalTime / runs) : 0,
        };
      });
      setStats(agentStats);
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalRuns = runs.length;
  const successRuns = runs.filter((r) => r.status === "completed").length;
  const failedRuns = runs.filter(
    (r) => r.status === "failed" || r.status === "completed_with_errors",
  ).length;
  const successRate =
    totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Agent Monitoring
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Platform-wide agent run history and performance
          </p>
        </div>
        <Button variant="outline" onClick={load} size="sm">
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Runs"
          value={totalRuns}
          icon={<Bot className="w-4 h-4" />}
        />
        <SummaryCard
          label="Successful"
          value={successRuns}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="text-success"
        />
        <SummaryCard
          label="Failed"
          value={failedRuns}
          icon={<XCircle className="w-4 h-4" />}
          color={failedRuns > 0 ? "text-destructive" : "text-foreground"}
        />
        <SummaryCard
          label="Success Rate"
          value={`${successRate}%`}
          icon={<TrendingUp className="w-4 h-4" />}
          color={
            successRate >= 80
              ? "text-success"
              : successRate >= 50
                ? "text-warning"
                : "text-destructive"
          }
        />
      </div>

      {/* Per-Agent Health */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" /> Agent Performance (Last
            50 Runs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {stats.map((s) => {
              const rate =
                s.runs > 0 ? Math.round((s.successes / s.runs) * 100) : 0;
              const color =
                rate >= 80
                  ? "text-success"
                  : rate >= 50
                    ? "text-warning"
                    : "text-destructive";
              return (
                <div
                  key={s.agent}
                  className="text-center p-3 rounded-lg border border-border bg-muted/20"
                >
                  <p className="text-xs font-medium text-foreground mb-1">
                    {s.label}
                  </p>
                  <p className={`font-display font-bold text-xl ${color}`}>
                    {rate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.runs} runs
                  </p>
                  {s.avgTime > 0 && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      avg{" "}
                      {s.avgTime < 1000
                        ? `${s.avgTime}ms`
                        : `${(s.avgTime / 1000).toFixed(1)}s`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Run Log */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" /> Run History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-2">
                    {run.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    ) : run.status === "completed_with_errors" ? (
                      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                    ) : run.status === "running" ? (
                      <Clock className="w-4 h-4 animate-spin text-accent flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-3 text-xs font-medium text-foreground">
                        <span className="flex items-center gap-1">
                          <Search className="w-3 h-3" /> {run.jobs_found}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {run.jobs_matched}
                        </span>
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />{" "}
                          {run.applications_sent}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(run.started_at).toLocaleString()} · user:{" "}
                        {run.user_id.slice(0, 8)}…
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(run.errors as string[])?.length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-destructive border-destructive/30 text-[10px]"
                      >
                        {(run.errors as string[]).length} errors
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        run.status === "completed"
                          ? "text-success border-success/30"
                          : run.status === "failed"
                            ? "text-destructive border-destructive/30"
                            : "text-warning border-warning/30"
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon} {label}
      </div>
      <div
        className={`text-2xl font-display font-bold ${color || "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

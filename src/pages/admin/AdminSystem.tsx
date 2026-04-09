import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Database,
  Bot,
  BarChart3,
  Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SystemCheck {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

interface ErrorLogEntry {
  id: string;
  user_id: string;
  started_at: string;
  status: string;
  errors: string[];
}

export default function AdminSystem() {
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    users: 0,
    analyses: 0,
    applications: 0,
    agentRuns: 0,
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [profilesRes, analysesRes, applicationsRes, agentRunsRes, queueRes] =
        await Promise.all([
          supabase
            .from("job_seeker_profiles")
            .select("user_id", { count: "exact", head: true }),
          supabase
            .from("analysis_history" as any)
            .select("id", { count: "exact", head: true }),
          supabase
            .from("job_applications")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("agent_runs" as any)
            .select("id, user_id, status, errors, started_at")
            .order("started_at", { ascending: false })
            .limit(100) as any,
          (supabase as any).from("job_queue").select("id, status"),
        ]);

      const allRuns: ErrorLogEntry[] = (agentRunsRes.data || []) as ErrorLogEntry[];
      const failedRuns = allRuns.filter(
        (r) => r.status === "failed" || r.status === "completed_with_errors"
      );
      const recentFailed = allRuns.filter((r) => {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        return (
          (r.status === "failed" || r.status === "completed_with_errors") &&
          r.started_at > hourAgo
        );
      });

      setCounts({
        users: profilesRes.count ?? 0,
        analyses: (analysesRes as any).count ?? 0,
        applications: applicationsRes.count ?? 0,
        agentRuns: allRuns.length,
      });

      setChecks([
        {
          name: "Database: job_seeker_profiles",
          status: profilesRes.error ? "error" : "ok",
          detail: profilesRes.error
            ? profilesRes.error.message
            : `${profilesRes.count ?? 0} records`,
        },
        {
          name: "Database: analysis_history",
          status: (analysesRes as any).error ? "error" : "ok",
          detail: (analysesRes as any).error
            ? (analysesRes as any).error.message
            : `${(analysesRes as any).count ?? 0} records`,
        },
        {
          name: "Database: job_applications",
          status: applicationsRes.error ? "error" : "ok",
          detail: applicationsRes.error
            ? applicationsRes.error.message
            : `${applicationsRes.count ?? 0} records`,
        },
        {
          name: "Agent System",
          status: agentRunsRes.error
            ? "error"
            : recentFailed.length > 5
            ? "warn"
            : "ok",
          detail: agentRunsRes.error
            ? agentRunsRes.error.message
            : `${recentFailed.length} failures in last 1h`,
        },
        {
          name: "Error Rate (recent 100 runs)",
          status:
            failedRuns.length === 0
              ? "ok"
              : failedRuns.length < 10
              ? "warn"
              : "error",
          detail: `${failedRuns.length} failed out of ${allRuns.length} runs (${
            allRuns.length > 0
              ? Math.round((failedRuns.length / allRuns.length) * 100)
              : 0
          }%)`,
        },
        {
          name: "Queue Health",
          status: queueRes.error ? "error" : "ok",
          detail: queueRes.error
            ? queueRes.error.message
            : `${
                (queueRes.data || []).filter((j: any) => j.status === "pending")
                  .length
              } pending, ${
                (queueRes.data || []).filter((j: any) => j.status === "running")
                  .length
              } running, ${
                (queueRes.data || []).filter((j: any) => j.status === "failed")
                  .length
              } failed`,
        },
        {
          name: "API Status",
          status: "ok",
          detail: `Operational · ${new Date().toLocaleTimeString()}`,
        },
        {
          name: "Last Error Timestamp",
          status: failedRuns.length === 0 ? "ok" : "warn",
          detail:
            failedRuns.length > 0
              ? `Last failure: ${new Date(failedRuns[0].started_at).toLocaleString()}`
              : "No recent failures",
        },
      ]);

      setErrorLogs(failedRuns.slice(0, 20));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load system health data");
    } finally {
      setLoading(false);
    }
  };

  const overallStatus = checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warn")
    ? "warn"
    : "ok";

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
            System Health
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Database status, error logs, and platform diagnostics
          </p>
        </div>
        <Button variant="outline" onClick={load} size="sm">
          Refresh
        </Button>
      </div>

      {/* Overall Status Banner */}
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border ${
          overallStatus === "ok"
            ? "bg-success/5 border-success/20"
            : overallStatus === "warn"
            ? "bg-warning/5 border-warning/20"
            : "bg-destructive/5 border-destructive/20"
        }`}
      >
        {overallStatus === "ok" ? (
          <CheckCircle2 className="w-5 h-5 text-success" />
        ) : overallStatus === "warn" ? (
          <AlertTriangle className="w-5 h-5 text-warning" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive" />
        )}
        <div>
          <p className="font-semibold text-foreground text-sm">
            {overallStatus === "ok"
              ? "All Systems Operational"
              : overallStatus === "warn"
              ? "Some Warnings Detected"
              : "System Issues Detected"}
          </p>
          <p className="text-xs text-muted-foreground">
            Last checked: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* DB Record Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <CountCard
          icon={<Activity className="w-4 h-4" />}
          label="Users"
          value={counts.users}
        />
        <CountCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Analyses"
          value={counts.analyses}
        />
        <CountCard
          icon={<Briefcase className="w-4 h-4" />}
          label="Applications"
          value={counts.applications}
        />
        <CountCard
          icon={<Bot className="w-4 h-4" />}
          label="Agent Runs"
          value={counts.agentRuns}
        />
      </div>

      {/* System Checks */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-accent" />
            System Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checks.map((check) => (
              <div
                key={check.name}
                className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border"
              >
                <div className="flex items-center gap-2">
                  {check.status === "ok" ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  ) : check.status === "warn" ? (
                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {check.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {check.detail}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    check.status === "ok"
                      ? "text-success border-success/30"
                      : check.status === "warn"
                      ? "text-warning border-warning/30"
                      : "text-destructive border-destructive/30"
                  }
                >
                  {check.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Logs */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-destructive" />
            Error Log (Failed Agent Runs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errorLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success opacity-60" />
              <p className="text-sm">No errors found — all good!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {errorLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-xs font-medium text-foreground">
                        Run failed · user: {log.user_id.slice(0, 8)}…
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.started_at).toLocaleString()}
                    </span>
                  </div>
                  {(log.errors as string[])?.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {(log.errors as string[]).map((err, i) => (
                        <p
                          key={i}
                          className="text-[10px] text-destructive font-mono bg-destructive/5 px-2 py-0.5 rounded"
                        >
                          {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CountCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-display font-bold text-foreground">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

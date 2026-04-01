import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Bot, ArrowLeft, RefreshCw, StopCircle, Clock, CheckCircle2,
  XCircle, AlertTriangle, ScrollText, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgentRunDetail {
  id: string;
  user_id: string;
  status: string;
  jobs_found: number;
  jobs_matched: number;
  applications_sent: number;
  started_at: string;
  completed_at: string | null;
  errors: string[];
}

interface RelatedLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  user_id: string | null;
  run_id: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  completed: { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-success border-success/30" },
  failed: { icon: <XCircle className="w-4 h-4" />, color: "text-destructive border-destructive/30" },
  running: { icon: <Clock className="w-4 h-4 animate-spin" />, color: "text-accent border-accent/30" },
  pending: { icon: <Clock className="w-4 h-4" />, color: "text-muted-foreground border-border" },
  completed_with_errors: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-yellow-400 border-yellow-400/30" },
  cancelled: { icon: <StopCircle className="w-4 h-4" />, color: "text-muted-foreground border-border" },
};

const LEVEL_COLOR: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

function duration(start: string, end: string | null) {
  if (!end) return "Still running";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default function AdminAgentRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<AgentRunDetail | null>(null);
  const [logs, setLogs] = useState<RelatedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const [runRes, logsRes] = await Promise.all([
        (supabase as any)
          .from("agent_runs")
          .select("*")
          .eq("id", runId)
          .single(),
        (supabase as any)
          .from("admin_logs")
          .select("*")
          .eq("run_id", runId)
          .order("timestamp", { ascending: true })
          .limit(100),
      ]);
      if (runRes.data) setRun(runRes.data);
      setLogs(logsRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  const retryRun = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("agent_runs")
        .update({ status: "pending", errors: [], completed_at: null })
        .eq("id", run.id);
      if (error) throw error;
      toast.success("Run queued for retry");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to retry run");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelRun = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("agent_runs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", run.id);
      if (error) throw error;
      toast.success("Run cancelled");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to cancel run");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center py-20 text-muted-foreground">
          <XCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Run not found</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate("/admin/agent-runs")}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Agent Runs
          </Button>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const isFailed = run.status === "failed" || run.status === "completed_with_errors";
  const isRunning = run.status === "running";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/agent-runs")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
              <Bot className="w-5 h-5 text-accent" />
              Run Detail
              <span className="text-muted-foreground font-mono text-sm font-normal">
                {run.id.slice(0, 16)}…
              </span>
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              Started {new Date(run.started_at).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={actionLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          {isFailed && (
            <Button size="sm" onClick={retryRun} disabled={actionLoading}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Run
            </Button>
          )}
          {isRunning && (
            <Button size="sm" variant="destructive" onClick={cancelRun} disabled={actionLoading}>
              <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel Run
            </Button>
          )}
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
          <div className="mt-2">
            <Badge variant="outline" className={`gap-1.5 ${cfg.color}`}>
              {cfg.icon} {run.status}
            </Badge>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <Label className="text-[10px] uppercase text-muted-foreground">Duration</Label>
          <p className="mt-2 font-mono text-sm font-medium">{duration(run.started_at, run.completed_at)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <Label className="text-[10px] uppercase text-muted-foreground">User ID</Label>
          <p className="mt-2 font-mono text-xs text-muted-foreground truncate" title={run.user_id}>
            {run.user_id}
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <Label className="text-[10px] uppercase text-muted-foreground">Completed</Label>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {run.completed_at ? new Date(run.completed_at).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      {/* Output metrics */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Output / Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-lg p-4 text-center border border-border">
              <div className="text-3xl font-display font-bold text-foreground">{run.jobs_found}</div>
              <div className="text-xs text-muted-foreground mt-1">Jobs Found</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center border border-border">
              <div className="text-3xl font-display font-bold text-foreground">{run.jobs_matched}</div>
              <div className="text-xs text-muted-foreground mt-1">Jobs Matched</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center border border-border">
              <div className="text-3xl font-display font-bold text-foreground">{run.applications_sent}</div>
              <div className="text-xs text-muted-foreground mt-1">Applications Sent</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {run.errors?.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <XCircle className="w-4 h-4" /> Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-xs">
              {run.errors.map((err, i) => (
                <div key={i} className="bg-destructive/10 text-destructive border border-destructive/20 rounded px-3 py-2">
                  {err}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input payload */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Input Payload</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted/30 rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-auto max-h-48">
            {JSON.stringify(
              {
                user_id: run.user_id,
                status: run.status,
                started_at: run.started_at,
              },
              null,
              2,
            )}
          </pre>
        </CardContent>
      </Card>

      {/* Linked logs */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-accent" /> Linked Logs ({logs.length})
            </CardTitle>
            <Link
              to={`/admin/logs?run_id=${run.id}`}
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Open in Logs
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ScrollText className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No linked logs for this run</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto font-mono text-xs">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 px-4 py-2 border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <span className="text-muted-foreground text-[10px] w-[140px] shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className={`uppercase text-[10px] font-bold w-10 shrink-0 ${LEVEL_COLOR[log.level] ?? "text-muted-foreground"}`}>
                    {log.level}
                  </span>
                  <span className="flex-1 text-foreground leading-relaxed">{log.message}</span>
                  {log.status && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        log.status === "success"
                          ? "text-success border-success/30"
                          : "text-destructive border-destructive/30"
                      }`}
                    >
                      {log.status}
                    </Badge>
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

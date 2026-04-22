import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bot,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Eye,
  StopCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgentRun {
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

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> =
  {
    completed: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      color: "text-success border-success/30",
    },
    failed: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      color: "text-destructive border-destructive/30",
    },
    running: {
      icon: <Clock className="w-3.5 h-3.5 animate-spin" />,
      color: "text-accent border-accent/30",
    },
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      color: "text-muted-foreground border-border",
    },
    completed_with_errors: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: "text-warning border-warning/30",
    },
  };

function duration(start: string, end: string | null) {
  if (!end) return "–";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default function AdminAgentRuns() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [manualJobDesc, setManualJobDesc] = useState("");
  const [manualRunning, setManualRunning] = useState(false);
  const [manualResult, setManualResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("agent_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    setRuns((data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh running runs
  useEffect(() => {
    const hasRunning = runs.some(
      (r) => r.status === "running" || r.status === "pending",
    );
    if (!hasRunning) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [runs, load]);

  const retryRun = async (runId: string) => {
    const { error } = await supabase
      .from("agent_runs")
      .update({ status: "pending", errors: [], completed_at: null })
      .eq("id", runId);
    if (error) {
      toast.error("Failed to retry run");
    } else {
      toast.success("Run queued for retry");
      load();
    }
  };

  const cancelRun = async (runId: string) => {
    const { error } = await supabase
      .from("agent_runs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", runId);
    if (error) {
      toast.error("Failed to cancel run");
    } else {
      toast.success("Run cancelled");
      load();
    }
  };

  const runManual = async () => {
    if (!manualJobDesc.trim()) return;
    setManualRunning(true);
    setManualResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "agent-orchestrator",
        {
          body: { job_description: manualJobDesc },
        },
      );
      if (error) throw error;
      setManualResult(data);
      toast.success("Agent run completed");
      load();
    } catch (e: any) {
      setManualResult({ error: e.message });
      toast.error("Agent run failed");
    } finally {
      setManualRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-accent" /> Agent Runs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor and control agent run executions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowManual(true)}>
            <Play className="w-3.5 h-3.5 mr-1.5" /> Run Agent Manually
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["completed", "running", "failed", "pending"] as const).map(
          (status) => {
            const count = runs.filter((r) =>
              status === "failed"
                ? r.status === "failed" || r.status === "completed_with_errors"
                : r.status === status,
            ).length;
            const cfg = STATUS_CONFIG[status];
            return (
              <div
                key={status}
                className="bg-card rounded-xl p-4 border border-border shadow-sm"
              >
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <span className={cfg.color.split(" ")[0]}>{cfg.icon}</span>
                  <span className="capitalize">{status}</span>
                </div>
                <div className="text-2xl font-display font-bold text-foreground">
                  {count}
                </div>
              </div>
            );
          },
        )}
      </div>

      {/* Runs Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Recent Runs ({runs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Run ID
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Duration
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Jobs
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Created
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const cfg =
                    STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
                  return (
                    <tr
                      key={run.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {run.id.slice(0, 12)}…
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {run.user_id?.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={`gap-1 ${cfg.color}`}
                        >
                          {cfg.icon} {run.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {duration(run.started_at, run.completed_at)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {run.jobs_found}f / {run.jobs_matched}m /{" "}
                        {run.applications_sent}a
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(run.started_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-1.5"
                            onClick={() => setSelectedRun(run)}
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-1.5 text-muted-foreground"
                            onClick={() =>
                              navigate(`/admin/agent-runs/${run.id}`)
                            }
                          >
                            <ExternalLink className="w-3 h-3 mr-1" /> Details
                          </Button>
                          {(run.status === "failed" ||
                            run.status === "completed_with_errors") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-1.5 text-accent"
                              onClick={() => retryRun(run.id)}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" /> Retry
                            </Button>
                          )}
                          {run.status === "running" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-1.5 text-destructive"
                              onClick={() => cancelRun(run.id)}
                            >
                              <StopCircle className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Run Details Dialog */}
      {selectedRun && (
        <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Bot className="w-4 h-4" /> Run Details —{" "}
                {selectedRun.id.slice(0, 12)}…
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-[10px] uppercase">
                    Status
                  </Label>
                  <Badge
                    variant="outline"
                    className={`mt-1 gap-1 ${(STATUS_CONFIG[selectedRun.status] || STATUS_CONFIG.pending).color}`}
                  >
                    {selectedRun.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-[10px] uppercase">
                    Duration
                  </Label>
                  <p className="mt-1 font-mono">
                    {duration(selectedRun.started_at, selectedRun.completed_at)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-[10px] uppercase">
                    Started
                  </Label>
                  <p className="mt-1 font-mono">
                    {new Date(selectedRun.started_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-[10px] uppercase">
                    User ID
                  </Label>
                  <p className="mt-1 font-mono">{selectedRun.user_id}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded p-2 text-center">
                  <div className="text-lg font-bold">
                    {selectedRun.jobs_found}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Jobs Found
                  </div>
                </div>
                <div className="bg-muted/30 rounded p-2 text-center">
                  <div className="text-lg font-bold">
                    {selectedRun.jobs_matched}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Matched
                  </div>
                </div>
                <div className="bg-muted/30 rounded p-2 text-center">
                  <div className="text-lg font-bold">
                    {selectedRun.applications_sent}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Applied
                  </div>
                </div>
              </div>
              {selectedRun.errors?.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-[10px] uppercase">
                    Errors
                  </Label>
                  <div className="mt-1 space-y-1 font-mono">
                    {selectedRun.errors.map((e, i) => (
                      <p
                        key={i}
                        className="text-destructive bg-destructive/10 px-2 py-1 rounded text-[10px]"
                      >
                        {e}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                {(selectedRun.status === "failed" ||
                  selectedRun.status === "completed_with_errors") && (
                  <Button
                    size="sm"
                    onClick={() => {
                      retryRun(selectedRun.id);
                      setSelectedRun(null);
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Run
                  </Button>
                )}
                {selectedRun.status === "running" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      cancelRun(selectedRun.id);
                      setSelectedRun(null);
                    }}
                  >
                    <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel Run
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Run Dialog */}
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Play className="w-4 h-4 text-accent" /> Run Agent Manually
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Job Description</Label>
              <Textarea
                placeholder="Describe the job or what you want the agent to do..."
                value={manualJobDesc}
                onChange={(e) => setManualJobDesc(e.target.value)}
                rows={4}
                className="mt-1.5 font-mono text-xs"
              />
            </div>
            <Button
              onClick={runManual}
              disabled={manualRunning || !manualJobDesc.trim()}
              className="w-full"
            >
              {manualRunning ? (
                <>
                  <Clock className="w-3.5 h-3.5 mr-2 animate-spin" /> Running…
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-2" /> Execute Agent Run
                </>
              )}
            </Button>
            {manualResult && (
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Output
                </Label>
                <pre className="mt-1 bg-muted/30 rounded p-3 text-xs font-mono overflow-auto max-h-60 text-foreground">
                  {JSON.stringify(manualResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

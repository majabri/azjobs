import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  StopCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QueueJob {
  id: string;
  job_id: string;
  type: string;
  status: "pending" | "running" | "failed" | "completed" | "cancelled";
  user_id: string | null;
  payload: Record<string, unknown>;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: "Pending",
    color: "text-muted-foreground border-border",
  },
  running: {
    icon: <Clock className="w-3.5 h-3.5 animate-spin" />,
    label: "Running",
    color: "text-accent border-accent/30",
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: "Failed",
    color: "text-destructive border-destructive/30",
  },
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: "Completed",
    color: "text-success border-success/30",
  },
  cancelled: {
    icon: <StopCircle className="w-3.5 h-3.5" />,
    label: "Cancelled",
    color: "text-muted-foreground border-border",
  },
};

function JobCard({
  job,
  onRetry,
  onCancel,
}: {
  job: QueueJob;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  return (
    <div className="p-3 bg-card border border-border rounded-lg hover:bg-muted/10 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cfg.color.split(" ")[0]}>{cfg.icon}</span>
          <div>
            <p className="text-xs font-medium text-foreground font-mono">
              {job.job_id.slice(0, 14)}…
            </p>
            <p className="text-[10px] text-muted-foreground">{job.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
            {cfg.label}
          </Badge>
          {job.status === "failed" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-1.5 text-accent"
              onClick={onRetry}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          )}
          {job.status === "running" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-1.5 text-destructive"
              onClick={onCancel}
            >
              <StopCircle className="w-3 h-3 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>
      {job.error && (
        <p className="mt-2 text-[10px] font-mono text-destructive bg-destructive/5 px-2 py-1 rounded">
          {job.error}
        </p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        {new Date(job.created_at).toLocaleString()}
        {job.user_id && ` · user:${job.user_id.slice(0, 8)}…`}
      </p>
    </div>
  );
}

export default function AdminQueue() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("job_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setJobs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh if there are running jobs
  useEffect(() => {
    const hasActive = jobs.some(
      (j) => j.status === "running" || j.status === "pending",
    );
    if (!hasActive) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [jobs, load]);

  const retryJob = async (id: string) => {
    await supabase
      .from("job_queue")
      .update({ status: "pending", error: null, started_at: null })
      .eq("id", id);
    toast.success("Job queued for retry");
    load();
  };

  const cancelJob = async (id: string) => {
    await supabase
      .from("job_queue")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Job cancelled");
    load();
  };

  const clearQueue = async (statuses: string[]) => {
    const { error } = await supabase
      .from("job_queue")
      .delete()
      .in("status", statuses);
    if (error) {
      toast.error("Failed to clear queue");
    } else {
      toast.success(`Cleared ${statuses.join(", ")} jobs`);
      load();
    }
  };

  const pending = jobs.filter((j) => j.status === "pending");
  const running = jobs.filter((j) => j.status === "running");
  const failed = jobs.filter((j) => j.status === "failed");

  // Compute avg wait time for completed jobs (time from created_at to started_at)
  const completedJobs = jobs.filter(
    (j) => j.status === "completed" && j.started_at && j.created_at,
  );
  const avgWaitMs =
    completedJobs.length > 0
      ? completedJobs.reduce((sum, j) => {
          return (
            sum +
            (new Date(j.started_at!).getTime() -
              new Date(j.created_at).getTime())
          );
        }, 0) / completedJobs.length
      : null;

  function formatWaitTime(ms: number | null): string {
    if (ms === null) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

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
            <Layers className="w-6 h-6 text-accent" /> Queue & Job Visibility
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor and manage the job processing queue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => clearQueue(["pending", "failed"])}
            disabled={pending.length === 0 && failed.length === 0}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear Queue (Admin)
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Clock className="w-4 h-4" /> Pending
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {pending.length}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-accent/30">
          <div className="flex items-center gap-2 text-accent text-xs mb-1">
            <Clock className="w-4 h-4 animate-spin" /> Running
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {running.length}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-destructive/20">
          <div className="flex items-center gap-2 text-destructive text-xs mb-1">
            <XCircle className="w-4 h-4" /> Failed
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {failed.length}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Clock className="w-4 h-4" /> Avg Wait Time
          </div>
          <div className="text-xl font-display font-bold text-foreground">
            {formatWaitTime(avgWaitMs)}
          </div>
          {completedJobs.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              from {completedJobs.length} completed jobs
            </div>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card className="border-border">
          <CardContent className="text-center py-12 text-muted-foreground">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Queue is empty</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Pending
                  <Badge variant="outline" className="text-[10px]">
                    {pending.length}
                  </Badge>
                </span>
                {pending.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => clearQueue(["pending"])}
                  >
                    Clear
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {pending.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No pending jobs
                </p>
              ) : (
                pending.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    onRetry={() => retryJob(j.id)}
                    onCancel={() => cancelJob(j.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Running */}
          <Card className="border-accent/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent animate-spin" /> Running
                <Badge
                  variant="outline"
                  className="text-[10px] text-accent border-accent/30"
                >
                  {running.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {running.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No running jobs
                </p>
              ) : (
                running.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    onRetry={() => retryJob(j.id)}
                    onCancel={() => cancelJob(j.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Failed */}
          <Card className="border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> Failed
                  <Badge
                    variant="outline"
                    className="text-[10px] text-destructive border-destructive/30"
                  >
                    {failed.length}
                  </Badge>
                </span>
                {failed.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-destructive"
                    onClick={() => clearQueue(["failed"])}
                  >
                    Clear All
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {failed.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No failed jobs
                </p>
              ) : (
                failed.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    onRetry={() => retryJob(j.id)}
                    onCancel={() => cancelJob(j.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

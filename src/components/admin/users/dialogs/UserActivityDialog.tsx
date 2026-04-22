import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function UserActivityDialog({
  userId,
  userName,
  open,
  onClose,
}: {
  userId: string;
  userName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [agentRuns, setAgentRuns] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("agent_runs")
        .select("id, status, started_at, jobs_found, jobs_matched")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("analysis_history")
        .select("id, created_at, score")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("job_applications")
        .select("id, title, company, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]).then(([runs, analyses, apps]) => {
      setAgentRuns(runs.data || []);
      setAnalyses(analyses.data || []);
      setApplications(apps.data || []);
      setLoading(false);
    });
  }, [userId, open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-accent" /> Activity History —{" "}
            {userName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Clock className="w-5 h-5 animate-spin text-accent" />
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Agent Runs */}
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px] mb-2">
                Agent Runs ({agentRuns.length})
              </p>
              {agentRuns.length === 0 ? (
                <p className="text-muted-foreground">No runs</p>
              ) : (
                agentRuns.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <span className="font-mono text-muted-foreground">
                      {r.id.slice(0, 10)}…
                    </span>
                    <span
                      className={
                        r.status === "completed"
                          ? "text-success"
                          : r.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {r.status}
                    </span>
                    <span>
                      {r.jobs_found}f/{r.jobs_matched}m
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(r.started_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
            {/* Analyses */}
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px] mb-2">
                Analyses ({analyses.length})
              </p>
              {analyses.length === 0 ? (
                <p className="text-muted-foreground">No analyses</p>
              ) : (
                analyses.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <span className="font-mono text-muted-foreground">
                      {a.id.slice(0, 10)}…
                    </span>
                    <span className="text-accent">
                      {a.score != null ? `Score: ${a.score}` : "—"}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
            {/* Applications */}
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px] mb-2">
                Applications ({applications.length})
              </p>
              {applications.length === 0 ? (
                <p className="text-muted-foreground">No applications</p>
              ) : (
                applications.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <span className="truncate max-w-[160px]">
                      {a.title || "Untitled"} @ {a.company || "Unknown"}
                    </span>
                    <span className="text-muted-foreground">{a.status}</span>
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

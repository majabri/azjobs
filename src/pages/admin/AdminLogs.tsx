import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ScrollText, RefreshCw, ChevronDown, ChevronRight, AlertCircle,
  Info, AlertTriangle, Clock, Filter, XCircle, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  user_id: string | null;
  agent_id: string | null;
  run_id: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
}

const LEVEL_CONFIG = {
  info: { icon: <Info className="w-3.5 h-3.5" />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  warn: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  error: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    user_id: "",
    agent_id: "",
    run_id: "",
    status: "all",
    level: "all",
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogs = useCallback(async (scrollToBottom = false) => {
    let query = (supabase as any)
      .from("admin_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(200);

    if (filters.user_id.trim()) query = query.ilike("user_id::text", `%${filters.user_id.trim()}%`);
    if (filters.agent_id.trim()) query = query.ilike("agent_id", `%${filters.agent_id.trim()}%`);
    if (filters.run_id.trim()) query = query.ilike("run_id::text", `%${filters.run_id.trim()}%`);
    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.level !== "all") query = query.eq("level", filters.level);

    const { data, error } = await query;
    if (!error && data) {
      setLogs((data as LogEntry[]).reverse());
      if (scrollToBottom) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    loadLogs(true);
  }, [loadLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => loadLogs(true), 5000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, loadLogs]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const retryRun = async (runId: string) => {
    await (supabase as any)
      .from("agent_runs")
      .update({ status: "pending" })
      .eq("id", runId);
    loadLogs();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-accent" /> Logs & Error Viewer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time structured log streaming</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadLogs()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Input
              placeholder="user_id"
              value={filters.user_id}
              onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))}
              className="text-xs h-8"
            />
            <Input
              placeholder="agent_id"
              value={filters.agent_id}
              onChange={(e) => setFilters((f) => ({ ...f, agent_id: e.target.value }))}
              className="text-xs h-8"
            />
            <Input
              placeholder="run_id"
              value={filters.run_id}
              onChange={(e) => setFilters((f) => ({ ...f, run_id: e.target.value }))}
              className="text-xs h-8"
            />
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.level} onValueChange={(v) => setFilters((f) => ({ ...f, level: v }))}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Log stream */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Log Stream ({logs.length} entries)</span>
            <span className="text-xs font-normal text-muted-foreground">
              {autoRefresh ? "Auto-refreshing every 5s" : "Refresh paused"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-5 h-5 animate-spin text-accent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No logs found</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto font-mono text-xs">
              {logs.map((log) => {
                const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
                const expanded = expandedIds.has(log.id);
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                return (
                  <div
                    key={log.id}
                    className={`border-b border-border last:border-0 px-4 py-2 hover:bg-muted/20 transition-colors ${
                      log.level === "error" ? "bg-red-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground text-[10px] w-[140px] shrink-0 pt-0.5">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className={`flex items-center gap-1 w-12 shrink-0 ${cfg.color}`}>
                        {cfg.icon}
                        <span className="uppercase text-[10px] font-bold">{log.level}</span>
                      </span>
                      <span className="flex-1 text-foreground leading-relaxed">{log.message}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {log.status && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 h-4 ${
                              log.status === "success"
                                ? "text-success border-success/30"
                                : "text-destructive border-destructive/30"
                            }`}
                          >
                            {log.status}
                          </Badge>
                        )}
                        {log.run_id && log.status === "failed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[10px] px-1.5 text-accent hover:text-accent"
                            onClick={() => retryRun(log.run_id!)}
                          >
                            Retry
                          </Button>
                        )}
                        {hasMetadata && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {expanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Metadata info row */}
                    {(log.user_id || log.agent_id || log.run_id) && (
                      <div className="flex items-center gap-3 mt-0.5 ml-[164px] text-[10px] text-muted-foreground">
                        {log.user_id && <span>user:{log.user_id.slice(0, 8)}…</span>}
                        {log.agent_id && <span>agent:{log.agent_id}</span>}
                        {log.run_id && <span>run:{log.run_id.slice(0, 8)}…</span>}
                      </div>
                    )}
                    {/* Expandable metadata */}
                    {expanded && hasMetadata && (
                      <div className="mt-2 ml-[164px] bg-muted/30 rounded p-2 border border-border">
                        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Viewer Panel */}
      <ErrorViewerPanel onRetry={loadLogs} />
    </div>
  );
}

function ErrorViewerPanel({ onRetry }: { onRetry: () => void }) {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("agent_runs")
        .select("id, user_id, status, errors, started_at, completed_at, jobs_found, jobs_matched, applications_sent")
        .in("status", ["failed", "completed_with_errors"])
        .order("started_at", { ascending: false })
        .limit(50);
      setErrors(data || []);
      setLoading(false);
    })();
  }, []);

  const retryRun = async (runId: string) => {
    await (supabase as any)
      .from("agent_runs")
      .update({ status: "pending", errors: [] })
      .eq("id", runId);
    setErrors((prev) => prev.filter((e) => e.id !== runId));
    onRetry();
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <XCircle className="w-4 h-4 text-destructive" /> Error Viewer — Failed Agent Runs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Clock className="w-5 h-5 animate-spin text-accent" />
          </div>
        ) : errors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success opacity-60" />
            <p className="text-sm">No failed runs — all good!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((err) => {
              const isExpanded = expanded.has(err.id);
              return (
                <div
                  key={err.id}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => toggle(err.id)}
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          Run {err.id.slice(0, 8)}… · user:{err.user_id?.slice(0, 8)}…
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(err.started_at).toLocaleString()} · {err.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={(e) => { e.stopPropagation(); retryRun(err.id); }}
                      >
                        Retry Run
                      </Button>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-destructive/20 p-3 space-y-3 font-mono text-xs">
                      {/* Error messages */}
                      {err.errors?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-sans font-semibold text-muted-foreground uppercase mb-1">Error Messages</p>
                          {err.errors.map((e: string, i: number) => (
                            <p key={i} className="text-destructive bg-destructive/10 px-2 py-1 rounded mb-1">
                              {e}
                            </p>
                          ))}
                        </div>
                      )}
                      {/* Input payload */}
                      <div>
                        <p className="text-[10px] font-sans font-semibold text-muted-foreground uppercase mb-1">Input Payload</p>
                        <pre className="bg-muted/30 rounded p-2 text-muted-foreground overflow-auto">
                          {JSON.stringify({
                            jobs_found: err.jobs_found,
                            jobs_matched: err.jobs_matched,
                            applications_sent: err.applications_sent,
                          }, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Terminal,
  Shield,
  User,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface CommandLogEntry {
  id: string;
  admin_id: string;
  command: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  success: boolean;
  executed_at: string;
}

type AuditCategory = "all" | "commands" | "agent_runs" | "user_changes";

interface AuditEntry {
  id: string;
  category: AuditCategory;
  who: string;
  what: string;
  detail: string;
  success: boolean;
  timestamp: string;
  raw?: Record<string, unknown>;
}

export default function AdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    category: "all",
    who: "",
    search: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cmdRes, runRes] = await Promise.all([
        supabase
          .from("admin_command_log")
          .select("*")
          .order("executed_at", { ascending: false })
          .limit(200),
        supabase
          .from("agent_runs")
          .select(
            "id, user_id, status, started_at, completed_at, errors, jobs_found, jobs_matched, applications_sent",
          )
          .order("started_at", { ascending: false })
          .limit(100),
      ]);

      const auditEntries: AuditEntry[] = [];

      // Command log entries
      for (const cmd of (cmdRes.data || []) as CommandLogEntry[]) {
        auditEntries.push({
          id: `cmd-${cmd.id}`,
          category: "commands",
          who: (cmd.admin_id?.slice(0, 8) ?? "unknown") + "…",
          what: cmd.command,
          detail:
            Object.keys(cmd.args || {}).length > 0
              ? `Args: ${JSON.stringify(cmd.args)}`
              : "No args",
          success: cmd.success,
          timestamp: cmd.executed_at,
          raw: {
            admin_id: cmd.admin_id,
            command: cmd.command,
            args: cmd.args,
            result: cmd.result,
            success: cmd.success,
          },
        });
      }

      // Agent run entries
      for (const run of runRes.data || []) {
        const failed =
          run.status === "failed" || run.status === "completed_with_errors";
        auditEntries.push({
          id: `run-${run.id}`,
          category: "agent_runs",
          who: run.user_id ? run.user_id.slice(0, 8) + "…" : "system",
          what: "agent.run",
          detail: `${run.jobs_found ?? 0} found · ${run.jobs_matched ?? 0} matched · ${run.applications_sent ?? 0} applied${failed && run.errors?.length ? ` · Error: ${run.errors[0]}` : ""}`,
          success: !failed,
          timestamp: run.started_at,
          raw: run,
        });
      }

      // Sort all entries by timestamp desc
      auditEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setEntries(auditEntries);
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filtered = entries.filter((e) => {
    if (filters.category !== "all" && e.category !== filters.category)
      return false;
    if (
      filters.who.trim() &&
      !e.who.toLowerCase().includes(filters.who.trim().toLowerCase())
    )
      return false;
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      if (
        !e.what.toLowerCase().includes(q) &&
        !e.detail.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const CATEGORY_ICON: Record<string, React.ReactNode> = {
    commands: <Terminal className="w-3.5 h-3.5 text-accent" />,
    agent_runs: <Shield className="w-3.5 h-3.5 text-blue-400" />,
    user_changes: <User className="w-3.5 h-3.5 text-purple-400" />,
  };

  const CATEGORY_COLOR: Record<string, string> = {
    commands: "text-accent border-accent/30",
    agent_runs: "text-blue-400 border-blue-400/30",
    user_changes: "text-purple-400 border-purple-400/30",
  };

  const stats = {
    total: entries.length,
    commands: entries.filter((e) => e.category === "commands").length,
    agent_runs: entries.filter((e) => e.category === "agent_runs").length,
    failures: entries.filter((e) => !e.success).length,
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-accent" /> Audit Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track admin actions, command executions, and system events
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <ClipboardList className="w-3.5 h-3.5" /> Total Events
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {stats.total}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 text-xs mb-1 text-accent">
            <Terminal className="w-3.5 h-3.5" /> Commands
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {stats.commands}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 text-xs mb-1 text-blue-400">
            <Shield className="w-3.5 h-3.5" /> Agent Runs
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {stats.agent_runs}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-destructive/20 shadow-sm">
          <div className="flex items-center gap-2 text-xs mb-1 text-destructive">
            <XCircle className="w-3.5 h-3.5" /> Failures
          </div>
          <div className="text-2xl font-display font-bold text-foreground">
            {stats.failures}
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              value={filters.category}
              onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="commands">Console Commands</SelectItem>
                <SelectItem value="agent_runs">Agent Runs</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter by who (user/admin ID)"
              value={filters.who}
              onChange={(e) =>
                setFilters((f) => ({ ...f, who: e.target.value }))
              }
              className="text-xs h-8"
            />
            <Input
              placeholder="Search actions / details"
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
              className="text-xs h-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit table */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Audit Events ({filtered.length})</span>
            <span className="text-xs font-normal text-muted-foreground">
              Showing most recent first
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-5 h-5 animate-spin text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No audit events found</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto font-mono text-xs">
              {filtered.map((entry) => {
                const isExpanded = expandedIds.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    className={`border-b border-border last:border-0 px-4 py-2.5 hover:bg-muted/20 transition-colors ${
                      !entry.success ? "bg-red-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Timestamp */}
                      <span className="text-muted-foreground text-[10px] w-[140px] shrink-0 pt-0.5">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      {/* Category badge */}
                      <span
                        className={`flex items-center gap-1 w-24 shrink-0 ${CATEGORY_COLOR[entry.category] ?? "text-muted-foreground"}`}
                      >
                        {CATEGORY_ICON[entry.category]}
                        <span className="uppercase text-[9px] font-bold">
                          {entry.category.replace(/_/g, " ")}
                        </span>
                      </span>
                      {/* Who */}
                      <span
                        className="text-muted-foreground w-24 shrink-0 truncate"
                        title={entry.who}
                      >
                        {entry.who}
                      </span>
                      {/* What */}
                      <span
                        className="text-accent font-medium w-32 shrink-0 truncate"
                        title={entry.what}
                      >
                        {entry.what}
                      </span>
                      {/* Detail */}
                      <span
                        className="flex-1 text-foreground leading-relaxed truncate"
                        title={entry.detail}
                      >
                        {entry.detail}
                      </span>
                      {/* Status + expand */}
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        {entry.raw && (
                          <button
                            onClick={() => toggleExpand(entry.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Expanded raw data */}
                    {isExpanded && entry.raw && (
                      <div className="mt-2 ml-[340px] bg-muted/30 rounded p-2 border border-border">
                        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                          {JSON.stringify(entry.raw, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

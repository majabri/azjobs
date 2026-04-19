/**
 * Admin: Pipeline Events Log
 *
 * Live view of the platform_events table — every significant action taken by
 * the iCareerOS agent pipeline.  Added in HIGH-008 Phase 2.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, RefreshCw, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, ChevronRight, Zap, Search, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { EventType } from "@/types/events";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformEventRow {
  id: string;
  event_type: EventType;
  event_data: Record<string, unknown>;
  user_id: string | null;
  published_at: string;
  processed: boolean;
  source: "frontend" | "edge-function" | "cron";
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  "job.search.requested":   { label: "Search Started",    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: <Search className="w-3 h-3" /> },
  "job.search.completed":   { label: "Search Done",       color: "bg-green-500/10 text-green-400 border-green-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  "job.scored":             { label: "Jobs Scored",       color: "bg-primary/10 text-primary border-primary/20",       icon: <Zap className="w-3 h-3" /> },
  "resume.optimized":       { label: "Resume Optimized",  color: "bg-violet-500/10 text-violet-400 border-violet-500/20", icon: <Activity className="w-3 h-3" /> },
  "application.submitted":  { label: "App Submitted",     color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  "pipeline.failed":        { label: "Pipeline Failed",   color: "bg-red-500/10 text-red-400 border-red-500/20",       icon: <XCircle className="w-3 h-3" /> },
  "pipeline.step.skipped":  { label: "Step Skipped",      color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
};

function eventCfg(type: string) {
  return EVENT_CONFIG[type] ?? { label: type, color: "bg-muted text-muted-foreground border-border", icon: <Activity className="w-3 h-3" /> };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

const PAGE_SIZE = 50;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminEventLog() {
  const [events, setEvents] = useState<PlatformEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUser, setFilterUser] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const loadEvents = useCallback(async (pageNum = 0) => {
    setLoading(true);
    try {
      let query = supabase
        .from("platform_events")
        .select("*", { count: "exact" })
        .order("published_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1);

      if (filterType !== "all") query = query.eq("event_type", filterType);
      if (filterUser.trim()) query = query.eq("user_id", filterUser.trim());

      const { data, error, count } = await query;
      if (error) throw error;

      setEvents(data ?? []);
      setTotalCount(count ?? 0);
      setHasMore((count ?? 0) > (pageNum + 1) * PAGE_SIZE);
      setPage(pageNum);
    } catch (e) {
      console.error("[EventLog] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterUser]);

  useEffect(() => { loadEvents(0); }, [loadEvents]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Live subscription — new events push in without a full reload
  useEffect(() => {
    const channel = supabase
      .channel("platform_events_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "platform_events" }, payload => {
        const row = payload.new as PlatformEventRow;
        setEvents(prev => [row, ...prev.slice(0, PAGE_SIZE - 1)]);
        setTotalCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const failedCount = events.filter(e => e.event_type === "pipeline.failed").length;
  const uniqueUsers = new Set(events.map(e => e.user_id).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Pipeline Events</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live audit log of all agent pipeline actions — {totalCount.toLocaleString()} events recorded
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadEvents(0)} disabled={loading}>
          <RefreshCw className={"w-4 h-4 mr-2" + (loading ? " animate-spin" : "")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: totalCount.toLocaleString(), icon: <Activity className="w-4 h-4 text-primary" /> },
          { label: "Failures", value: failedCount, icon: <XCircle className="w-4 h-4 text-destructive" /> },
          { label: "Active Users", value: uniqueUsers, icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
          { label: "Page", value: `${page + 1} / ${Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}`, icon: <Clock className="w-4 h-4 text-muted-foreground" /> },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xs text-muted-foreground">{stat.label}</span></div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={filterType} onValueChange={v => setFilterType(v)}>
            <SelectTrigger className="w-52 h-8 text-sm">
              <SelectValue placeholder="All event types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All event types</SelectItem>
              {Object.keys(EVENT_CONFIG).map(t => (
                <SelectItem key={t} value={t}>{EVENT_CONFIG[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-64 h-8 text-sm font-mono"
            placeholder="Filter by user ID…"
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
          />
          {(filterType !== "all" || filterUser) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterType("all"); setFilterUser(""); }}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {/* Event list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {loading ? "Loading…" : `${events.length} events`}
            {failedCount > 0 && (
              <Badge variant="outline" className="ml-2 text-xs bg-red-500/10 text-red-400 border-red-500/20">
                {failedCount} failure{failedCount > 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 && !loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No events yet. Pipeline events will appear here as they occur.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {events.map(ev => {
                const cfg = eventCfg(ev.event_type);
                const expanded = expandedIds.has(ev.id);
                const dataKeys = Object.keys(ev.event_data ?? {});
                return (
                  <div key={ev.id} className="hover:bg-muted/30 transition-colors">
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => toggleExpand(ev.id)}
                    >
                      {/* Expand toggle */}
                      <div className="text-muted-foreground flex-shrink-0">
                        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>

                      {/* Type badge */}
                      <Badge variant="outline" className={"text-[10px] gap-1 flex-shrink-0 " + cfg.color}>
                        {cfg.icon}{cfg.label}
                      </Badge>

                      {/* Key data snippet */}
                      <span className="text-xs text-muted-foreground font-mono truncate flex-1 min-w-0">
                        {dataKeys.slice(0, 3).map(k => `${k}: ${String(ev.event_data[k])}`).join("  ·  ")}
                      </span>

                      {/* Source */}
                      <Badge variant="outline" className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:flex">
                        {ev.source}
                      </Badge>

                      {/* Processed */}
                      {ev.processed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        : <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                      }

                      {/* Time */}
                      <span className="text-xs text-muted-foreground flex-shrink-0 w-20 text-right">
                        {relativeTime(ev.published_at)}
                      </span>
                    </div>

                    {/* Expanded payload */}
                    {expanded && (
                      <div className="px-10 pb-3 space-y-2">
                        <div className="rounded-md bg-muted/50 border border-border p-3">
                          <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Event Data</p>
                          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                            {JSON.stringify(ev.event_data, null, 2)}
                          </pre>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span><span className="font-semibold">ID:</span> {ev.id}</span>
                          {ev.user_id && <span><span className="font-semibold">User:</span> {ev.user_id}</span>}
                          <span><span className="font-semibold">Published:</span> {new Date(ev.published_at).toLocaleString()}</span>
                          <span><span className="font-semibold">Processed:</span> {ev.processed ? "yes" : "pending"}</span>
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

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex justify-center gap-3">
          {page > 0 && (
            <Button variant="outline" size="sm" onClick={() => loadEvents(page - 1)}>← Previous</Button>
          )}
          {hasMore && (
            <Button variant="outline" size="sm" onClick={() => loadEvents(page + 1)}>Next →</Button>
          )}
        </div>
      )}
    </div>
  );
}

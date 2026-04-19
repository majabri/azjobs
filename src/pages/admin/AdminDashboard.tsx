import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Bot, BarChart3, Briefcase, TrendingUp, Activity,
  CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, Zap,
  UserPlus,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import FeatureFlagsPanel from "@/components/admin/FeatureFlagsPanel";
import ServiceHealthPanel from "@/components/admin/ServiceHealthPanel";
import AdminAlertsPanel from "@/components/admin/AdminAlertsPanel";
import EnhancedServiceHealthPanel from "@/components/admin/EnhancedServiceHealthPanel";
import UserRoleManagementPanel from "@/components/admin/UserRoleManagementPanel";
import { logger } from '@/lib/logger';

interface PlatformStats {
  totalUsers: number;
  activeUsersToday: number;
  totalAnalyses: number;
  totalApplications: number;
  totalAgentRuns: number;
  failedAgentRuns: number;
  totalJobsFound: number;
  totalMatched: number;
  totalApplied: number;
}

interface RecentAgentRun {
  id: string;
  user_id: string;
  status: string;
  jobs_found: number;
  jobs_matched: number;
  applications_sent: number;
  started_at: string;
  errors: string[];
}

interface DailyStats {
  date: string;
  runs: number;
  success: number;
  failed: number;
  users: number;
}

interface ActivityEvent {
  id: string;
  type: "agent_run" | "user_signup" | "error";
  timestamp: string;
  description: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentAgentRun[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [avgProcessingMs, setAvgProcessingMs] = useState<number | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [profilesRes, analysesRes, applicationsRes, agentRunsRes] = await Promise.all([
        supabase.from("job_seeker_profiles").select("user_id, last_active_at", { count: "exact" }),
        supabase.from("analysis_history" as any).select("id", { count: "exact" }),
        supabase.from("job_applications").select("id", { count: "exact" }),
        supabase.from("agent_runs" as any)
          .select("id, status, jobs_found, jobs_matched, applications_sent, started_at, completed_at, errors, user_id")
          .order("started_at", { ascending: false })
          .limit(200),
      ]);

      const runs: RecentAgentRun[] = (agentRunsRes.data as any[]) || [];
      const today = new Date().toISOString().split("T")[0];
      const profiles = (profilesRes.data as any[]) || [];

      const activeToday = profiles.filter((p: any) =>
        p.last_active_at && p.last_active_at.startsWith(today)
      ).length;

      const failed = runs.filter((r) => r.status === "failed" || r.status === "completed_with_errors").length;

      // Compute daily stats (last 7 days)
      const dayMap: Record<string, DailyStats> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dayMap[key] = { date: key.slice(5), runs: 0, success: 0, failed: 0, users: 0 };
      }
      const usersByDay: Record<string, Set<string>> = {};
      for (const r of runs) {
        const day = r.started_at?.split("T")[0];
        if (!day || !dayMap[day]) continue;
        dayMap[day].runs += 1;
        if (r.status === "completed") dayMap[day].success += 1;
        if (r.status === "failed" || r.status === "completed_with_errors") dayMap[day].failed += 1;
        if (!usersByDay[day]) usersByDay[day] = new Set();
        if (r.user_id) usersByDay[day].add(r.user_id);
      }
      for (const [day, s] of Object.entries(dayMap)) {
        s.users = usersByDay[day]?.size ?? 0;
      }
      setDailyStats(Object.values(dayMap));

      // Avg processing time
      const completed = (agentRunsRes.data as any[])?.filter(
        (r: any) => r.completed_at && r.started_at
      ) || [];
      if (completed.length > 0) {
        const avg = completed.reduce((sum: number, r: any) => {
          return sum + (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime());
        }, 0) / completed.length;
        setAvgProcessingMs(avg);
      }

      setStats({
        totalUsers: profilesRes.count ?? 0,
        activeUsersToday: activeToday,
        totalAnalyses: (analysesRes as any).count ?? 0,
        totalApplications: applicationsRes.count ?? 0,
        totalAgentRuns: runs.length,
        failedAgentRuns: failed,
        totalJobsFound: runs.reduce((s, r) => s + (r.jobs_found || 0), 0),
        totalMatched: runs.reduce((s, r) => s + (r.jobs_matched || 0), 0),
        totalApplied: runs.reduce((s, r) => s + (r.applications_sent || 0), 0),
      });
      setRecentRuns(runs.slice(0, 10));

      // Build activity feed (last 20 events: runs + errors)
      const events: ActivityEvent[] = [];
      for (const r of runs.slice(0, 20)) {
        const isError = r.status === "failed" || r.status === "completed_with_errors";
        events.push({
          id: r.id,
          type: isError ? "error" : "agent_run",
          timestamp: r.started_at,
          description: isError
            ? `Agent run failed for user ${r.user_id.slice(0, 8)}… — ${(r.errors && r.errors.length > 0 ? r.errors[0] : null) ?? "unknown error"}`
            : `Agent run completed: ${r.jobs_found} found, ${r.jobs_matched} matched, ${r.applications_sent} applied`,
        });
      }
      // Sort by timestamp desc and take top 20
      events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setActivityFeed(events.slice(0, 20));
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const successRate = stats && stats.totalAgentRuns > 0
    ? Math.round(((stats.totalAgentRuns - stats.failedAgentRuns) / stats.totalAgentRuns) * 100)
    : 0;

  const errorRate = stats && stats.totalAgentRuns > 0
    ? Math.round((stats.failedAgentRuns / stats.totalAgentRuns) * 100)
    : 0;

  const pieData = [
    { name: "Success", value: (stats?.totalAgentRuns ?? 0) - (stats?.failedAgentRuns ?? 0) },
    { name: "Failed", value: stats?.failedAgentRuns ?? 0 },
  ];
  const PIE_COLORS = ["hsl(var(--success, 142 71% 45%))", "hsl(var(--destructive, 0 84% 60%))"];

  // System alerts — 1-hour window for urgency
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const failedLast1h = recentRuns.filter((r) => {
    return (r.status === "failed" || r.status === "completed_with_errors") && r.started_at > oneHourAgo;
  }).length;

  const alerts = [
    {
      key: "failed1h",
      status: failedLast1h === 0 ? "green" : failedLast1h < 3 ? "yellow" : "red",
      label: "Failed Runs (1h)",
      detail: failedLast1h === 0 ? "No failures in last hour" : `${failedLast1h} failed run(s) in last hour`,
      link: "/admin/agent-runs",
    },
    {
      key: "errorRate",
      status: errorRate === 0 ? "green" : errorRate < 5 ? "yellow" : "red",
      label: "Error Rate",
      detail: `${errorRate}% of runs failed`,
      link: "/admin/logs?filter=error",
    },
    {
      key: "overall",
      status: errorRate === 0 && failedLast1h === 0 ? "green" : "yellow",
      label: "System Status",
      detail: errorRate === 0 && failedLast1h === 0 ? "All systems operational" : "Degraded — check logs",
      link: "/admin/system",
    },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Platform Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Global stats across all users</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* System Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {alerts.map((alert) => (
          <div
            key={alert.key}
            className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer hover:opacity-80 transition-opacity ${
              alert.status === "green"
                ? "bg-success/5 border-success/20"
                : alert.status === "yellow"
                ? "bg-warning/5 border-warning/20"
                : "bg-destructive/5 border-destructive/20"
            }`}
            onClick={() => navigate(alert.link)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(alert.link); }}
          >
            {alert.status === "green" ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : alert.status === "yellow" ? (
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-foreground text-xs">{alert.label}</p>
              <p className="text-[10px] text-muted-foreground">{alert.detail}</p>
            </div>
            <span className="text-[10px] text-muted-foreground">→</span>
          </div>
        ))}

      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon={<Users className="w-4 h-4" />} onClick={() => navigate("/admin/users")} />
        <StatCard label="Active Today" value={stats?.activeUsersToday ?? 0} icon={<Activity className="w-4 h-4" />} color="text-success" onClick={() => navigate("/admin/users")} />
        <StatCard label="Analyses Run" value={stats?.totalAnalyses ?? 0} icon={<BarChart3 className="w-4 h-4" />} />
        <StatCard label="Applications" value={stats?.totalApplications ?? 0} icon={<Briefcase className="w-4 h-4" />} />
      </div>

      {/* Agent Stats + Rates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Agent Runs" value={stats?.totalAgentRuns ?? 0} icon={<Bot className="w-4 h-4" />} onClick={() => navigate("/admin/agent-runs")} />
        <StatCard label="Success Rate" value={successRate} icon={<CheckCircle2 className="w-4 h-4" />} color="text-success" suffix="%" onClick={() => navigate("/admin/agent-runs")} />
        <StatCard label="Error Rate" value={errorRate} icon={<AlertTriangle className="w-4 h-4" />} color={errorRate > 20 ? "text-destructive" : "text-warning"} suffix="%" onClick={() => navigate("/admin/logs?filter=error")} />
        <StatCard
          label="Avg Processing"
          value={avgProcessingMs ? Math.round(avgProcessingMs / 1000) : 0}
          icon={<Zap className="w-4 h-4" />}
          color="text-accent"
          suffix="s"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Active Users */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> Daily Active Users (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={dailyStats} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.15)" name="Active Users" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Success vs Failure Pie */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-accent" /> Agent Run Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Runs over time bar chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" /> Total Runs Over Time (7 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dailyStats} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Bar dataKey="success" fill="#22c55e" name="Success" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" stackId="a" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity Feed + Recent Agent Runs side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" /> Recent Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activityFeed.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2.5 p-2.5 bg-muted/20 rounded-lg border border-border"
                  >
                    <span className="mt-0.5 shrink-0">
                      {event.type === "agent_run" ? (
                        <Bot className="w-3.5 h-3.5 text-accent" />
                      ) : event.type === "user_signup" ? (
                        <UserPlus className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground leading-snug truncate" title={event.description}>{event.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        event.type === "agent_run"
                          ? "text-accent border-accent/30"
                          : event.type === "user_signup"
                          ? "text-success border-success/30"
                          : "text-destructive border-destructive/30"
                      }`}
                    >
                      {event.type === "agent_run" ? "run" : event.type === "user_signup" ? "signup" : "error"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Agent Runs */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent" /> Recent Agent Runs
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-accent"
                onClick={() => navigate("/admin/agent-runs")}
              >
                View all →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <p className="text-muted-foreground text-sm">No agent runs yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2">
                      {run.status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      ) : run.status === "completed_with_errors" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                      ) : run.status === "running" ? (
                        <Clock className="w-3.5 h-3.5 animate-spin text-accent" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {run.jobs_found} found · {run.jobs_matched} matched · {run.applications_sent} applied
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(run.started_at).toLocaleString()} · user: {run.user_id.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Alerts + Service Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminAlertsPanel />
        <ServiceHealthPanel />
      </div>

      {/* Enhanced Service Health Monitoring */}
      <EnhancedServiceHealthPanel />

      {/* User Role Management */}
      <UserRoleManagementPanel />

      {/* Architecture Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeatureFlagsPanel />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  suffix,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  suffix?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-card rounded-xl p-4 border border-border shadow-sm ${onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon} {label}
        {onClick && <span className="ml-auto text-accent text-[10px]">→</span>}
      </div>
      <div className={`text-2xl font-display font-bold ${color || "text-foreground"}`}>
        {value.toLocaleString()}{suffix ?? ""}
      </div>
    </div>
  );
}


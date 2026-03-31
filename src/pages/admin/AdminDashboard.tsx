import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Bot, BarChart3, Briefcase, TrendingUp, Activity,
  CheckCircle2, XCircle, AlertTriangle, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentAgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [profilesRes, analysesRes, applicationsRes, agentRunsRes] = await Promise.all([
        supabase.from("job_seeker_profiles").select("user_id, last_active_at", { count: "exact" }),
        supabase.from("analysis_history" as any).select("id", { count: "exact" }),
        supabase.from("job_applications").select("id", { count: "exact" }),
        supabase.from("agent_runs" as any)
          .select("id, status, jobs_found, jobs_matched, applications_sent, started_at, errors, user_id")
          .order("started_at", { ascending: false })
          .limit(20),
      ]);

      const runs: RecentAgentRun[] = (agentRunsRes.data as any[]) || [];
      const today = new Date().toISOString().split("T")[0];
      const profiles = (profilesRes.data as any[]) || [];

      const activeToday = profiles.filter((p: any) =>
        p.last_active_at && p.last_active_at.startsWith(today)
      ).length;

      const failed = runs.filter((r) => r.status === "failed" || r.status === "completed_with_errors").length;

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
    } catch (e) {
      console.error(e);
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Platform Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Global stats across all users</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Active Today" value={stats?.activeUsersToday ?? 0} icon={<Activity className="w-4 h-4" />} color="text-success" />
        <StatCard label="Analyses Run" value={stats?.totalAnalyses ?? 0} icon={<BarChart3 className="w-4 h-4" />} />
        <StatCard label="Applications" value={stats?.totalApplications ?? 0} icon={<Briefcase className="w-4 h-4" />} />
      </div>

      {/* Agent Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Agent Runs (recent)" value={stats?.totalAgentRuns ?? 0} icon={<Bot className="w-4 h-4" />} />
        <StatCard label="Failed Runs" value={stats?.failedAgentRuns ?? 0} icon={<AlertTriangle className="w-4 h-4" />} color={stats?.failedAgentRuns ? "text-destructive" : "text-foreground"} />
        <StatCard label="Jobs Matched" value={stats?.totalMatched ?? 0} icon={<TrendingUp className="w-4 h-4" />} color="text-accent" />
      </div>

      {/* Recent Agent Activity */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-accent" /> Recent Agent Runs (Platform-wide)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No agent runs yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-2">
                    {run.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : run.status === "completed_with_errors" ? (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    ) : run.status === "running" ? (
                      <Clock className="w-4 h-4 animate-spin text-accent" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
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
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon} {label}
      </div>
      <div className={`text-2xl font-display font-bold ${color || "text-foreground"}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

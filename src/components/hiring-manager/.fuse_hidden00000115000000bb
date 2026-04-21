import { forwardRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase, Users, Calendar, FileText, TrendingUp,
  Clock, ArrowRight, Plus, Eye, CheckCircle2, XCircle,
} from "lucide-react";

/* ── Stat Card ─────────────────────────────────────────────── */
const StatCard = forwardRef<HTMLDivElement, {
  title: string; value: string | number; icon: React.ElementType;
  trend?: string; color?: string;
}>(({ title, value, icon: Icon, trend, color = "text-primary" }, ref) => (
  <Card ref={ref} className="hover:shadow-md transition-shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {trend && <p className="text-xs text-success flex items-center gap-1"><TrendingUp className="w-3 h-3" />{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-primary/10 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </CardContent>
  </Card>
));
StatCard.displayName = "StatCard";

/* ── Status helpers ────────────────────────────────────────── */
const statusColor: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  applied: "bg-primary/10 text-primary border-primary/20",
  interviewing: "bg-accent/10 text-accent border-accent/20",
  offer: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  saved: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-success/10 text-success border-success/20",
  closed: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function EmployerDashboardHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ jobs: 0, candidates: 0, interviews: 0, offers: 0 });
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const uid = session.user.id;

        const [jobsRes, interviewsRes, appsRes] = await Promise.all([
          supabase.from("job_postings").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
          supabase.from("interview_schedules").select("*").eq("user_id", uid).order("scheduled_at", { ascending: true }),
          supabase.from("job_applications").select("*").eq("user_id", uid).order("applied_at", { ascending: false }).limit(5),
        ]);

        const jobs = jobsRes.data ?? [];
        const interviews = interviewsRes.data ?? [];
        const apps = appsRes.data ?? [];

        const activeJobsList = jobs.filter((j) => j.status === "active" || j.status === "draft");
        const upcoming = interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at) >= new Date());
        const totalCandidates = jobs.reduce((sum, j) => sum + (j.candidates_matched ?? 0), 0);

        setStats({
          jobs: activeJobsList.length,
          candidates: totalCandidates,
          interviews: upcoming.length,
          offers: apps.filter((a) => a.status === "offer").length,
        });
        setRecentApps(apps.slice(0, 5));
        setUpcomingInterviews(upcoming.slice(0, 5));
        setActiveJobs(activeJobsList.slice(0, 4));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employer Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your hiring pipeline at a glance</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/job-postings")}>
            <Eye className="w-4 h-4 mr-1" /> View Jobs
          </Button>
          <Button size="sm" onClick={() => navigate("/job-postings")}>
            <Plus className="w-4 h-4 mr-1" /> Post a Job
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Jobs" value={stats.jobs} icon={Briefcase} />
        <StatCard title="Total Candidates" value={stats.candidates} icon={Users} />
        <StatCard title="Upcoming Interviews" value={stats.interviews} icon={Calendar} />
        <StatCard title="Offers Extended" value={stats.offers} icon={FileText} />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Job Postings</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/job-postings")} className="text-xs">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No active job postings yet</p>
            ) : (
              activeJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.company} · {job.location || "Remote"}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant="outline" className={statusColor[job.status] || ""}>
                      {job.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {job.candidates_matched ?? 0} matches
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Interviews */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Upcoming Interviews</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/interview-scheduling")} className="text-xs">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingInterviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No upcoming interviews</p>
            ) : (
              upcomingInterviews.map((interview) => (
                <div key={interview.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{interview.candidate_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(interview.scheduled_at).toLocaleDateString()} · {new Date(interview.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusColor[interview.interview_type] || "bg-primary/10 text-primary border-primary/20"}>
                    {interview.interview_type}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Applications</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/candidates")} className="text-xs">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentApps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent applications</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Candidate</th>
                      <th className="pb-2 font-medium">Position</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentApps.map((app) => (
                      <tr key={app.id} className="hover:bg-muted/30">
                        <td className="py-2.5 font-medium text-foreground">{app.company}</td>
                        <td className="py-2.5 text-muted-foreground">{app.job_title}</td>
                        <td className="py-2.5">
                          <Badge variant="outline" className={statusColor[app.status] || ""}>
                            {app.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-muted-foreground text-xs">
                          {new Date(app.applied_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

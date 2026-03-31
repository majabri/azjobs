import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Search, Clock, Shield, UserCircle, Target, Briefcase,
  FileText, Calendar, Bot, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ──────────────────────────────────────────────────────────────────

type AdminView = "job_seekers" | "hiring_managers";

interface JobSeekerRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  last_active_at: string | null;
  automation_mode: string;
  skills: string[] | null;
  role: string;
  application_count: number;
  analysis_count: number;
}

interface HiringManagerRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  job_posting_count: number;
  interview_count: number;
  candidates_matched: number;
  latest_posting_at: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  recruiter: "bg-accent/10 text-accent border-accent/20",
  job_seeker: "bg-muted text-muted-foreground border-border",
};

const VIEW_META: Record<AdminView, { label: string; icon: typeof Target; description: string }> = {
  job_seekers: {
    label: "Job Seekers",
    icon: Target,
    description: "Manage job seeker profiles, automation settings, and activity",
  },
  hiring_managers: {
    label: "Hiring Managers",
    icon: Briefcase,
    description: "Manage recruiter accounts, job postings, and interview pipelines",
  },
};

// ─── Shared helpers ──────────────────────────────────────────────────────────

function RoleSelect({
  userId,
  currentRole,
  disabled,
  onChangeRole,
}: {
  userId: string;
  currentRole: string;
  disabled: boolean;
  onChangeRole: (userId: string, role: string) => void;
}) {
  return (
    <Select
      value={currentRole}
      onValueChange={(v) => onChangeRole(userId, v)}
      disabled={disabled}
    >
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="job_seeker">Job Seeker</SelectItem>
        <SelectItem value="recruiter">Recruiter</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ─── Job Seeker Panel ────────────────────────────────────────────────────────

function JobSeekerPanel({
  search,
  updatingId,
  onChangeRole,
}: {
  search: string;
  updatingId: string | null;
  onChangeRole: (userId: string, role: string) => void;
}) {
  const [records, setRecords] = useState<JobSeekerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, appsRes, analysesRes] = await Promise.all([
        supabase.from("job_seeker_profiles").select(
          "user_id, full_name, email, last_active_at, automation_mode, skills"
        ),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("job_applications").select("user_id"),
        supabase.from("analysis_history" as any).select("user_id") as any,
      ]);

      const rolesMap = new Map<string, string>();
      for (const r of rolesRes.data || []) rolesMap.set(r.user_id, r.role);

      const appCountMap = new Map<string, number>();
      for (const a of (appsRes.data || [])) {
        appCountMap.set(a.user_id, (appCountMap.get(a.user_id) ?? 0) + 1);
      }

      const analysisCountMap = new Map<string, number>();
      for (const a of ((analysesRes.data as any[]) || [])) {
        analysisCountMap.set(a.user_id, (analysisCountMap.get(a.user_id) ?? 0) + 1);
      }

      const merged: JobSeekerRecord[] = ((profilesRes.data as any[]) || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        last_active_at: p.last_active_at,
        automation_mode: p.automation_mode ?? "manual",
        skills: p.skills,
        role: rolesMap.get(p.user_id) ?? "job_seeker",
        application_count: appCountMap.get(p.user_id) ?? 0,
        analysis_count: analysisCountMap.get(p.user_id) ?? 0,
      }));

      setRecords(merged);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load job seekers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.user_id.includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MiniStat label="Total" value={records.length} icon={<Users className="w-3.5 h-3.5" />} />
        <MiniStat
          label="Active automation"
          value={records.filter((r) => r.automation_mode !== "manual").length}
          icon={<Bot className="w-3.5 h-3.5" />}
          color="text-accent"
        />
        <MiniStat
          label="Applications filed"
          value={records.reduce((s, r) => s + r.application_count, 0)}
          icon={<FileText className="w-3.5 h-3.5" />}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No job seekers found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.full_name || "Unnamed User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email || user.user_id.slice(0, 16) + "…"}
                </p>
              </div>

              {/* Automation mode badge */}
              <Badge
                variant="outline"
                className={
                  user.automation_mode === "full-auto"
                    ? "text-success border-success/30 text-[10px]"
                    : user.automation_mode === "smart"
                    ? "text-accent border-accent/30 text-[10px]"
                    : "text-muted-foreground border-border text-[10px]"
                }
              >
                {user.automation_mode === "full-auto"
                  ? "Autonomous"
                  : user.automation_mode === "smart"
                  ? "Smart"
                  : "Manual"}
              </Badge>

              {/* Stats */}
              <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {user.analysis_count} analyses
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> {user.application_count} apps
                </span>
              </div>

              {/* Last active */}
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {user.last_active_at
                  ? new Date(user.last_active_at).toLocaleDateString()
                  : "Never"}
              </div>

              {/* Role badge */}
              <Badge className={ROLE_COLORS[user.role] || ROLE_COLORS.job_seeker}>
                {user.role === "admin" && <Shield className="w-3 h-3 mr-1" />}
                {user.role}
              </Badge>

              <RoleSelect
                userId={user.user_id}
                currentRole={user.role}
                disabled={updatingId === user.user_id}
                onChangeRole={onChangeRole}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Hiring Manager Panel ────────────────────────────────────────────────────

function HiringManagerPanel({
  search,
  updatingId,
  onChangeRole,
}: {
  search: string;
  updatingId: string | null;
  onChangeRole: (userId: string, role: string) => void;
}) {
  const [records, setRecords] = useState<HiringManagerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postingsRes, interviewsRes, rolesRes, profilesRes] = await Promise.all([
        supabase.from("job_postings").select("user_id, candidates_matched, created_at"),
        supabase.from("interview_schedules").select("user_id"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("job_seeker_profiles").select("user_id, full_name, email"),
      ]);

      // Build maps
      const rolesMap = new Map<string, string>();
      for (const r of rolesRes.data || []) rolesMap.set(r.user_id, r.role);

      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      for (const p of (profilesRes.data as any[] || [])) {
        profileMap.set(p.user_id, { full_name: p.full_name, email: p.email });
      }

      // Aggregate postings by user
      type PostingAgg = { count: number; matched: number; latest: string | null };
      const postingAgg = new Map<string, PostingAgg>();
      for (const p of (postingsRes.data || [])) {
        const existing = postingAgg.get(p.user_id) ?? { count: 0, matched: 0, latest: null };
        existing.count += 1;
        existing.matched += p.candidates_matched ?? 0;
        if (!existing.latest || p.created_at > existing.latest) existing.latest = p.created_at;
        postingAgg.set(p.user_id, existing);
      }

      // Aggregate interviews by user
      const interviewCount = new Map<string, number>();
      for (const i of (interviewsRes.data || [])) {
        interviewCount.set(i.user_id, (interviewCount.get(i.user_id) ?? 0) + 1);
      }

      // All unique hiring users = anyone who has a job posting or is a recruiter/admin
      const allHiringUserIds = new Set<string>([
        ...postingAgg.keys(),
        ...[...rolesMap.entries()]
          .filter(([, r]) => r === "recruiter" || r === "admin")
          .map(([uid]) => uid),
      ]);

      const merged: HiringManagerRecord[] = [...allHiringUserIds].map((uid) => {
        const profile = profileMap.get(uid);
        const agg = postingAgg.get(uid);
        return {
          user_id: uid,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          role: rolesMap.get(uid) ?? "job_seeker",
          job_posting_count: agg?.count ?? 0,
          interview_count: interviewCount.get(uid) ?? 0,
          candidates_matched: agg?.matched ?? 0,
          latest_posting_at: agg?.latest ?? null,
        };
      });

      // Sort by most postings first
      merged.sort((a, b) => b.job_posting_count - a.job_posting_count);
      setRecords(merged);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load hiring managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.user_id.includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MiniStat label="Hiring accounts" value={records.length} icon={<Users className="w-3.5 h-3.5" />} />
        <MiniStat
          label="Total job postings"
          value={records.reduce((s, r) => s + r.job_posting_count, 0)}
          icon={<FileText className="w-3.5 h-3.5" />}
          color="text-accent"
        />
        <MiniStat
          label="Interviews scheduled"
          value={records.reduce((s, r) => s + r.interview_count, 0)}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No hiring managers found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.full_name || "Unnamed User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email || user.user_id.slice(0, 16) + "…"}
                </p>
              </div>

              {/* Hiring stats */}
              <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {user.job_posting_count} postings
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {user.interview_count} interviews
                </span>
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" /> {user.candidates_matched} matched
                </span>
              </div>

              {/* Latest posting */}
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {user.latest_posting_at
                  ? new Date(user.latest_posting_at).toLocaleDateString()
                  : "No postings"}
              </div>

              {/* Role badge */}
              <Badge className={ROLE_COLORS[user.role] || ROLE_COLORS.job_seeker}>
                {user.role === "admin" && <Shield className="w-3 h-3 mr-1" />}
                {user.role}
              </Badge>

              <RoleSelect
                userId={user.user_id}
                currentRole={user.role}
                disabled={updatingId === user.user_id}
                onChangeRole={onChangeRole}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Mini stat card ───────────────────────────────────────────────────────────

function MiniStat({
  label, value, icon, color,
}: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card rounded-lg p-3 border border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
        {icon} {label}
      </div>
      <div className={`font-display font-bold text-xl ${color ?? "text-foreground"}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [activeView, setActiveView] = useState<AdminView>("job_seekers");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const meta = VIEW_META[activeView];

  const changeRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole as any } as any, { onConflict: "user_id,role" });
      if (error) throw error;
      toast.success("Role updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{meta.description}</p>
        </div>

        {/* View switcher dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 min-w-[200px] justify-between">
              <span className="flex items-center gap-2">
                <meta.icon className="w-4 h-4" />
                {meta.label}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {(Object.entries(VIEW_META) as [AdminView, typeof meta][]).map(([key, m]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => { setActiveView(key); setSearch(""); }}
                className={activeView === key ? "bg-accent/10" : ""}
              >
                <m.icon className="w-4 h-4 mr-2" />
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Divider with active view label */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            activeView === "job_seekers"
              ? "bg-accent/10 text-accent border-accent/30"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          <meta.icon className="w-3.5 h-3.5" />
          {meta.label} Administration
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${meta.label.toLowerCase()} by name, email, or ID…`}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content panel */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <meta.icon className="w-4 h-4 text-accent" />
            {meta.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeView === "job_seekers" ? (
            <JobSeekerPanel
              search={search}
              updatingId={updatingId}
              onChangeRole={changeRole}
            />
          ) : (
            <HiringManagerPanel
              search={search}
              updatingId={updatingId}
              onChangeRole={changeRole}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

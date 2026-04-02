import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Search, Clock, Shield, UserCircle, Target, Briefcase,
  FileText, Calendar, Bot, ChevronDown, UserPlus, Trash2, Pencil, Phone,
  ShieldCheck, UserX, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ──────────────────────────────────────────────────────────────────

type AdminView = "job_seekers" | "hiring_managers" | "admins";

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

interface AdminRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  created_at: string | null;
}

// ─── Edge-function helper ────────────────────────────────────────────────────

async function callAdminManageUser(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
    },
  );
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

// ─── Add User Dialog ─────────────────────────────────────────────────────────

function AddUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("job_seeker");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail(""); setFullName(""); setRole("job_seeker");
    setPassword(""); setPhone(""); setUsername("");
  };

  const handleCreate = async () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    setLoading(true);
    try {
      await callAdminManageUser({
        action: "create",
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        password: password || undefined,
        phone: phone.trim() || undefined,
        username: username.trim() || undefined,
      });
      toast.success(`User ${email} created`);
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-accent" /> Add New User
          </DialogTitle>
          <DialogDescription>Create a new platform user and assign their role.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email <span className="text-destructive">*</span></Label>
            <Input id="new-email" type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Full Name</Label>
            <Input id="new-name" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-phone">Phone</Label>
            <Input id="new-phone" type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-username">Username <span className="text-muted-foreground text-xs">(optional — for login)</span></Label>
            <Input id="new-username" placeholder="janedoe" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger id="new-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="job_seeker">Job Seeker</SelectItem>
                <SelectItem value="recruiter">Hiring Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Temporary Password <span className="text-muted-foreground text-xs">(optional — leave blank to send a magic link)</span></Label>
            <Input id="new-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !email.trim()}>
            {loading ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  onClose,
  onUpdated,
}: {
  user: { user_id: string; email: string | null; full_name: string | null } | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEmail(user?.email ?? "");
    setFullName(user?.full_name ?? "");
    setPhone("");
    if (user?.user_id) {
      supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.user_id)
        .maybeSingle()
        .then(({ data }) => {
          setPhone((data as any)?.phone ?? "");
        });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!email.trim()) { toast.error("Email cannot be empty"); return; }
    setLoading(true);
    try {
      await callAdminManageUser({
        action: "update",
        userId: user.user_id,
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success("User updated successfully.");
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-accent" /> Edit User
          </DialogTitle>
          <DialogDescription>
            Update profile for <strong>{user?.full_name || "this user"}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input id="edit-name" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email <span className="text-destructive">*</span></Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone
            </Label>
            <Input id="edit-phone" type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || !email.trim()}>
            {loading ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteUserDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: { user_id: string; full_name: string | null; email: string | null } | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await callAdminManageUser({ action: "delete", userId: user.user_id });
      toast.success(`User ${user.email || user.user_id} removed`);
      onDeleted();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove user?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{user?.full_name || user?.email || user?.user_id}</strong> and all their data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {loading ? "Removing…" : "Remove User"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
  admins: {
    label: "Admins",
    icon: Shield,
    description: "Manage administrator accounts and platform access",
  },
};

// ─── User Activity Dialog ─────────────────────────────────────────────────────

function UserActivityDialog({
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
      (supabase as any).from("agent_runs").select("id, status, started_at, jobs_found, jobs_matched").eq("user_id", userId).order("started_at", { ascending: false }).limit(10),
      (supabase as any).from("analysis_history").select("id, created_at, score").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("job_applications").select("id, title, company, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
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
            <Activity className="w-4 h-4 text-accent" /> Activity History — {userName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Clock className="w-5 h-5 animate-spin text-accent" /></div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Agent Runs */}
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px] mb-2">Agent Runs ({agentRuns.length})</p>
              {agentRuns.length === 0 ? <p className="text-muted-foreground">No runs</p> : agentRuns.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="font-mono text-muted-foreground">{r.id.slice(0, 10)}…</span>
                  <span className={r.status === "completed" ? "text-success" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{r.status}</span>
                  <span>{r.jobs_found}f/{r.jobs_matched}m</span>
                  <span className="text-muted-foreground">{new Date(r.started_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            {/* Analyses */}
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px] mb-2">Analyses ({analyses.length})</p>
              {analyses.length === 0 ? <p className="text-muted-foreground">No analyses</p> : analyses.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="font-mono text-muted-foreground">{a.id.slice(0, 10)}…</span>
                  <span className="text-accent">{a.score != null ? `Score: ${a.score}` : "—"}</span>
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            {/* Applications */}
            <div>
              <p className="font-semibold text-muted-foreground uppercase text-[10px] mb-2">Applications ({applications.length})</p>
              {applications.length === 0 ? <p className="text-muted-foreground">No applications</p> : applications.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="truncate max-w-[160px]">{a.title || "Untitled"} @ {a.company || "Unknown"}</span>
                  <span className="text-muted-foreground">{a.status}</span>
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
  onEdit,
  onDelete,
  reloadKey,
  onRecordsLoaded,
}: {
  search: string;
  updatingId: string | null;
  onChangeRole: (userId: string, role: string) => void;
  onEdit: (user: { user_id: string; email: string | null; full_name: string | null }) => void;
  onDelete: (user: { user_id: string; email: string | null; full_name: string | null }) => void;
  reloadKey: number;
  onRecordsLoaded?: (users: { user_id: string; email: string | null; full_name: string | null }[]) => void;
}) {
  const [records, setRecords] = useState<JobSeekerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityUser, setActivityUser] = useState<{ user_id: string; name: string } | null>(null);
  const [disablingId, setDisablingId] = useState<string | null>(null);

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

      const merged: JobSeekerRecord[] = ((profilesRes.data as any[]) || [])
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          last_active_at: p.last_active_at,
          automation_mode: p.automation_mode ?? "manual",
          skills: p.skills,
          role: rolesMap.get(p.user_id) ?? "job_seeker",
          application_count: appCountMap.get(p.user_id) ?? 0,
          analysis_count: analysisCountMap.get(p.user_id) ?? 0,
        }))
        .filter((r) => r.role === "job_seeker");

      setRecords(merged);
      onRecordsLoaded?.(merged);
    } catch (e) {
      console.error("[AdminUsers] Failed to load users:", e);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const disableUser = async (userId: string) => {
    setDisablingId(userId);
    try {
      await callAdminManageUser({ action: "ban", userId });
      toast.success("User has been disabled");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to disable user");
    } finally {
      setDisablingId(null);
    }
  };

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

              {/* Activity / Disable / Edit / Remove */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-accent"
                title="View activity history"
                onClick={() => setActivityUser({ user_id: user.user_id, name: user.full_name || user.email || user.user_id })}
              >
                <Activity className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-warning"
                title="Disable user"
                disabled={disablingId === user.user_id}
                onClick={() => disableUser(user.user_id)}
              >
                <UserX className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Edit email"
                onClick={() => onEdit(user)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Remove user"
                onClick={() => onDelete(user)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {activityUser && (
        <UserActivityDialog
          userId={activityUser.user_id}
          userName={activityUser.name}
          open={!!activityUser}
          onClose={() => setActivityUser(null)}
        />
      )}
    </>
  );
}

// ─── Hiring Manager Panel ────────────────────────────────────────────────────

function HiringManagerPanel({
  search,
  updatingId,
  onChangeRole,
  onEdit,
  onDelete,
  reloadKey,
  onRecordsLoaded,
}: {
  search: string;
  updatingId: string | null;
  onChangeRole: (userId: string, role: string) => void;
  onEdit: (user: { user_id: string; email: string | null; full_name: string | null }) => void;
  onDelete: (user: { user_id: string; email: string | null; full_name: string | null }) => void;
  reloadKey: number;
  onRecordsLoaded?: (users: { user_id: string; email: string | null; full_name: string | null }[]) => void;
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
        supabase.from("profiles").select("user_id, full_name, email"),
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

      // All unique hiring users = anyone who has a job posting or is a recruiter
      const allHiringUserIds = new Set<string>([
        ...postingAgg.keys(),
        ...[...rolesMap.entries()]
          .filter(([, r]) => r === "recruiter")
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
      onRecordsLoaded?.(merged);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load hiring managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

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

              {/* Edit / Remove */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Edit email"
                onClick={() => onEdit(user)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Remove user"
                onClick={() => onDelete(user)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({
  search,
  updatingId,
  onChangeRole,
  onEdit,
  onDelete,
  reloadKey,
}: {
  search: string;
  updatingId: string | null;
  onChangeRole: (userId: string, role: string) => void;
  onEdit: (user: { user_id: string; email: string | null; full_name: string | null }) => void;
  onDelete: (user: { user_id: string; email: string | null; full_name: string | null }) => void;
  reloadKey: number;
}) {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, created_at")
        .eq("role", "admin" as any);

      const adminIds = ((rolesData as any[]) || []).map((r) => r.user_id);

      if (adminIds.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, username")
        .in("user_id", adminIds);

      const profileMap = new Map<string, { full_name: string | null; email: string | null; username: string | null }>();
      for (const p of ((profilesData as any[]) || [])) {
        profileMap.set(p.user_id, { full_name: p.full_name, email: p.email, username: p.username });
      }

      const merged: AdminRecord[] = ((rolesData as any[]) || []).map((r) => {
        const profile = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          username: profile?.username ?? null,
          created_at: r.created_at,
        };
      });

      setRecords(merged);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const filtered = records.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
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
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MiniStat label="Total Admins" value={records.length} icon={<Shield className="w-3.5 h-3.5" />} color="text-destructive" />
        <MiniStat label="With Username Login" value={records.filter((r) => !!r.username).length} icon={<UserCircle className="w-3.5 h-3.5" />} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No admin users found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border"
            >
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-destructive" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.full_name || "Unnamed Admin"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email || user.user_id.slice(0, 16) + "…"}
                </p>
              </div>

              {/* Username badge */}
              {user.username && (
                <Badge variant="outline" className="text-[10px] font-mono hidden sm:inline-flex">
                  @{user.username}
                </Badge>
              )}

              {/* Admin since */}
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
              </div>

              {/* Role badge — always admin */}
              <Badge className={ROLE_COLORS.admin}>
                <Shield className="w-3 h-3 mr-1" />
                admin
              </Badge>

              <RoleSelect
                userId={user.user_id}
                currentRole="admin"
                disabled={updatingId === user.user_id}
                onChangeRole={onChangeRole}
              />

              {/* Edit / Remove */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Edit user"
                onClick={() => onEdit(user)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Remove user"
                onClick={() => onDelete(user)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
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

type UserRef = { user_id: string; email: string | null; full_name: string | null };

export default function AdminUsers() {
  const [activeView, setActiveView] = useState<AdminView>("job_seekers");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Dialog state
  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState<UserRef | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRef | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Track the current panel's loaded records for bulk delete
  const [panelRecords, setPanelRecords] = useState<UserRef[]>([]);

  const meta = VIEW_META[activeView];

  const reload = () => setReloadKey((k) => k + 1);

  const changeRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole as any } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Role updated");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const results = await Promise.allSettled(
      panelRecords.map((user) => callAdminManageUser({ action: "delete", userId: user.user_id })),
    );
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false);
    setShowBulkDelete(false);
    if (successCount > 0) toast.success(`Deleted ${successCount} user${successCount !== 1 ? "s" : ""}.`);
    if (failCount > 0) toast.error(`Failed to delete ${failCount} user${failCount !== 1 ? "s" : ""}.`);
    reload();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{meta.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Add User button */}
          <Button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>

          {/* Delete All button – only for job seekers and hiring managers */}
          {activeView !== "admins" && (
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={() => setShowBulkDelete(true)}
              disabled={panelRecords.length === 0}
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </Button>
          )}

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
                  onClick={() => { setActiveView(key); setSearch(""); setPanelRecords([]); }}
                  className={activeView === key ? "bg-accent/10" : ""}
                >
                  <m.icon className="w-4 h-4 mr-2" />
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Divider with active view label */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            activeView === "admins"
              ? "bg-destructive/10 text-destructive border-destructive/30"
              : activeView === "job_seekers"
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
              onEdit={setEditUser}
              onDelete={setDeleteUser}
              reloadKey={reloadKey}
              onRecordsLoaded={setPanelRecords}
            />
          ) : activeView === "hiring_managers" ? (
            <HiringManagerPanel
              search={search}
              updatingId={updatingId}
              onChangeRole={changeRole}
              onEdit={setEditUser}
              onDelete={setDeleteUser}
              reloadKey={reloadKey}
              onRecordsLoaded={setPanelRecords}
            />
          ) : (
            <AdminPanel
              search={search}
              updatingId={updatingId}
              onChangeRole={changeRole}
              onEdit={setEditUser}
              onDelete={setDeleteUser}
              reloadKey={reloadKey}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddUserDialog
        open={showAddUser}
        onClose={() => setShowAddUser(false)}
        onCreated={reload}
      />
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onUpdated={reload}
      />
      <DeleteUserDialog
        user={deleteUser}
        onClose={() => setDeleteUser(null)}
        onDeleted={reload}
      />

      {/* Bulk Delete confirmation */}
      <AlertDialog open={showBulkDelete} onOpenChange={(v) => { if (!v && !bulkDeleting) setShowBulkDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all {meta.label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all <strong>{panelRecords.length}</strong> {meta.label.toLowerCase()} and all their data. This action <strong>cannot</strong> be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {bulkDeleting ? "Deleting…" : `Delete All ${panelRecords.length} Users`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

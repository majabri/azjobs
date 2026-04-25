import { useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Bot,
  FileText,
  UserCircle,
  Briefcase,
  Clock,
  Shield,
  Activity,
  UserX,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { callAdminManageUser } from "@/services/admin/userService";
import { JobSeekerRecord, UserRef } from "../types";
import { MiniStat, RoleSelect } from "../shared";
import { ROLE_COLORS } from "../constants";
import { UserActivityDialog } from "../dialogs/UserActivityDialog";

export function JobSeekerPanel({
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
  onEdit: (user: UserRef) => void;
  onDelete: (user: UserRef) => void;
  reloadKey: number;
  onRecordsLoaded?: (users: UserRef[]) => void;
}) {
  const [records, setRecords] = useState<JobSeekerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityUser, setActivityUser] = useState<{
    user_id: string;
    name: string;
  } | null>(null);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, appsRes, analysesRes] = await Promise.all([
        supabase
          .from("job_seeker_profiles")
          .select(
            "user_id, full_name, email, last_active_at, automation_mode, skills",
          ),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("job_applications").select("user_id"),
        supabase.from("analysis_history").select("user_id"),
      ]);

      const rolesMap = new Map<string, string>();
      for (const r of rolesRes.data || []) rolesMap.set(r.user_id, r.role);

      const appCountMap = new Map<string, number>();
      for (const a of appsRes.data || []) {
        appCountMap.set(a.user_id, (appCountMap.get(a.user_id) ?? 0) + 1);
      }

      const analysisCountMap = new Map<string, number>();
      for (const a of analysesRes.data || []) {
        analysisCountMap.set(
          a.user_id,
          (analysisCountMap.get(a.user_id) ?? 0) + 1,
        );
      }

      const merged: JobSeekerRecord[] = (profilesRes.data || [])
        .map((p) => ({
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
      logger.error("AdminUsers: failed to load records:", e);
    } finally {
      setLoading(false);
    }
  }, [onRecordsLoaded]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

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
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MiniStat
          label="Total"
          value={records.length}
          icon={<Users className="w-3.5 h-3.5" />}
        />
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

              <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {user.analysis_count}{" "}
                  analyses
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> {user.application_count}{" "}
                  apps
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {user.last_active_at
                  ? new Date(user.last_active_at).toLocaleDateString()
                  : "Never"}
              </div>

              <Badge
                className={ROLE_COLORS[user.role] || ROLE_COLORS.job_seeker}
              >
                {user.role === "admin" && <Shield className="w-3 h-3 mr-1" />}
                {user.role}
              </Badge>

              <RoleSelect
                userId={user.user_id}
                currentRole={user.role}
                disabled={updatingId === user.user_id}
                onChangeRole={onChangeRole}
              />

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-accent"
                title="View activity history"
                onClick={() =>
                  setActivityUser({
                    user_id: user.user_id,
                    name: user.full_name || user.email || user.user_id,
                  })
                }
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

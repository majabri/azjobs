import { useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, Calendar, Target, Clock, Shield, Briefcase, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { HiringManagerRecord, UserRef } from "../types";
import { MiniStat, RoleSelect, ROLE_COLORS } from "../shared";

export function HiringManagerPanel({
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

      const rolesMap = new Map<string, string>();
      for (const r of rolesRes.data || []) rolesMap.set(r.user_id, r.role);

      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      for (const p of (profilesRes.data as any[] || [])) {
        profileMap.set(p.user_id, { full_name: p.full_name, email: p.email });
      }

      type PostingAgg = { count: number; matched: number; latest: string | null };
      const postingAgg = new Map<string, PostingAgg>();
      for (const p of (postingsRes.data || [])) {
        const existing = postingAgg.get(p.user_id) ?? { count: 0, matched: 0, latest: null };
        existing.count += 1;
        existing.matched += p.candidates_matched ?? 0;
        if (!existing.latest || p.created_at > existing.latest) existing.latest = p.created_at;
        postingAgg.set(p.user_id, existing);
      }

      const interviewCount = new Map<string, number>();
      for (const i of (interviewsRes.data || [])) {
        interviewCount.set(i.user_id, (interviewCount.get(i.user_id) ?? 0) + 1);
      }

      const allHiringUserIds = new Set<string>([
        ...postingAgg.keys(),
        ...[...rolesMap.entries()].filter(([, r]) => r === "recruiter").map(([uid]) => uid),
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

      merged.sort((a, b) => b.job_posting_count - a.job_posting_count);
      setRecords(merged);
      onRecordsLoaded?.(merged);
    } catch (e) {
      logger.error(e);
      toast.error("Failed to load hiring managers");
    } finally {
      setLoading(false);
    }
  }, [onRecordsLoaded]);

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

              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {user.latest_posting_at
                  ? new Date(user.latest_posting_at).toLocaleDateString()
                  : "No postings"}
              </div>

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

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, Search, Clock, Shield, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  last_active_at: string | null;
  automation_mode: string;
  skills: string[] | null;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  recruiter: "bg-accent/10 text-accent border-accent/20",
  job_seeker: "bg-muted text-muted-foreground border-border",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filtered, setFiltered] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.user_id.includes(q)
      );
    }
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    setFiltered(result);
  }, [search, roleFilter, users]);

  const load = async () => {
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("job_seeker_profiles").select(
          "user_id, full_name, email, last_active_at, automation_mode, skills"
        ),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const rolesMap = new Map<string, string>();
      for (const r of rolesRes.data || []) {
        rolesMap.set(r.user_id, r.role);
      }

      const merged: UserRecord[] = ((profilesRes.data as any[]) || []).map((p: any) => ({
        ...p,
        role: rolesMap.get(p.user_id) ?? "job_seeker",
      }));

      setUsers(merged);
      setFiltered(merged);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole, updated_at: new Date().toISOString() });
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );
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
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users.length} registered users
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or ID…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="recruiter">Recruiter</SelectItem>
            <SelectItem value="job_seeker">Job Seeker</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} size="sm">
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" /> Users ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Clock className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No users found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center gap-4 p-3 bg-muted/20 rounded-lg border border-border"
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

                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {user.last_active_at
                      ? new Date(user.last_active_at).toLocaleDateString()
                      : "Never"}
                  </div>

                  <Badge className={ROLE_COLORS[user.role] || ROLE_COLORS.job_seeker}>
                    {user.role === "admin" && <Shield className="w-3 h-3 mr-1" />}
                    {user.role}
                  </Badge>

                  <Select
                    value={user.role}
                    onValueChange={(v) => changeRole(user.user_id, v)}
                    disabled={updatingId === user.user_id}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

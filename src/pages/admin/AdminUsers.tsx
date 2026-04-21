import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, ChevronDown, UserPlus, Trash2, Target, Briefcase, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";

import { callAdminManageUser } from "@/services/admin/userService";
import { AdminView, UserRef } from "@/components/admin/users/types";
import { AddUserDialog } from "@/components/admin/users/dialogs/AddUserDialog";
import { EditUserDialog } from "@/components/admin/users/dialogs/EditUserDialog";
import { DeleteUserDialog } from "@/components/admin/users/dialogs/DeleteUserDialog";
import { JobSeekerPanel } from "@/components/admin/users/panels/JobSeekerPanel";
import { HiringManagerPanel } from "@/components/admin/users/panels/HiringManagerPanel";
import { AdminPanel } from "@/components/admin/users/panels/AdminPanel";

const VIEW_META: Record<AdminView, { label: string; icon: typeof Target; description: string }> = {
  job_seekers: { label: "Job Seekers", icon: Target, description: "Manage job seeker profiles, automation settings, and activity" },
  hiring_managers: { label: "Hiring Managers", icon: Briefcase, description: "Manage recruiter accounts, job postings, and interview pipelines" },
  admins: { label: "Admins", icon: Shield, description: "Manage administrator accounts and platform access" },
};

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
        .upsert({ user_id: userId, role: newRole as Database["public"]["Enums"]["app_role"] }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Role updated");
      reload();
    } catch (e) {
      logger.error(e);
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
          <Button onClick={() => setShowAddUser(true)} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add User
          </Button>

          {activeView !== "admins" && (
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={() => setShowBulkDelete(true)}
              disabled={panelRecords.length === 0}
            >
              <Trash2 className="w-4 h-4" /> Delete All
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 min-w-[200px] justify-between">
                <span className="flex items-center gap-2"><meta.icon className="w-4 h-4" />{meta.label}</span>
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
                  <m.icon className="w-4 h-4 mr-2" />{m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Divider */}
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
          <meta.icon className="w-3.5 h-3.5" /> {meta.label} Administration
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${meta.label.toLowerCase()} by name, email, or ID…`}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <meta.icon className="w-4 h-4 text-accent" /> {meta.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeView === "job_seekers" ? (
            <JobSeekerPanel search={search} updatingId={updatingId} onChangeRole={changeRole} onEdit={setEditUser} onDelete={setDeleteUser} reloadKey={reloadKey} onRecordsLoaded={setPanelRecords} />
          ) : activeView === "hiring_managers" ? (
            <HiringManagerPanel search={search} updatingId={updatingId} onChangeRole={changeRole} onEdit={setEditUser} onDelete={setDeleteUser} reloadKey={reloadKey} onRecordsLoaded={setPanelRecords} />
          ) : (
            <AdminPanel search={search} updatingId={updatingId} onChangeRole={changeRole} onEdit={setEditUser} onDelete={setDeleteUser} reloadKey={reloadKey} />
          )}
        </CardContent>
      </Card>

      <AddUserDialog open={showAddUser} onClose={() => setShowAddUser(false)} onCreated={reload} />
      <EditUserDialog user={editUser} onClose={() => setEditUser(null)} onUpdated={reload} />
      <DeleteUserDialog user={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={reload} />

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
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive hover:bg-destructive/90 text-white">
              {bulkDeleting ? "Deleting…" : `Delete All ${panelRecords.length} Users`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

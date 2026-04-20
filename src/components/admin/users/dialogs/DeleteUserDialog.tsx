import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { callAdminManageUser } from "@/services/admin/userService";
import { UserRef } from "../types";

export function DeleteUserDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: UserRef | null;
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

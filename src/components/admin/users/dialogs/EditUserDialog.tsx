import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { callAdminManageUser } from "@/services/admin/userService";
import { UserRef } from "../types";

export function EditUserDialog({
  user,
  onClose,
  onUpdated,
}: {
  user: UserRef | null;
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
          setPhone(data?.phone ?? "");
        });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!email.trim()) {
      toast.error("Email cannot be empty");
      return;
    }
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
    <Dialog
      open={!!user}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-accent" /> Edit User
          </DialogTitle>
          <DialogDescription>
            Update profile for <strong>{user?.full_name || "this user"}</strong>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone
            </Label>
            <Input
              id="edit-phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !email.trim()}>
            {loading ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

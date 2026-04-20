import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { callAdminManageUser } from "@/services/admin/userService";

export function AddUserDialog({
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

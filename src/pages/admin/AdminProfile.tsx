import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Save, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";
import { logger } from "@/lib/logger";

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  username: string;
}

export default function AdminProfile() {
  const { user } = useAuthReady();
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    email: "",
    phone: "",
    username: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProfile intentionally excluded; mount-only fetch
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone, username")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;

      setProfile({
        full_name: data?.full_name ?? "",
        email: data?.email ?? user?.email ?? "",
        phone: data?.phone ?? "",
        username: data?.username ?? "",
      });
    } catch (e) {
      logger.error(e);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name || null,
          email: profile.email || null,
          phone: profile.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Profile updated");
    } catch (e) {
      logger.error(e);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange =
    (field: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setProfile((prev) => ({ ...prev, [field]: e.target.value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            My Profile
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your admin account details
          </p>
        </div>
        <Button
          size="sm"
          className="gradient-indigo text-white"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* FIX 3.15.2: Auth / Login Email card â read-only, sourced from Supabase Auth */}
      <Card className="border-accent/20 bg-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            Login Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="auth_email">Login Email (Supabase Auth)</Label>
            <Input
              id="auth_email"
              type="email"
              value={user?.email ?? ""}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              This is the email used to sign in. It cannot be changed from this
              page.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-accent" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={profile.full_name}
              onChange={handleFieldChange("full_name")}
              placeholder="Your full name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Contact Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={handleFieldChange("email")}
              placeholder="admin@example.com"
            />
            <p className="text-xs text-muted-foreground">
              This is the contact email stored in your profile. It may differ
              from your login email.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={profile.phone}
              onChange={handleFieldChange("phone")}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={profile.username}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Username cannot be changed here. Contact the system owner to
              update it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

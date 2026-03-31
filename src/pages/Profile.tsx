import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProfileForm, { type ProfileData, emptyProfile } from "@/components/profile/ProfileForm";
import ResumeVault from "@/components/profile/ResumeVault";
import PortfolioEditor from "@/components/PortfolioEditor";
import ProfilePdfExport from "@/components/ProfilePdfExport";
import ReferralDashboard from "@/components/ReferralDashboard";
import EmailPreferences from "@/components/EmailPreferences";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("job_seeker_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          location: data.location || "",
          summary: data.summary || "",
          linkedin_url: (data as any).linkedin_url || "",
          skills: (data.skills as string[]) || [],
          work_experience: (data.work_experience as unknown as any[]) || [],
          education: (data.education as unknown as any[]) || [],
          certifications: (data.certifications as string[]) || [],
          preferred_job_types: (data.preferred_job_types as string[]) || [],
          career_level: data.career_level || "",
          target_job_titles: (data.target_job_titles as string[]) || [],
          salary_min: data.salary_min || "",
          salary_max: data.salary_max || "",
          remote_only: data.remote_only || false,
          min_match_score: data.min_match_score ?? 60,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load profile");
    } finally { setLoading(false); }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-my-data`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      if (!resp.ok) {
        const json = await resp.json();
        throw new Error(json.error ?? "Failed to export data");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my_data_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data has been exported.");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-own-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? "Failed to delete account");
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete account");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const payload = {
        user_id: session.user.id,
        full_name: profile.full_name || null,
        email: profile.email || null,
        phone: profile.phone || null,
        location: profile.location || null,
        summary: profile.summary || null,
        linkedin_url: profile.linkedin_url || null,
        skills: profile.skills.length ? profile.skills : null,
        work_experience: profile.work_experience.length ? profile.work_experience : null,
        education: profile.education.length ? profile.education : null,
        certifications: profile.certifications.length ? profile.certifications : null,
        preferred_job_types: profile.preferred_job_types.length ? profile.preferred_job_types : null,
        career_level: profile.career_level || null,
        target_job_titles: profile.target_job_titles.length ? profile.target_job_titles : null,
        salary_min: profile.salary_min || null,
        salary_max: profile.salary_max || null,
        remote_only: profile.remote_only,
        min_match_score: profile.min_match_score,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("job_seeker_profiles").upsert(payload as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Profile saved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save profile");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-8 pt-6">
        <ProfileForm profile={profile} setProfile={setProfile} onSave={handleSave} saving={saving} />
        <ResumeVault />
        <PortfolioEditor />
        <div className="grid gap-6 sm:grid-cols-2">
          <ReferralDashboard />
          <EmailPreferences />
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export My Data
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete My Account
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Account confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(v) => { if (!v && !deleting) setShowDeleteDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, profile, and all associated data. This action <strong>cannot</strong> be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

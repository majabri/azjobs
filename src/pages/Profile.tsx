import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProfileForm from "@/components/profile/ProfileForm";
import ResumeVault from "@/components/profile/ResumeVault";
import PortfolioEditor from "@/components/PortfolioEditor";
import ProfilePdfExport from "@/components/ProfilePdfExport";
import ReferralDashboard from "@/components/ReferralDashboard";
import EmailPreferences from "@/components/EmailPreferences";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logger } from "@/lib/logger";
import { type ProfileFormValues } from "@/lib/schemas/profile.schema";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState<ProfileFormValues | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("job_seeker_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;

      setInitialData({
        full_name: data?.full_name || "",
        email: data?.email || "",
        phone: data?.phone || "",
        location: data?.location || "",
        summary: data?.summary || "",
        linkedin_url: data?.linkedin_url || "",
        skills: (data?.skills as unknown as string[]) || [],
        work_experience: (data?.work_experience as any) || [],
        education: (data?.education as any) || [],
        certifications: (data?.certifications as unknown as string[]) || [],
        preferred_job_types:
          (data?.preferred_job_types as unknown as string[]) || [],
        career_level: data?.career_level || "",
        target_job_titles:
          (data?.target_job_titles as unknown as string[]) || [],
        salary_min: data?.salary_min || "",
        salary_max: data?.salary_max || "",
        remote_only: data?.remote_only || false,
        min_match_score: data?.min_match_score ?? 60,
        search_mode: data?.search_mode || "balanced",
      });
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        return;
      }
      const { data: exportData, error: exportError } =
        await supabase.functions.invoke("export-my-data", {
          method: "GET",
        });
      if (exportError)
        throw new Error(exportError.message ?? "Failed to export data");
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        return;
      }
      const { error: deleteError } = await supabase.functions.invoke(
        "delete-own-account",
        {
          body: {},
        },
      );
      if (deleteError)
        throw new Error(deleteError.message ?? "Failed to delete account");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-8 pt-6">
        {initialData && <ProfileForm initialData={initialData} />}
        <ResumeVault />
        <PortfolioEditor />
        <div className="grid gap-6 sm:grid-cols-2">
          <ReferralDashboard />
          <EmailPreferences />
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-destructive">
            Danger Zone
          </h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}{" "}
              Export My Data
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" /> Delete My Account
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(v) => {
          if (!v && !deleting) setShowDeleteDialog(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, profile, and all
              associated data. This action <strong>cannot</strong> be undone.
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

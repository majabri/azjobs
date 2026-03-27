import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProfileForm, { type ProfileData, emptyProfile } from "@/components/profile/ProfileForm";
import ResumeVault from "@/components/profile/ResumeVault";
import PortfolioEditor from "@/components/PortfolioEditor";
import ProfilePdfExport from "@/components/ProfilePdfExport";
import ReferralDashboard from "@/components/ReferralDashboard";
import EmailPreferences from "@/components/EmailPreferences";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      </div>
    </div>
  );
}

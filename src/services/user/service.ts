/**
 * User Service — Core logic for user profile management.
 * Owns: profile CRUD, auth state, public profiles.
 * No imports from job, matching, or application services.
 */

import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "./types";

export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("job_seeker_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
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
  };
}

export async function saveUserProfile(userId: string, profile: UserProfile): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    user_id: userId,
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
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

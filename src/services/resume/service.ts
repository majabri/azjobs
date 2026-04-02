/**
 * Resume Service — Core logic.
 * Owns: resume storage, versioning, parsing.
 * No imports from other services.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ResumeVersion } from "./types";

export async function loadResumeVersions(userId: string): Promise<ResumeVersion[]> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[ResumeService]", error); return []; }
  return (data || []) as unknown as ResumeVersion[];
}

export async function saveResumeVersion(userId: string, name: string, text: string, jobType?: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("resume_versions").insert({
    user_id: userId,
    version_name: name,
    resume_text: text,
    job_type: jobType || null,
  } as any);
  return { ok: !error };
}

export async function deleteResumeVersion(id: string): Promise<void> {
  await supabase.from("resume_versions").delete().eq("id", id);
}

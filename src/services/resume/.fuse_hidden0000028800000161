/**
 * Resume Service — Core logic.
 * Owns: resume storage, versioning, parsing.
 * No imports from other services.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ResumeVersion } from "./types";
import { logger } from '@/lib/logger';

export async function loadResumeVersions(userId: string): Promise<ResumeVersion[]> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { logger.error("[ResumeService]", error); return []; }
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

/**
 * Optimize resume against a set of job descriptions using the AI edge function.
 * Returns an optimized resume text, or null if optimization fails.
 * Called only from the orchestrator — never directly by other services.
 */
export async function optimize(jobDescriptions: string[]): Promise<string | null> {
  logger.info("[ResumeService] optimize() called for", jobDescriptions.length, "jobs");
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { logger.warn("[ResumeService] No session for optimize"); return null; }

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rewrite-resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobDescriptions }),
      }
    );
    if (!resp.ok) { logger.error("[ResumeService] optimize failed:", resp.status); return null; }
    const data = await resp.json();
    return data.resumeText ?? null;
  } catch (e) {
    logger.error("[ResumeService] optimize error:", e);
    return null;
  }
}

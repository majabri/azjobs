/**
 * Application Service — Core logic.
 * Owns: application tracking, offers, follow-ups.
 * No imports from job or matching services.
 */

import { supabase } from "@/integrations/supabase/client";
import type { JobApplication } from "./types";
import { logger } from "@/lib/logger";

export async function loadApplications(): Promise<JobApplication[]> {
  const { data } = await supabase
    .from("job_applications")
    .select("*")
    .order("applied_at", { ascending: false });
  return (data || []) as unknown as JobApplication[];
}

export async function updateApplicationStatus(
  id: string,
  status: string,
): Promise<void> {
  await supabase
    .from("job_applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteApplication(id: string): Promise<void> {
  await supabase.from("job_applications").delete().eq("id", id);
}

export async function setFollowUp(
  id: string,
  date: string,
  notes: string,
): Promise<void> {
  await supabase
    .from("job_applications")
    .update({
      follow_up_date: new Date(date).toISOString(),
      follow_up_notes: notes,
      followed_up: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function markFollowedUp(id: string): Promise<void> {
  await supabase
    .from("job_applications")
    .update({ followed_up: true, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export interface ApplyPayload {
  title: string;
  company: string;
  url: string;
  resumeText?: string | null;
}

/**
 * Submit job applications using the agent-orchestrator edge function.
 * Called only from the orchestrator — never directly by other services.
 * Returns the number of applications successfully submitted.
 */
export async function apply(jobs: ApplyPayload[]): Promise<number> {
  logger.info("[ApplicationService] apply() called for", jobs.length, "jobs");
  if (jobs.length === 0) return 0;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      logger.warn("[ApplicationService] No session for apply");
      return 0;
    }

    const { data, error: fnError } = await supabase.functions.invoke(
      "agent-orchestrator",
      {
        body: { action: "apply", jobs },
      },
    );
    if (fnError) {
      logger.error("[ApplicationService] apply failed:", fnError.message);
      return 0;
    }
    return data?.applied ?? 0;
  } catch (e) {
    logger.error("[ApplicationService] apply error:", e);
    return 0;
  }
}

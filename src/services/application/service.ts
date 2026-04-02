/**
 * Application Service — Core logic.
 * Owns: application tracking, offers, follow-ups.
 * No imports from job or matching services.
 */

import { supabase } from "@/integrations/supabase/client";
import type { JobApplication } from "./types";

export async function loadApplications(): Promise<JobApplication[]> {
  const { data } = await supabase
    .from("job_applications")
    .select("*")
    .order("applied_at", { ascending: false });
  return (data || []) as unknown as JobApplication[];
}

export async function updateApplicationStatus(id: string, status: string): Promise<void> {
  await supabase.from("job_applications")
    .update({ status, updated_at: new Date().toISOString() } as any)
    .eq("id", id);
}

export async function deleteApplication(id: string): Promise<void> {
  await supabase.from("job_applications").delete().eq("id", id);
}

export async function setFollowUp(id: string, date: string, notes: string): Promise<void> {
  await supabase.from("job_applications").update({
    follow_up_date: new Date(date).toISOString(),
    follow_up_notes: notes,
    followed_up: false,
    updated_at: new Date().toISOString(),
  } as any).eq("id", id);
}

export async function markFollowedUp(id: string): Promise<void> {
  await supabase.from("job_applications")
    .update({ followed_up: true, updated_at: new Date().toISOString() } as any)
    .eq("id", id);
}

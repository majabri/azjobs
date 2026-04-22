import { supabase } from "@/integrations/supabase/client";

export interface IgnoredJob {
  id: string;
  job_title: string;
  company: string;
  job_url: string | null;
}

export async function getIgnoredJobs(): Promise<IgnoredJob[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from("ignored_jobs")
    .select("id, job_title, company, job_url")
    .eq("user_id", session.user.id);
  return (data as unknown as IgnoredJob[]) || [];
}

export async function ignoreJob(input: {
  title: string;
  company: string;
  url?: string | null;
}): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  const { error } = await supabase.from("ignored_jobs").insert({
    user_id: session.user.id,
    job_title: input.title.trim(),
    company: input.company.trim(),
    job_url: input.url?.trim() || null,
  });
  return !error;
}

export async function unignoreJob(id: string): Promise<boolean> {
  const { error } = await supabase.from("ignored_jobs").delete().eq("id", id);
  return !error;
}

export function isJobIgnored(
  job: { title: string; company: string; url?: string | null },
  ignoredList: IgnoredJob[],
): boolean {
  const jTitle = job.title.trim().toLowerCase();
  const jCompany = job.company.trim().toLowerCase();
  const jUrl = (job.url || "").trim().toLowerCase();

  return ignoredList.some((ignored) => {
    if (
      jUrl &&
      ignored.job_url &&
      ignored.job_url.trim().toLowerCase() === jUrl
    )
      return true;
    return (
      ignored.job_title.trim().toLowerCase() === jTitle &&
      ignored.company.trim().toLowerCase() === jCompany
    );
  });
}

export function isJobAlreadySaved(
  job: { title: string; company: string; url?: string | null },
  savedApps: { job_title: string; company: string; job_url: string | null }[],
): boolean {
  const jTitle = job.title.trim().toLowerCase();
  const jCompany = job.company.trim().toLowerCase();
  const jUrl = (job.url || "").trim().toLowerCase();

  return savedApps.some((app) => {
    if (jUrl && app.job_url && app.job_url.trim().toLowerCase() === jUrl)
      return true;
    return (
      app.job_title.trim().toLowerCase() === jTitle &&
      app.company.trim().toLowerCase() === jCompany
    );
  });
}

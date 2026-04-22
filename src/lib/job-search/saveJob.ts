import { supabase } from "@/integrations/supabase/client";

export type SaveJobInput = {
  title: string;
  company: string;
  url?: string | null;
  description?: string | null;
  location?: string | null;
  type?: string | null;
};

export async function saveJobToApplications(input: SaveJobInput): Promise<{
  ok: boolean;
  alreadySaved?: boolean;
  error?: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "Please sign in to save jobs" };
  }

  const normalizedTitle = (input.title || "").trim();
  const normalizedCompany = (input.company || "").trim();
  const normalizedUrl = (input.url || "").trim();

  if (!normalizedTitle || !normalizedCompany) {
    return { ok: false, error: "Missing job title or company" };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("job_applications")
    .select("id, job_title, company, job_url")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  const alreadyExists = (existingRows || []).some((row) => {
    const sameUrl =
      normalizedUrl &&
      row.job_url &&
      row.job_url.trim().toLowerCase() === normalizedUrl.toLowerCase();
    const sameTitleCompany =
      row.job_title.trim().toLowerCase() === normalizedTitle.toLowerCase() &&
      row.company.trim().toLowerCase() === normalizedCompany.toLowerCase();
    return Boolean(sameUrl || sameTitleCompany);
  });

  if (alreadyExists) {
    return { ok: true, alreadySaved: true };
  }

  const notesParts = [
    "Saved from Job Search",
    input.location ? `Location: ${input.location}` : "",
    input.type ? `Type: ${input.type}` : "",
    input.description ? input.description.slice(0, 240) : "",
  ].filter(Boolean);

  const { error: insertError } = await supabase
    .from("job_applications")
    .insert({
      user_id: session.user.id,
      job_title: normalizedTitle,
      company: normalizedCompany,
      job_url: normalizedUrl || null,
      status: "saved",
      notes: notesParts.join("\n"),
    });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

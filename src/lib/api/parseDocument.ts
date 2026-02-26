import { supabase } from "@/integrations/supabase/client";

export async function parseDocument(file: File): Promise<{ success: boolean; text?: string; error?: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const { data: { session } } = await supabase.auth.getSession();

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/parse-document`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    return { success: false, error: errData?.error || `Request failed with status ${response.status}` };
  }

  return response.json();
}

import { supabase } from "@/integrations/supabase/client";

export async function scrapeUrl(url: string): Promise<{ success: boolean; markdown?: string; title?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('scrape-url', {
    body: { url },
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return data;
}

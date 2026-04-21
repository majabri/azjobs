import { supabase } from "@/integrations/supabase/client";

export interface ScrapeResult {
  success: boolean;
  markdown?: string;
  title?: string;
  error?: string;
  /** True when extraction failed — UI should prompt manual paste */
  extractionFailed?: boolean;
  /** Partial text extracted before validation failed */
  partialText?: string;
  /** True when the Cheerio fallback extractor was used instead of the primary */
  usedFallback?: boolean;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-url', {
    body: { url },
  });

  if (error) {
    return { success: false, error: error.message, extractionFailed: true };
  }
  return data;
}

/**
 * Job Service — Benefits extraction and matching.
 * Extracts benefits from job descriptions using keyword matching against the benefits catalog.
 */

import { supabase } from "@/integrations/supabase/client";

export interface BenefitMatch {
  catalogId: string;
  category: string;
  label: string;
}

interface CatalogEntry {
  id: string;
  category: string;
  label: string;
  keywords: string[];
}

let catalogCache: CatalogEntry[] | null = null;

/** Load benefits catalog (cached) */
async function loadCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return catalogCache;
  const { data, error } = await supabase
    .from("benefits_catalog")
    .select("id, category, label, keywords");
  if (error || !data) return [];
  catalogCache = data.map((row) => ({
    id: row.id,
    category: row.category,
    label: row.label,
    keywords: (row.keywords as string[]) || [],
  }));
  return catalogCache;
}

/** Extract benefits from a job description text */
export async function extractBenefits(
  description: string,
): Promise<BenefitMatch[]> {
  const catalog = await loadCatalog();
  if (!catalog.length) return [];

  const descLower = description.toLowerCase();
  const matches: BenefitMatch[] = [];

  for (const entry of catalog) {
    const found = entry.keywords.some((kw) =>
      descLower.includes(kw.toLowerCase()),
    );
    if (found) {
      matches.push({
        catalogId: entry.id,
        category: entry.category,
        label: entry.label,
      });
    }
  }

  return matches;
}

/** Score how well a job's benefits match user preferences */
export function scoreBenefitsMatch(
  jobBenefits: BenefitMatch[],
  userPreferredCategories: string[],
): number {
  if (!userPreferredCategories.length || !jobBenefits.length) return 0;

  const jobCategories = new Set(jobBenefits.map((b) => b.category));
  const matchCount = userPreferredCategories.filter((c) =>
    jobCategories.has(c),
  ).length;

  // +10 points max for benefits match
  return Math.min(
    10,
    Math.round((matchCount / userPreferredCategories.length) * 10),
  );
}

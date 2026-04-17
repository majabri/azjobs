// Lever ATS adapter
// Docs: https://hire.lever.co/developer/postings
// GET https://api.lever.co/v0/postings/{company_id}?mode=json&skip=0&limit=50
//
// Lever's public postings API requires no auth key — it is explicitly
// published for job aggregators. Each company has its own slug.

import { BoardAdapter, SearchParams, AdapterResult, NormalisedJob } from '../types.ts';
import { politeFetch, htmlToText, parseSalary, matchesSearch } from '../helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LeverPosting {
  id: string;
  text: string;          // job title
  hostedUrl: string;
  applyUrl?: string;
  createdAt: number;     // epoch ms
  categories?: {
    commitment?: string; // employment type  e.g. "Full-time"
    location?: string;
    team?: string;
    department?: string;
  };
  description?: string;        // HTML
  descriptionPlain?: string;   // plain text (not always present)
  additional?: string;         // HTML — requirements / extra details
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
}

function mapCommitment(c: string | undefined): NormalisedJob['employment_type'] {
  if (!c) return null;
  const l = c.toLowerCase();
  if (l.includes('full'))    return 'full_time';
  if (l.includes('part'))    return 'part_time';
  if (l.includes('contract') || l.includes('freelance')) return 'contract';
  if (l.includes('intern'))  return 'internship';
  return null;
}

function detectRemoteType(location: string | undefined): NormalisedJob['remote_type'] {
  if (!location) return null;
  const l = location.toLowerCase();
  if (l.includes('remote')) return 'remote';
  if (l.includes('hybrid')) return 'hybrid';
  return 'onsite';
}

export const leverAdapter: BoardAdapter = {
  board_id: 'lever',

  async search(params: SearchParams): Promise<AdapterResult> {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: companies } = await supabase
      .from('discovery_company_sources')
      .select('company_slug, display_name')
      .eq('ats', 'lever')
      .eq('enabled', true);

    const all: NormalisedJob[] = [];
    const wanted = params.results_wanted ?? 25;
    let lastStatus = 200;

    // Cap to 5 companies per run — Lever's API can be slow (3-8s per company)
    // and the edge function has a wall-clock limit. Each fetch uses an 8s timeout.
    const MAX_COMPANIES = 5;
    const companyList = (companies ?? []).slice(0, MAX_COMPANIES);

    for (const c of companyList) {
      if (all.length >= wanted) break;

      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(c.company_slug)}?mode=json&limit=50`;
      const res = await politeFetch(url, {}, 8_000);
      lastStatus = res.status;

      if (!res.ok) continue;

      const postings = (await res.json()) as LeverPosting[];

      for (const p of postings) {
        if (all.length >= wanted) break;

        // Combine description + additional for full text
        const descHtml = [p.description, p.additional].filter(Boolean).join('\n');
        const descPlain =
          p.descriptionPlain ?? p.additionalPlain ?? htmlToText(descHtml);

        if (!matchesSearch({ title: p.text, description: descPlain }, params.search_term)) continue;

        const salary = parseSalary(descPlain);
        const loc = p.categories?.location;

        all.push({
          source_board: 'lever',
          source_url: p.hostedUrl,
          external_id: p.id,
          title: p.text,
          company: c.display_name ?? c.company_slug,
          location: loc ?? null,
          remote_type: detectRemoteType(loc),
          employment_type: mapCommitment(p.categories?.commitment),
          salary_min: salary.min,
          salary_max: salary.max,
          salary_currency: salary.currency,
          description: descPlain,
          description_html: descHtml || null,
          posted_at: p.createdAt ? new Date(p.createdAt).toISOString() : null,
          raw_payload: p as unknown as Record<string, unknown>,
        });
      }

      await supabase
        .from('discovery_company_sources')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('ats', 'lever')
        .eq('company_slug', c.company_slug);
    }

    return { jobs: all, http_status: lastStatus, fetched_at: new Date().toISOString() };
  },
};

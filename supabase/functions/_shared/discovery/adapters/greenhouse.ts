// Greenhouse ATS adapter
// Docs: https://developers.greenhouse.io/job-board.html
// GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
//
// Greenhouse is an employer ATS — companies publish their own job boards here
// via a first-party, documented JSON API. No ToS ambiguity, no DOM fragility.

import { BoardAdapter, SearchParams, AdapterResult, NormalisedJob } from '../types.ts';
import { politeFetch, htmlToText, parseSalary, matchesSearch } from '../helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface GhJob {
  id: number;
  internal_job_id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
  content?: string;   // HTML, may contain HTML entity encoding
  departments?: { name: string }[];
  offices?: { name: string }[];
}

function detectRemoteType(location: string | undefined): NormalisedJob['remote_type'] {
  if (!location) return null;
  const l = location.toLowerCase();
  if (l.includes('remote')) return 'remote';
  if (l.includes('hybrid')) return 'hybrid';
  return 'onsite';
}

function decodeHtmlEntities(html: string): string {
  // Greenhouse occasionally double-encodes entities in the content field.
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export const greenhouseAdapter: BoardAdapter = {
  board_id: 'greenhouse',

  async search(params: SearchParams): Promise<AdapterResult> {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: companies } = await supabase
      .from('discovery_company_sources')
      .select('company_slug, display_name')
      .eq('ats', 'greenhouse')
      .eq('enabled', true);

    const all: NormalisedJob[] = [];
    const wanted = params.results_wanted ?? 25;
    let lastStatus = 200;

    for (const c of companies ?? []) {
      if (all.length >= wanted) break;

      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(c.company_slug)}/jobs?content=true`;
      const res = await politeFetch(url);
      lastStatus = res.status;

      if (!res.ok) continue;

      const payload = (await res.json()) as { jobs: GhJob[] };

      for (const job of payload.jobs ?? []) {
        if (all.length >= wanted) break;

        const contentDecoded = job.content ? decodeHtmlEntities(job.content) : null;
        const description = htmlToText(contentDecoded);

        if (!matchesSearch({ title: job.title, description }, params.search_term)) continue;

        const salary = parseSalary(description);

        all.push({
          source_board: 'greenhouse',
          source_url: job.absolute_url,
          external_id: String(job.id),
          title: job.title,
          company: c.display_name ?? c.company_slug,
          location: job.location?.name ?? null,
          remote_type: detectRemoteType(job.location?.name),
          employment_type: null,
          salary_min: salary.min,
          salary_max: salary.max,
          salary_currency: salary.currency,
          description,
          description_html: contentDecoded,
          posted_at: job.first_published ?? job.updated_at ?? null,
          raw_payload: job as unknown as Record<string, unknown>,
        });
      }

      // Touch last_polled_at regardless of whether we got results.
      await supabase
        .from('discovery_company_sources')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('ats', 'greenhouse')
        .eq('company_slug', c.company_slug);
    }

    return { jobs: all, http_status: lastStatus, fetched_at: new Date().toISOString() };
  },
};

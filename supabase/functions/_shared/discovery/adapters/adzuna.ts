// Adzuna adapter — official REST API (free tier available)
// Docs: https://developer.adzuna.com/
// Requires: ADZUNA_APP_ID + ADZUNA_APP_KEY env vars in Supabase secrets.
// Enable by setting feature flag discovery_board_adzuna = true.

import { BoardAdapter, SearchParams, AdapterResult, NormalisedJob } from '../types.ts';
import { politeFetch, parseSalary, htmlToText, matchesSearch } from '../helpers.ts';

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area?: string[] };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;   // 'full_time' | 'part_time' | 'contract'
  created: string;          // ISO date
}

export const adzunaAdapter: BoardAdapter = {
  board_id: 'adzuna',

  async search(params: SearchParams): Promise<AdapterResult> {
    const appId  = Deno.env.get('ADZUNA_APP_ID');
    const appKey = Deno.env.get('ADZUNA_APP_KEY');

    if (!appId || !appKey) {
      console.warn('[adzuna] ADZUNA_APP_ID or ADZUNA_APP_KEY not set — skipping');
      return { jobs: [], http_status: 0, fetched_at: new Date().toISOString() };
    }

    const country = 'us';  // TODO: derive from location param
    const q = new URLSearchParams({
      app_id:         appId,
      app_key:        appKey,
      results_per_page: String(params.results_wanted ?? 25),
      what:           params.search_term,
      content_type:   'application/json',
    });
    if (params.location) q.set('where', params.location);

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${q}`;
    const res = await politeFetch(url);

    if (!res.ok) return { jobs: [], http_status: res.status, fetched_at: new Date().toISOString() };

    const payload = (await res.json()) as { results: AdzunaJob[] };
    const jobs: NormalisedJob[] = [];

    for (const a of payload.results ?? []) {
      const desc = a.description ?? null;
      if (!matchesSearch({ title: a.title, description: desc }, params.search_term)) continue;

      const empType: NormalisedJob['employment_type'] =
        a.contract_type === 'full_time'  ? 'full_time'  :
        a.contract_type === 'part_time'  ? 'part_time'  :
        a.contract_type === 'contract'   ? 'contract'   : null;

      jobs.push({
        source_board:     'adzuna',
        source_url:       a.redirect_url,
        external_id:      a.id,
        title:            a.title,
        company:          a.company.display_name,
        location:         a.location.display_name ?? null,
        remote_type:      a.location.display_name?.toLowerCase().includes('remote') ? 'remote' : null,
        employment_type:  empType,
        salary_min:       a.salary_min ?? null,
        salary_max:       a.salary_max ?? null,
        salary_currency:  'USD',
        description:      desc,
        description_html: null,
        posted_at:        a.created ?? null,
        raw_payload:      a as unknown as Record<string, unknown>,
      });
    }

    return { jobs, http_status: res.status, fetched_at: new Date().toISOString() };
  },
};

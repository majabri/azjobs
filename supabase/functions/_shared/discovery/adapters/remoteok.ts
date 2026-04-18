import {
  BoardAdapter,
  SearchParams,
  AdapterResult,
  NormalisedJob,
} from '../types.ts';
import { politeFetch, parseSalary, htmlToText, matchesSearch } from '../helpers.ts';

// RemoteOK public JSON feed — they explicitly publish this for aggregators.
// Docs: https://remoteok.com/api
// First element of the response array is a legal notice object — skip it.
const FEED_URL = 'https://remoteok.com/api';

interface RemoteOkJob {
  id: string;
  slug: string;
  epoch?: number;
  date?: string;
  company?: string;
  company_logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
}

export const remoteOkAdapter: BoardAdapter = {
  board_id: 'remoteok',

  async search(params: SearchParams): Promise<AdapterResult> {
    const res = await politeFetch(FEED_URL, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return { jobs: [], http_status: res.status, fetched_at: new Date().toISOString() };
    }

    const raw = (await res.json()) as unknown[];
    // Index 0 is a legal notice object — slice it off.
    const entries = raw.slice(1) as RemoteOkJob[];

    const wanted = params.results_wanted ?? 25;
    const jobs: NormalisedJob[] = [];

    for (const entry of entries) {
      if (jobs.length >= wanted) break;

      const title = entry.position ?? '';
      const company = entry.company ?? '';
      if (!title || !company) continue;

      const descriptionHtml = entry.description ?? null;
      const description = htmlToText(descriptionHtml);

      if (!matchesSearch({ title, description }, params.search_term)) continue;

      // Prefer structured salary fields from API; fall back to regex on description.
      const salaryFromApi =
        entry.salary_min && entry.salary_max
          ? { min: entry.salary_min, max: entry.salary_max, currency: 'USD' }
          : parseSalary(description);

      jobs.push({
        source_board: 'remoteok',
        source_url:
          entry.url ??
          `https://remoteok.com/remote-jobs/${entry.slug ?? entry.id}`,
        external_id: String(entry.id),
        title,
        company,
        location: entry.location ?? 'Remote',
        remote_type: 'remote',
        employment_type: null,
        salary_min: salaryFromApi.min,
        salary_max: salaryFromApi.max,
        salary_currency: salaryFromApi.currency,
        description,
        description_html: descriptionHtml,
        posted_at: entry.epoch
          ? new Date(entry.epoch * 1000).toISOString()
          : (entry.date ?? null),
        raw_payload: entry as unknown as Record<string, unknown>,
      });
    }

    return {
      jobs,
      http_status: res.status,
      fetched_at: new Date().toISOString(),
    };
  },
};

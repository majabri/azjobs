// Normalised job shape that every board adapter must return.
// This is what gets written to the `discovery_jobs` staging table.
// (Not scraped_jobs — that is a VIEW over job_postings and must not be touched.)
export interface NormalisedJob {
  source_board: string;           // 'remoteok', 'lever', etc.
  source_url: string;             // link back to the original posting
  external_id: string;            // board's own ID for the posting
  title: string;
  company: string;
  location: string | null;
  remote_type: 'remote' | 'hybrid' | 'onsite' | null;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  description: string | null;        // plain text
  description_html: string | null;   // original HTML if available
  posted_at: string | null;          // ISO 8601
  raw_payload: Record<string, unknown>;
}

export interface SearchParams {
  search_term: string;
  location?: string;
  is_remote?: boolean;
  results_wanted?: number;   // default 25
}

export interface AdapterResult {
  jobs: NormalisedJob[];
  http_status: number;
  fetched_at: string;
}

export interface BoardAdapter {
  board_id: string;                 // matches feature flag suffix
  search(params: SearchParams): Promise<AdapterResult>;
}

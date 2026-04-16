// =============================================================================
// iCareerOS — Job Sourcing Service Types
// =============================================================================

export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type FetchMethod = 'jobspy_bridge' | 'cowork_api' | 'puppeteer' | 'cheerio' | 'rss'

export interface RawJobInput {
  source: string
  source_job_id: string
  title?: string
  company?: string
  location?: string
  remote_type?: RemoteType
  salary_min?: number | null
  salary_max?: number | null
  url: string
  raw_html?: string | null
  raw_json?: Record<string, unknown> | null
  fetch_method: FetchMethod
}

export interface FetchJobsInput {
  query: string
  limit?: number
  /** Specific board IDs to target, or all sources if empty */
  board_ids?: string[]
  /** Location hint for non-global sources */
  location?: string
  /** Whether to skip the JobSpy bridge and only use Cowork APIs */
  cowork_only?: boolean
}

export interface FetchJobsOutput {
  raw_job_ids: string[]
  count: number
  failed_sources: string[]
  source_counts: Record<string, number>
}

export interface CoworkJob {
  id: string
  source: string
  title: string
  company: string
  location?: string
  remote?: RemoteType
  salary_min?: number | null
  salary_max?: number | null
  url: string
  description?: string
  posted_at?: string | null
}

export interface JobSpyRow {
  external_id: string
  title: string
  company: string | null
  location: string | null
  is_remote: boolean
  salary_min: number | null
  salary_max: number | null
  job_url: string
  source: string
  description: string | null
  scraped_at: string
}

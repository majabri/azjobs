// =============================================================================
// iCareerOS — JobSpy Bridge Adapter
//
// DESIGN: The existing GitHub Actions Python scraper (scrape_jobs.py) already
// runs every 2 hours and populates the `job_postings` table with 500–2000 fresh
// jobs from Indeed, Google, ZipRecruiter. This adapter reads from that table
// and feeds the new microservice pipeline — no duplicate scraping, $0 cost.
//
// Flow:
//   GitHub Actions scraper → job_postings (existing)
//                                          ↓
//                          JobSpyAdapter.fetch() reads new rows
//                                          ↓
//                          raw_jobs (new pipeline) via upsert
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { JobSpyRow, RawJobInput } from './types'

interface JobSpyFetchOptions {
  search_term: string
  results_wanted?: number
  /** Only return jobs scraped after this date (default: last 6 hours) */
  since?: Date
  /** Filter to specific sources: 'indeed' | 'google' | 'zip_recruiter' */
  sources?: string[]
}

interface JobSpyFetchResult {
  jobs: RawJobInput[]
  count: number
  sources_hit: string[]
}

export class JobSpyAdapter {
  private supabase: SupabaseClient

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[JobSpyAdapter] Missing Supabase credentials')
    this.supabase = createClient(url, key)
  }

  /**
   * Read fresh jobs from job_postings (populated by GitHub Actions scraper).
   * Converts them to RawJobInput format for the new pipeline.
   */
  async fetch(options: JobSpyFetchOptions): Promise<JobSpyFetchResult> {
    const {
      search_term,
      results_wanted = 100,
      since = new Date(Date.now() - 6 * 60 * 60 * 1000),  // last 6 hours
      sources,
    } = options

    console.log(`[JobSpy] Bridging job_postings: "${search_term}" since ${since.toISOString()}`)

    // Build FTS query from search term
    const ftsQuery = search_term
      .split(' ')
      .filter(w => w.length > 2)
      .join(' & ')

    let query = this.supabase
      .from('job_postings')
      .select('*')
      .gte('scraped_at', since.toISOString())
      .textSearch('title', ftsQuery, { type: 'plain' })
      .order('scraped_at', { ascending: false })
      .limit(results_wanted)

    if (sources && sources.length > 0) {
      query = query.in('source', sources)
    }

    const { data, error } = await query

    if (error) {
      console.error(`[JobSpy] DB query failed:`, error.message)
      throw error
    }

    const rows = (data ?? []) as JobSpyRow[]

    const jobs: RawJobInput[] = rows
      .filter(row => row.job_url)  // Skip rows without URLs
      .map(row => ({
        source: row.source,
        source_job_id: row.external_id,
        title: row.title ?? undefined,
        company: row.company ?? undefined,
        location: row.location ?? undefined,
        remote_type: row.is_remote ? 'remote' : 'onsite',
        salary_min: row.salary_min,
        salary_max: row.salary_max,
        url: row.job_url,
        raw_json: {
          external_id: row.external_id,
          title: row.title,
          company: row.company,
          location: row.location,
          is_remote: row.is_remote,
          salary_min: row.salary_min,
          salary_max: row.salary_max,
          job_url: row.job_url,
          source: row.source,
          description: row.description,
          scraped_at: row.scraped_at,
        },
        raw_html: null,
        fetch_method: 'jobspy_bridge' as const,
      }))

    const sourceSet = new Set(jobs.map(j => j.source))

    console.log(`[JobSpy] Bridge returned ${jobs.length} jobs from ${sourceSet.size} sources`)

    return {
      jobs,
      count: jobs.length,
      sources_hit: Array.from(sourceSet),
    }
  }

  /**
   * Get count of new jobs in job_postings since a given timestamp.
   * Useful for deciding whether to run an extraction batch.
   */
  async getNewJobCount(since: Date): Promise<number> {
    const { count, error } = await this.supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .gte('scraped_at', since.toISOString())

    if (error) return 0
    return count ?? 0
  }
}

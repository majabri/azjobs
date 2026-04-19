// =============================================================================
// iCareerOS — Job Sourcing Service
// Layer 1 of the Job Discovery pipeline.
//
// Responsibility: Fetch raw jobs from all sources and store in raw_jobs table.
// Sources:
//   - JobSpy bridge (reads existing job_postings table — GitHub Actions scraper)
//   - 6 Cowork APIs: Greenhouse, Lever, SmartRecruiters, Remotive, WWR, Ashby
//
// Publishes: job.fetched events for each stored job
// Does NOT: extract, deduplicate, or score
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { JobSpyAdapter } from './job-spy-adapter'
import { CoworkAdapters } from './cowork-adapters'
import { eventBus } from '../../shared/services/event-bus'
import type { FetchJobsInput, FetchJobsOutput, RawJobInput } from './types'

export class JobSourcingService {
  private supabase: SupabaseClient
  private jobspy: JobSpyAdapter
  private cowork: CoworkAdapters

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[Sourcing] Missing Supabase credentials')

    this.supabase = createClient(url, key)
    this.jobspy = new JobSpyAdapter()
    this.cowork = new CoworkAdapters()
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------
  async fetchJobs(input: FetchJobsInput): Promise<FetchJobsOutput> {
    console.log(`[Sourcing] Starting fetch: "${input.query}"`)

    const allRawJobIds: string[] = []
    const failedSources: string[] = []
    const sourceCounts: Record<string, number> = {}

    // ── Phase 1: JobSpy bridge ──────────────────────────────────────────────
    if (!input.cowork_only) {
      try {
        const { jobs } = await this.jobspy.fetch({
          search_term: input.query,
          results_wanted: input.limit ?? 100,
        })

        const ids = await this.storeRawJobs(jobs)
        allRawJobIds.push(...ids)

        // Tally per-source counts
        for (const job of jobs) {
          sourceCounts[job.source] = (sourceCounts[job.source] ?? 0) + 1
        }

        console.log(`[Sourcing] JobSpy bridge: ${ids.length} stored`)
      } catch (err) {
        console.error(`[Sourcing] JobSpy bridge failed:`, (err as Error).message)
        failedSources.push('jobspy_bridge')
      }
    }

    // ── Phase 2: Cowork APIs ────────────────────────────────────────────────
    const shouldRunCowork =
      !input.board_ids ||
      input.board_ids.length === 0 ||
      input.board_ids.some(id =>
        ['greenhouse', 'lever', 'smartrecruiters', 'remotive', 'weworkremotely', 'ashby'].includes(id)
      )

    if (shouldRunCowork) {
      try {
        const coworkJobs = await this.cowork.fetchAll({
          search_term: input.query,
          limit: input.limit ?? 100,
        })

        const rawInputs: RawJobInput[] = coworkJobs.map(j => ({
          source: j.source,
          source_job_id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          remote_type: j.remote,
          salary_min: j.salary_min,
          salary_max: j.salary_max,
          url: j.url,
          raw_json: j as unknown as Record<string, unknown>,
          raw_html: null,
          fetch_method: 'cowork_api' as const,
        }))

        const ids = await this.storeRawJobs(rawInputs)
        allRawJobIds.push(...ids)

        for (const job of coworkJobs) {
          sourceCounts[job.source] = (sourceCounts[job.source] ?? 0) + 1
        }

        console.log(`[Sourcing] Cowork APIs: ${ids.length} stored`)
      } catch (err) {
        console.error(`[Sourcing] Cowork APIs failed:`, (err as Error).message)
        failedSources.push('cowork')
      }
    }

    // ── Publish batch complete event ────────────────────────────────────────
    if (allRawJobIds.length > 0) {
      await eventBus.publish({
        event_type: 'batch.fetch_started',
        payload: {
          query: input.query,
          total_stored: allRawJobIds.length,
          source_counts: sourceCounts,
          failed_sources: failedSources,
        },
      })
    }

    console.log(`[Sourcing] Done: ${allRawJobIds.length} jobs | Failed: ${failedSources.join(', ') || 'none'}`)

    return {
      raw_job_ids: allRawJobIds,
      count: allRawJobIds.length,
      failed_sources: failedSources,
      source_counts: sourceCounts,
    }
  }

  // ---------------------------------------------------------------------------
  // Store raw jobs with upsert (URL is the unique key)
  // ---------------------------------------------------------------------------
  private async storeRawJobs(jobs: RawJobInput[]): Promise<string[]> {
    if (jobs.length === 0) return []

    const storedIds: string[] = []
    const eventsToPublish: Array<{ event_type: string; payload: Record<string, unknown> }> = []

    // Upsert in batches of 50 to avoid payload limits
    const batches = chunk(jobs, 50)

    for (const batch of batches) {
      const rows = batch.map(job => ({
        source: job.source,
        source_job_id: job.source_job_id,
        title: job.title ?? null,
        company: job.company ?? null,
        location: job.location ?? null,
        remote_type: job.remote_type ?? 'unknown',
        salary_min: job.salary_min ?? null,
        salary_max: job.salary_max ?? null,
        url: job.url,
        raw_html: job.raw_html ?? null,
        raw_json: job.raw_json ?? null,
        fetch_method: job.fetch_method,
        fetched_at: new Date().toISOString(),
      }))

      const { data, error } = await this.supabase
        .from('raw_jobs')
        .upsert(rows, {
          onConflict: 'url',
          ignoreDuplicates: false,
        })
        .select('id, source, url')

      if (error) {
        console.error(`[Sourcing] Upsert batch failed:`, error.message)
        continue
      }

      for (const row of data ?? []) {
        storedIds.push(row.id)
        eventsToPublish.push({
          event_type: 'job.fetched',
          payload: { raw_job_id: row.id, source: row.source, url: row.url },
        })
      }
    }

    // Batch publish events
    if (eventsToPublish.length > 0) {
      await eventBus.publishBatch(eventsToPublish)
    }

    return storedIds
  }
}

// ── Helper ──────────────────────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// Singleton
export const jobSourcingService = new JobSourcingService()

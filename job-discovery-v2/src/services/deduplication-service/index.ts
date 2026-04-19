// =============================================================================
// iCareerOS — Deduplication Service
// Layer 3 of the Job Discovery pipeline.
//
// Responsibility: Merge the same job seen across multiple platforms into a
// single canonical record in deduplicated_jobs.
//
// Algorithm:
//   hash = SHA256(lower(title) + '|' + lower(company) + '|' + lower(location))
//   If hash exists → append source to sources[] array (seen on multiple platforms)
//   If hash is new → create new deduplicated_jobs record
//
// Why this matters:
//   "Senior React Developer at Stripe" appears on Indeed, LinkedIn, Greenhouse,
//   and ZipRecruiter simultaneously. Without dedup, users see it 4 times.
//   With dedup: 1 card, "seen on 4 platforms" badge = higher trust signal.
//
// Listens to: job.extracted events
// Publishes:  job.deduped events
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { eventBus } from '../../shared/services/event-bus'

interface ExtractedJobRow {
  id: string
  source: string
  source_job_id: string | null
  title: string
  company: string
  location: string | null
  raw_job_id: string | null
}

interface DeduplicatedJobRow {
  id: string
  job_hash: string
  sources: SourceRecord[]
  primary_extracted_job_id: string | null
  source_count: number
}

interface SourceRecord {
  source: string
  job_id: string | null
  url?: string
  seen_at: string
}

export class DeduplicationService {
  private supabase: SupabaseClient

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[Dedup] Missing Supabase credentials')
    this.supabase = createClient(url, key)
  }

  // ---------------------------------------------------------------------------
  // Dedup a single extracted job
  // ---------------------------------------------------------------------------
  async dedupJob(extractedJobId: string): Promise<{ isNew: boolean; dedupId: string }> {
    const { data: job, error } = await this.supabase
      .from('extracted_jobs')
      .select('id, source, source_job_id, title, company, location, raw_job_id')
      .eq('id', extractedJobId)
      .single()

    if (error || !job) throw new Error(`[Dedup] Extracted job not found: ${extractedJobId}`)

    const row = job as ExtractedJobRow
    return this.processJob(row)
  }

  // ---------------------------------------------------------------------------
  // Batch: dedup all unprocessed extracted_jobs
  // ---------------------------------------------------------------------------
  async dedupBatch(limit = 1000): Promise<{ new_jobs: number; merged_jobs: number; failed: number }> {
    console.log(`[Dedup] Starting batch (limit: ${limit})`)

    // Jobs not yet in deduplicated_jobs
    const { data: jobs, error } = await this.supabase
      .from('extracted_jobs')
      .select('id, source, source_job_id, title, company, location, raw_job_id')
      .not('id', 'in',
        `(SELECT primary_extracted_job_id FROM deduplicated_jobs WHERE primary_extracted_job_id IS NOT NULL)`
      )
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error(`[Dedup] Batch query failed:`, error.message)
      throw error
    }

    const rows = (jobs ?? []) as ExtractedJobRow[]
    console.log(`[Dedup] Processing ${rows.length} jobs`)

    let newJobs = 0, mergedJobs = 0, failed = 0
    const eventBatch: Array<{ event_type: string; payload: Record<string, unknown> }> = []

    for (const row of rows) {
      try {
        const { isNew, dedupId } = await this.processJob(row)
        if (isNew) newJobs++; else mergedJobs++

        eventBatch.push({
          event_type: 'job.deduped',
          payload: {
            extracted_job_id: row.id,
            deduped_job_id: dedupId,
            is_new: isNew,
            source: row.source,
          },
        })
      } catch (err) {
        failed++
        console.error(`[Dedup] Failed ${row.id}:`, (err as Error).message)
      }
    }

    if (eventBatch.length > 0) {
      await eventBus.publishBatch(eventBatch)
    }

    console.log(`[Dedup] Done: ${newJobs} new, ${mergedJobs} merged, ${failed} failed`)
    return { new_jobs: newJobs, merged_jobs: mergedJobs, failed }
  }

  // ---------------------------------------------------------------------------
  // Core dedup logic
  // ---------------------------------------------------------------------------
  private async processJob(job: ExtractedJobRow): Promise<{ isNew: boolean; dedupId: string }> {
    const hash = this.computeHash(job.title, job.company, job.location)

    const sourceRecord: SourceRecord = {
      source: job.source,
      job_id: job.source_job_id,
      seen_at: new Date().toISOString(),
    }

    // Try to find existing record with this hash
    const { data: existing } = await this.supabase
      .from('deduplicated_jobs')
      .select('id, job_hash, sources, primary_extracted_job_id, source_count')
      .eq('job_hash', hash)
      .single()

    if (existing) {
      // Merge: append this source to existing record
      const existingRow = existing as DeduplicatedJobRow
      const currentSources: SourceRecord[] = existingRow.sources ?? []

      // Skip if this source already recorded
      const alreadyHasSource = currentSources.some(s => s.source === job.source)
      if (!alreadyHasSource) {
        const updatedSources = [...currentSources, sourceRecord]

        const { error } = await this.supabase
          .from('deduplicated_jobs')
          .update({
            sources: updatedSources,
            deduped_at: new Date().toISOString(),
          })
          .eq('id', existingRow.id)

        if (error) throw error
      }

      return { isNew: false, dedupId: existingRow.id }
    } else {
      // New job: create canonical record
      const { data: newRecord, error } = await this.supabase
        .from('deduplicated_jobs')
        .insert({
          title: job.title,
          company: job.company,
          location: job.location ?? '',
          job_hash: hash,
          sources: [sourceRecord],
          primary_extracted_job_id: job.id,
          deduped_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error || !newRecord) throw error ?? new Error('Insert returned no data')

      return { isNew: true, dedupId: newRecord.id }
    }
  }

  // ---------------------------------------------------------------------------
  // SHA256 hash: title + company + location (normalised)
  // ---------------------------------------------------------------------------
  private computeHash(title: string, company: string, location: string | null): string {
    const normalised = [
      normalise(title),
      normalise(company),
      normalise(location ?? ''),
    ].join('|')

    return createHash('sha256').update(normalised).digest('hex').slice(0, 32)
  }

  // ---------------------------------------------------------------------------
  // Stats: how many jobs were seen on multiple platforms today
  // ---------------------------------------------------------------------------
  async getMultiSourceStats(): Promise<{
    total: number
    multi_source: number
    avg_sources: number
    top_companies: Array<{ company: string; count: number }>
  }> {
    const { data: stats } = await this.supabase
      .from('deduplicated_jobs')
      .select('company, source_count')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const rows = stats ?? []
    const total = rows.length
    const multiSource = rows.filter(r => (r.source_count ?? 0) > 1).length
    const avgSources = total > 0
      ? rows.reduce((sum, r) => sum + (r.source_count ?? 1), 0) / total
      : 0

    // Top companies by job count today
    const companyCounts: Record<string, number> = {}
    for (const row of rows) {
      companyCounts[row.company] = (companyCounts[row.company] ?? 0) + 1
    }
    const topCompanies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([company, count]) => ({ company, count }))

    return { total, multi_source: multiSource, avg_sources: avgSources, top_companies: topCompanies }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalise(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// Singleton
export const deduplicationService = new DeduplicationService()

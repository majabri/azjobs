#!/usr/bin/env bun
// =============================================================================
// iCareerOS — Deduplication Batch Runner
// Repo path: src/job-discovery-v2/scripts/run-deduplication.ts
//
// Called by: .github/workflows/job-deduplicator.yml (nightly 04:00 UTC)
// Also callable manually: bun run scripts/run-deduplication.ts
//
// Flow:
//   1. Pull extracted_jobs not yet in deduplicated_jobs
//   2. Compute SHA256(title+company+location) for each
//   3. If hash exists → append source to sources[] array
//   4. If hash is new → create new deduplicated_jobs record
//   5. Publish job.deduped events
//   6. Report stats (new vs merged jobs)
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const LIMIT = parseInt(process.env.DEDUP_LIMIT ?? '2000', 10)

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Dedup] Starting — limit: ${LIMIT}`)

  // Fetch extracted_jobs not yet in deduplicated_jobs
  const { data: jobs, error } = await supabase
    .from('extracted_jobs')
    .select('id, source, source_job_id, title, company, location')
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(LIMIT)

  if (error) {
    console.error('❌ Failed to fetch extracted_jobs:', error.message)
    process.exit(1)
  }

  // Filter out already-deduped
  const undeduped = await filterUndeduped(jobs ?? [])
  console.log(`[Dedup] ${undeduped.length} undeduped jobs (from ${jobs?.length ?? 0} extracted)`)

  if (undeduped.length === 0) {
    console.log('[Dedup] Nothing to do')
    process.exit(0)
  }

  // Build hash lookup for all existing records in one query (efficient)
  const hashes = undeduped.map(j => computeHash(j.title, j.company, j.location))
  const { data: existing } = await supabase
    .from('deduplicated_jobs')
    .select('id, job_hash, sources')
    .in('job_hash', hashes)

  const existingByHash = new Map<string, any>()
  for (const row of existing ?? []) existingByHash.set(row.job_hash, row)

  // Separate into new jobs and merges
  const toInsert: any[] = []
  const toUpdate: Map<string, { id: string; sources: any[] }> = new Map()

  for (const job of undeduped) {
    const hash = computeHash(job.title, job.company, job.location)
    const sourceRecord = {
      source: job.source,
      job_id: job.source_job_id,
      extracted_job_id: job.id,
      seen_at: new Date().toISOString(),
    }

    if (existingByHash.has(hash)) {
      const existing = existingByHash.get(hash)!
      const sources: any[] = existing.sources ?? []
      if (!sources.some((s: any) => s.source === job.source)) {
        sources.push(sourceRecord)
        toUpdate.set(existing.id, { id: existing.id, sources })
        existingByHash.set(hash, { ...existing, sources })  // Update local cache
      }
    } else {
      toInsert.push({
        title: job.title,
        company: job.company,
        location: job.location ?? '',
        job_hash: hash,
        sources: [sourceRecord],
        primary_extracted_job_id: job.id,
        deduped_at: new Date().toISOString(),
      })
      // Add to local cache so subsequent same-hash jobs merge correctly
      existingByHash.set(hash, { job_hash: hash, sources: [sourceRecord] })
    }
  }

  // Batch insert new jobs
  let newJobs = 0, mergedJobs = 0, failed = 0

  if (toInsert.length > 0) {
    const batches = chunk(toInsert, 100)
    for (const batch of batches) {
      const { data, error: insertError } = await supabase
        .from('deduplicated_jobs')
        .upsert(batch, { onConflict: 'job_hash', ignoreDuplicates: false })
        .select('id')

      if (insertError) {
        console.error('  Insert batch failed:', insertError.message)
        failed += batch.length
      } else {
        newJobs += data?.length ?? 0
      }
    }
  }

  // Batch update merges
  for (const [id, { sources }] of toUpdate.entries()) {
    const { error: updateError } = await supabase
      .from('deduplicated_jobs')
      .update({ sources, deduped_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) failed++
    else mergedJobs++
  }

  // Publish summary event
  await supabase.from('platform_events').insert({
    event_type: 'batch.dedup_started',
    payload: {
      new_jobs: newJobs,
      merged_jobs: mergedJobs,
      failed,
      processed: undeduped.length,
      completed_at: new Date().toISOString(),
    },
  })

  console.log(`\n[Dedup] ✅ Done`)
  console.log(`  New jobs:    ${newJobs}`)
  console.log(`  Merged:      ${mergedJobs}`)
  console.log(`  Failed:      ${failed}`)
  console.log(`  Dedup rate:  ${Math.round(mergedJobs / (newJobs + mergedJobs || 1) * 100)}% same job seen on multiple platforms`)

  if (failed / (undeduped.length || 1) > 0.20) {
    console.error('❌ Error rate exceeds 20%')
    process.exit(1)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function filterUndeduped(jobs: any[]): Promise<any[]> {
  if (jobs.length === 0) return []
  const ids = jobs.map(j => j.id)
  const { data } = await supabase
    .from('deduplicated_jobs')
    .select('primary_extracted_job_id')
    .in('primary_extracted_job_id', ids)

  const alreadyDeduped = new Set((data ?? []).map((r: any) => r.primary_extracted_job_id))
  return jobs.filter(j => !alreadyDeduped.has(j.id))
}

function computeHash(title: string, company: string, location: string | null): string {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const key = [normalise(title), normalise(company), normalise(location ?? '')].join('|')
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

main().catch(err => {
  console.error('❌ Deduplication runner crashed:', err)
  process.exit(1)
})

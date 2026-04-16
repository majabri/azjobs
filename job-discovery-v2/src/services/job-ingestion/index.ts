// =============================================================================
// iCareerOS — Job Ingestion Service (Phase 0, Task 0.4)
// Orchestrates all 12 free job sources → jobs table → raw_jobs bridge
//
// Sources (12 total, $0/month):
//   Tier 1 (ATS APIs, every 6h):    Greenhouse, Lever, Ashby
//   Tier 2 (Aggregators, every 12h): Adzuna, Jooble
//   Tier 3 (Remote APIs, every 6h): Himalayas, RemoteOK, Remotive, Jobicy, Arbeitnow
//   Tier 4 (RSS, daily):            WeWorkRemotely
//   Tier 5 (Crawl, daily):          JSON-LD Career Pages
//
// Threshold management:
//   - Firecrawl limit hit → Cheerio fallback (automatic, $0)
//   - Supabase 500MB → archive jobs older than 90 days (automatic)
//   - Source 3+ consecutive failures → auto-disabled
//
// Entry point called by GitHub Actions job-ingestion.yml
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { CoworkAdapters } from '../job-sourcing-service/cowork-adapters'
import { ExtendedAdapters } from '../job-sourcing-service/extended-adapters'
import type { CoworkJob } from '../job-sourcing-service/types'

// ── Config ────────────────────────────────────────────────────────────────────

const SEARCH_TERMS = [
  'software engineer',
  'full stack developer',
  'backend engineer',
  'frontend engineer',
  'product manager',
  'data engineer',
  'devops engineer',
  'machine learning engineer',
]

const STALE_THRESHOLD_HOURS = 48
const CLOSED_THRESHOLD_DAYS = 7

interface IngestionOptions {
  tier?: 1 | 2 | 3 | 4 | 5 | 'all'    // Run specific tiers only, or all
  search_terms?: string[]               // Override default search terms
  dry_run?: boolean                     // Log only, don't write to DB
}

interface IngestionStats {
  source_name: string
  jobs_fetched: number
  jobs_inserted: number
  jobs_updated: number
  errors: string[]
  duration_ms: number
}

// ── Main Ingestion Service ────────────────────────────────────────────────────

export class JobIngestionService {
  private supabase: SupabaseClient
  private cowork: CoworkAdapters
  private extended: ExtendedAdapters

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('[Ingestion] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')

    this.supabase = createClient(url, key)
    this.cowork = new CoworkAdapters()
    this.extended = new ExtendedAdapters()
  }

  // ---------------------------------------------------------------------------
  // Main entry point — called by GitHub Actions
  // ---------------------------------------------------------------------------
  async run(options: IngestionOptions = {}): Promise<void> {
    const { tier = 'all', search_terms = SEARCH_TERMS, dry_run = false } = options

    console.log(`[Ingestion] Starting run — tier: ${tier}, ${search_terms.length} search terms, dry_run: ${dry_run}`)

    const runId = await this.startRun('ALL_SOURCES')
    const allStats: IngestionStats[] = []

    try {
      // Run each search term across all relevant sources
      for (const term of search_terms) {
        console.log(`\n[Ingestion] ── Search term: "${term}" ──`)

        const stats = await this.ingestAllSources(term, tier, dry_run)
        allStats.push(...stats)
      }

      // Mark stale / closed jobs
      if (!dry_run) {
        await this.runStaleDetection()
        await this.archiveOldJobs()
      }

      // Complete the run
      const totals = aggregateStats(allStats)
      await this.completeRun(runId, 'success', totals)

      console.log(`\n[Ingestion] ✅ Run complete:`)
      console.log(`  Fetched:  ${totals.jobs_fetched}`)
      console.log(`  Inserted: ${totals.jobs_inserted}`)
      console.log(`  Updated:  ${totals.jobs_updated}`)
      console.log(`  Errors:   ${totals.errors.length}`)
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[Ingestion] ❌ Run failed:`, msg)
      await this.completeRun(runId, 'failed', { jobs_fetched: 0, jobs_inserted: 0, jobs_updated: 0, errors: [msg] })
      throw err
    }
  }

  // ---------------------------------------------------------------------------
  // Ingest all 12 sources for a given search term
  // ---------------------------------------------------------------------------
  private async ingestAllSources(
    term: string,
    tier: IngestionOptions['tier'],
    dryRun: boolean
  ): Promise<IngestionStats[]> {
    const stats: IngestionStats[] = []

    // ── Tier 1: ATS APIs (Greenhouse, Lever, Ashby) ──────────────────────────
    if (tier === 'all' || tier === 1) {
      const tierSources = ['greenhouse', 'lever', 'ashby']
      const start = Date.now()

      try {
        const activeCowork = await this.getActiveSources(tierSources)
        if (activeCowork.length > 0) {
          const jobs = await this.cowork.fetchAll({ search_term: term, limit: 150 })
          const bySource = groupBySource(jobs)

          for (const [source, sourceJobs] of Object.entries(bySource)) {
            if (!activeCowork.includes(source)) continue
            const s = await this.upsertJobs(source, sourceJobs, dryRun)
            stats.push({ ...s, duration_ms: Date.now() - start })
          }
        }
      } catch (err) {
        stats.push(errorStat('cowork_ats', err, Date.now() - start))
      }
    }

    // ── Tier 2: Aggregators (Adzuna, Jooble) ─────────────────────────────────
    if (tier === 'all' || tier === 2) {
      for (const source of ['adzuna', 'jooble']) {
        const start = Date.now()
        const active = await this.isSourceActive(source)
        if (!active) { console.log(`[Ingestion] ${source}: disabled, skipping`); continue }

        try {
          let jobs: CoworkJob[] = []
          if (source === 'adzuna') jobs = await this.extended.fetchAdzuna(term, 50)
          if (source === 'jooble') jobs = await this.extended.fetchJooble(term, 50)

          const s = await this.upsertJobs(source, jobs, dryRun)
          stats.push({ ...s, duration_ms: Date.now() - start })
          await this.recordSuccess(source)
        } catch (err) {
          stats.push(errorStat(source, err, Date.now() - start))
          await this.recordFailure(source)
        }
      }
    }

    // ── Tier 3: Remote APIs (Himalayas, RemoteOK, Remotive, Jobicy, Arbeitnow)
    if (tier === 'all' || tier === 3) {
      const remoteResults = await Promise.allSettled([
        this.ingestSingleSource('himalayas',  () => this.extended.fetchHimalayas(term, 100),  dryRun),
        this.ingestSingleSource('remoteok',   () => this.extended.fetchRemoteOK(term, 100),   dryRun),
        this.ingestSingleSource('remotive',   () => this.cowork.fetchAll({ search_term: term, limit: 50 })
          .then(j => j.filter(x => x.source === 'remotive')), dryRun),
        this.ingestSingleSource('jobicy',     () => this.extended.fetchJobicy(term, 50),      dryRun),
        this.ingestSingleSource('arbeitnow',  () => this.extended.fetchArbeitnow(term, 100),  dryRun),
      ])

      for (const result of remoteResults) {
        if (result.status === 'fulfilled') stats.push(result.value)
      }
    }

    // ── Tier 4: RSS (WeWorkRemotely) ─────────────────────────────────────────
    if (tier === 'all' || tier === 4) {
      const start = Date.now()
      try {
        const active = await this.isSourceActive('weworkremotely')
        if (active) {
          const allCowork = await this.cowork.fetchAll({ search_term: term, limit: 50 })
          const wwr = allCowork.filter(j => j.source === 'weworkremotely')
          const s = await this.upsertJobs('weworkremotely', wwr, dryRun)
          stats.push({ ...s, duration_ms: Date.now() - start })
          await this.recordSuccess('weworkremotely')
        }
      } catch (err) {
        stats.push(errorStat('weworkremotely', err, Date.now() - start))
        await this.recordFailure('weworkremotely')
      }
    }

    // ── Tier 5: JSON-LD Career Pages ─────────────────────────────────────────
    if (tier === 'all' || tier === 5) {
      const start = Date.now()
      try {
        const active = await this.isSourceActive('jsonld_crawl')
        if (active) {
          const jobs = await this.extended.fetchJsonLd(term, 50)
          const s = await this.upsertJobs('jsonld_crawl', jobs, dryRun)
          stats.push({ ...s, duration_ms: Date.now() - start })
          await this.recordSuccess('jsonld_crawl')
        }
      } catch (err) {
        stats.push(errorStat('jsonld_crawl', err, Date.now() - start))
        await this.recordFailure('jsonld_crawl')
      }
    }

    return stats
  }

  // ---------------------------------------------------------------------------
  // Ingest a single source with failure tracking
  // ---------------------------------------------------------------------------
  private async ingestSingleSource(
    sourceName: string,
    fetcher: () => Promise<CoworkJob[]>,
    dryRun: boolean
  ): Promise<IngestionStats> {
    const start = Date.now()
    const active = await this.isSourceActive(sourceName)

    if (!active) {
      console.log(`[Ingestion] ${sourceName}: disabled, skipping`)
      return errorStat(sourceName, new Error('disabled'), Date.now() - start)
    }

    try {
      const jobs = await fetcher()
      const result = await this.upsertJobs(sourceName, jobs, dryRun)
      await this.recordSuccess(sourceName)
      return { ...result, duration_ms: Date.now() - start }
    } catch (err) {
      await this.recordFailure(sourceName)
      return errorStat(sourceName, err, Date.now() - start)
    }
  }

  // ---------------------------------------------------------------------------
  // Upsert jobs into the `jobs` table
  // ---------------------------------------------------------------------------
  private async upsertJobs(
    sourceName: string,
    jobs: CoworkJob[],
    dryRun: boolean
  ): Promise<Omit<IngestionStats, 'duration_ms'>> {
    if (jobs.length === 0) {
      return { source_name: sourceName, jobs_fetched: 0, jobs_inserted: 0, jobs_updated: 0, errors: [] }
    }

    const errors: string[] = []
    let inserted = 0, updated = 0

    if (dryRun) {
      console.log(`[Ingestion] DRY RUN — ${sourceName}: ${jobs.length} jobs (not writing)`)
      return { source_name: sourceName, jobs_fetched: jobs.length, jobs_inserted: 0, jobs_updated: 0, errors: [] }
    }

    // Build rows for `jobs` table
    const rows = jobs.map(job => {
      const dedupeKey = computeDedupeKey(job.title, job.company, job.location ?? '')
      return {
        job_id: job.id,
        source_name: sourceName,
        source_type: sourceTypeFor(sourceName),
        company: job.company,
        title: job.title,
        location: job.location ?? null,
        remote_type: job.remote ?? 'unknown',
        application_url: job.url,
        description: job.description ?? null,
        date_posted: job.posted_at ?? null,
        date_last_seen: new Date().toISOString(),
        salary_min: job.salary_min ?? null,
        salary_max: job.salary_max ?? null,
        status: 'active',
        attribution_req: (job as any).attribution ?? null,
        dedupe_key: dedupeKey,
        raw_source_reference: job as unknown as Record<string, unknown>,
      }
    })

    // Upsert in batches of 100
    const batches = chunk(rows, 100)

    for (const batch of batches) {
      try {
        // Upsert on dedupe_key — update date_last_seen and status for existing jobs
        const { data, error } = await this.supabase
          .from('jobs')
          .upsert(batch, {
            onConflict: 'dedupe_key',
            ignoreDuplicates: false,
          })
          .select('id, created_at')

        if (error) {
          errors.push(`Upsert batch error: ${error.message}`)
          continue
        }

        // Count new vs updated by checking created_at recency
        const now = new Date()
        for (const row of data ?? []) {
          const age = now.getTime() - new Date(row.created_at).getTime()
          if (age < 10_000) inserted++ // created within last 10s = new
          else updated++
        }
      } catch (err) {
        errors.push(`Batch failed: ${(err as Error).message}`)
      }
    }

    console.log(`[Ingestion] ${sourceName}: ${jobs.length} fetched, ${inserted} new, ${updated} updated`)
    return { source_name: sourceName, jobs_fetched: jobs.length, jobs_inserted: inserted, jobs_updated: updated, errors }
  }

  // ---------------------------------------------------------------------------
  // Stale detection
  // ---------------------------------------------------------------------------
  private async runStaleDetection(): Promise<void> {
    console.log(`[Ingestion] Running stale detection...`)

    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString()
    const closedThreshold = new Date(Date.now() - CLOSED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Mark stale
    const { error: staleError } = await this.supabase
      .from('jobs')
      .update({ status: 'stale' })
      .eq('status', 'active')
      .lt('date_last_seen', staleThreshold)

    if (staleError) console.warn(`[Ingestion] Stale marking error:`, staleError.message)

    // Mark closed
    const { error: closedError } = await this.supabase
      .from('jobs')
      .update({ status: 'closed' })
      .in('status', ['active', 'stale'])
      .lt('date_last_seen', closedThreshold)

    if (closedError) console.warn(`[Ingestion] Closed marking error:`, closedError.message)

    console.log(`[Ingestion] Stale detection complete`)
  }

  // ---------------------------------------------------------------------------
  // Archive old jobs to prevent hitting 500MB Supabase limit
  // ---------------------------------------------------------------------------
  private async archiveOldJobs(): Promise<void> {
    const archiveThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { count } = await this.supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .lt('date_scraped', archiveThreshold)

    if ((count ?? 0) > 0) {
      console.log(`[Ingestion] Archiving ${count} jobs older than 90 days`)
      await this.supabase
        .from('jobs')
        .update({ status: 'closed' })
        .lt('date_scraped', archiveThreshold)
    }
  }

  // ---------------------------------------------------------------------------
  // Source health helpers
  // ---------------------------------------------------------------------------
  private async isSourceActive(sourceName: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('ingestion_sources')
      .select('is_active')
      .eq('source_name', sourceName)
      .single()
    return data?.is_active ?? true
  }

  private async getActiveSources(sources: string[]): Promise<string[]> {
    const { data } = await this.supabase
      .from('ingestion_sources')
      .select('source_name')
      .in('source_name', sources)
      .eq('is_active', true)
    return (data ?? []).map(r => r.source_name)
  }

  private async recordSuccess(sourceName: string): Promise<void> {
    await this.supabase
      .from('ingestion_sources')
      .update({ consecutive_failures: 0, last_success_at: new Date().toISOString() })
      .eq('source_name', sourceName)
  }

  private async recordFailure(sourceName: string): Promise<void> {
    // Disable after 3 consecutive failures
    await this.supabase.rpc('record_source_failure', { p_source_name: sourceName })
  }

  // ---------------------------------------------------------------------------
  // Run tracking
  // ---------------------------------------------------------------------------
  private async startRun(sourceName: string): Promise<string> {
    const { data } = await this.supabase
      .from('ingestion_runs')
      .insert({ source_name: sourceName, status: 'running' })
      .select('id')
      .single()
    return data?.id ?? 'unknown'
  }

  private async completeRun(
    runId: string,
    status: 'success' | 'failed' | 'partial',
    totals: { jobs_fetched: number; jobs_inserted: number; jobs_updated: number; errors: string[] }
  ): Promise<void> {
    await this.supabase
      .from('ingestion_runs')
      .update({
        completed_at: new Date().toISOString(),
        status,
        jobs_fetched: totals.jobs_fetched,
        jobs_inserted: totals.jobs_inserted,
        jobs_updated: totals.jobs_updated,
        errors: totals.errors,
      })
      .eq('id', runId)
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeDedupeKey(title: string, company: string, location: string): string {
  const normalised = [title, company, location]
    .map(s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim())
    .join('|')
  return createHash('sha256').update(normalised).digest('hex').slice(0, 32)
}

function sourceTypeFor(sourceName: string): string {
  const map: Record<string, string> = {
    greenhouse: 'ats_api', lever: 'ats_api', ashby: 'ats_api',
    adzuna: 'aggregator', jooble: 'aggregator',
    himalayas: 'remote_api', remoteok: 'remote_api', remotive: 'remote_api',
    jobicy: 'remote_api', arbeitnow: 'remote_api',
    weworkremotely: 'rss_feed', jsonld_crawl: 'career_page',
  }
  return map[sourceName] ?? 'unknown'
}

function groupBySource(jobs: CoworkJob[]): Record<string, CoworkJob[]> {
  return jobs.reduce((acc, job) => {
    if (!acc[job.source]) acc[job.source] = []
    acc[job.source].push(job)
    return acc
  }, {} as Record<string, CoworkJob[]>)
}

function aggregateStats(stats: IngestionStats[]): { jobs_fetched: number; jobs_inserted: number; jobs_updated: number; errors: string[] } {
  return stats.reduce(
    (acc, s) => ({
      jobs_fetched: acc.jobs_fetched + s.jobs_fetched,
      jobs_inserted: acc.jobs_inserted + s.jobs_inserted,
      jobs_updated: acc.jobs_updated + s.jobs_updated,
      errors: [...acc.errors, ...s.errors],
    }),
    { jobs_fetched: 0, jobs_inserted: 0, jobs_updated: 0, errors: [] as string[] }
  )
}

function errorStat(sourceName: string, err: unknown, durationMs: number): IngestionStats {
  return {
    source_name: sourceName,
    jobs_fetched: 0,
    jobs_inserted: 0,
    jobs_updated: 0,
    errors: [(err as Error).message ?? String(err)],
    duration_ms: durationMs,
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// ─── CLI entry point (called by GitHub Actions) ───────────────────────────────
//
// Environment variables read here:
//   INGESTION_TIER — '1' | '2' | '3' | '4' | '5' | 'all' (default: 'all')
//   DRY_RUN        — 'true' | 'false' (default: 'false')
//
// These are set by job-ingestion.yml per-step so each GHA step only
// runs the sources it is responsible for.

if (require.main === module || process.argv[1]?.includes('job-ingestion')) {
  const rawTier = (process.env.INGESTION_TIER ?? 'all').toLowerCase()
  const validTiers = ['1', '2', '3', '4', '5', 'all'] as const
  type ValidTier = typeof validTiers[number]

  const tier: IngestionOptions['tier'] = validTiers.includes(rawTier as ValidTier)
    ? (rawTier === '1' ? 1 : rawTier === '2' ? 2 : rawTier === '3' ? 3
      : rawTier === '4' ? 4 : rawTier === '5' ? 5 : 'all')
    : 'all'

  const dry_run = process.env.DRY_RUN?.toLowerCase() === 'true'

  console.log(`[Ingestion] CLI start — tier: ${tier}, dry_run: ${dry_run}`)

  const service = new JobIngestionService()
  service.run({ tier, dry_run }).then(() => {
    console.log('[Ingestion] Done')
    process.exit(0)
  }).catch(err => {
    console.error('[Ingestion] Fatal:', (err as Error).message)
    process.exit(1)
  })
}

export const jobIngestionService = new JobIngestionService()

// =============================================================================
// iCareerOS — Event Listeners (Phase 2, Task 2.4)
// Connects the pipeline stages via the event bus.
//
// Listener chain:
//   job.fetched   → trigger extraction   (Sourcing → Extraction)
//   job.extracted → trigger dedup        (Extraction → Dedup)
//   job.deduped   → trigger matching     (Dedup → Matching)
//   job.scored    → trigger cache warm   (Matching → Cache)
//   accuracy.degraded → trigger retrain  (Learning Service)
//
// Two operating modes:
//   1. Realtime (Supabase Realtime) — low latency, used for single-job flows
//   2. Polling  (pg_cron intervals) — reliable batch processing, used overnight
//
// This module wires both modes so the pipeline degrades gracefully:
//   - If Realtime is available: process events as they arrive
//   - If Realtime disconnects: polling catches up on missed events
// =============================================================================

import { eventBus } from '../../shared/services/event-bus'
import type { EventRecord } from '../../shared/services/event-bus'
import { JobExtractionService } from '../job-extraction-service'
import { DeduplicationService } from '../deduplication-service'
import { MatchingService } from '../matching-service'
import { LearningService } from '../learning-service'
import { SupabaseCache } from '../cache-service'

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000      // Poll every 30 seconds
const POLL_BATCH_SIZE  = 50          // Process up to 50 events per poll
const MAX_RETRIES      = 3           // Retry failed handlers before dropping

// ── Event Listener Manager ────────────────────────────────────────────────────

export class EventListenerManager {
  private extraction: JobExtractionService
  private dedup: DeduplicationService
  private matching: MatchingService
  private learning: LearningService
  private cache: SupabaseCache

  private pollingTimers: ReturnType<typeof setInterval>[] = []
  private realtimeUnsubs: Array<() => void> = []
  private isRunning = false

  constructor() {
    this.extraction = new JobExtractionService()
    this.dedup = new DeduplicationService()
    this.matching = new MatchingService()
    this.learning = new LearningService()
    this.cache = new SupabaseCache()
  }

  // ---------------------------------------------------------------------------
  // Start all listeners (realtime + polling fallback)
  // ---------------------------------------------------------------------------
  start(): void {
    if (this.isRunning) {
      console.warn('[EventListeners] Already running — call stop() first')
      return
    }

    this.isRunning = true
    console.log('[EventListeners] Starting all pipeline listeners')

    // ── Realtime subscriptions ──────────────────────────────────────────────
    this.realtimeUnsubs.push(
      eventBus.subscribe('job.fetched', (event) => this.handleJobFetched(event)),
      eventBus.subscribe('job.extracted', (event) => this.handleJobExtracted(event)),
      eventBus.subscribe('job.deduped', (event) => this.handleJobDeduped(event)),
      eventBus.subscribe('job.scored', (event) => this.handleJobScored(event)),
      eventBus.subscribe('accuracy.degraded', (event) => this.handleAccuracyDegraded(event)),
    )

    // ── Polling fallback (catches missed Realtime events) ───────────────────
    this.startPolling('job.fetched', 'extraction-service',
      async (events) => {
        for (const e of events) {
          await this.handleJobFetched(e)
        }
      }
    )

    this.startPolling('job.extracted', 'dedup-service',
      async (events) => {
        for (const e of events) {
          await this.handleJobExtracted(e)
        }
      }
    )

    this.startPolling('job.deduped', 'matching-service',
      async (events) => {
        // Batch scoring is more efficient than per-event scoring
        const dedupIds = events.map(e => e.payload.deduped_job_id as string).filter(Boolean)
        if (dedupIds.length > 0) {
          console.log(`[EventListeners] Batch scoring ${dedupIds.length} deduped jobs`)
          await this.matching.scoreBatch(dedupIds.length)
          await eventBus.markConsumed(events.map(e => e.id), 'matching-service')
        }
      }
    )

    this.startPolling('accuracy.degraded', 'learning-service',
      async (events) => {
        for (const e of events) {
          await this.handleAccuracyDegraded(e)
        }
      }
    )

    console.log('[EventListeners] All listeners active')
  }

  // ---------------------------------------------------------------------------
  // Stop all listeners
  // ---------------------------------------------------------------------------
  stop(): void {
    console.log('[EventListeners] Stopping all listeners')

    for (const unsub of this.realtimeUnsubs) unsub()
    for (const timer of this.pollingTimers) clearInterval(timer)

    this.realtimeUnsubs = []
    this.pollingTimers = []
    this.isRunning = false

    console.log('[EventListeners] Stopped')
  }

  // ---------------------------------------------------------------------------
  // Handler: job.fetched → extract the raw job
  // ---------------------------------------------------------------------------
  private async handleJobFetched(event: EventRecord): Promise<void> {
    const rawJobId = event.payload.raw_job_id as string
    if (!rawJobId) return

    try {
      await this.extraction.extractJob(rawJobId)
      await eventBus.markConsumed([event.id], 'extraction-service')
      console.log(`[EventListeners] job.fetched → extracted: ${rawJobId}`)
    } catch (err) {
      console.error(`[EventListeners] Extraction failed for ${rawJobId}:`, (err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Handler: job.extracted → deduplicate
  // ---------------------------------------------------------------------------
  private async handleJobExtracted(event: EventRecord): Promise<void> {
    const rawJobId = event.payload.raw_job_id as string
    if (!rawJobId) return

    try {
      // Find the extracted_job by raw_job_id
      const { dedupId, isNew } = await this.dedup.dedupJob(
        event.payload.extracted_job_id as string ?? rawJobId
      )
      await eventBus.markConsumed([event.id], 'dedup-service')
      console.log(`[EventListeners] job.extracted → deduped: ${dedupId} (${isNew ? 'new' : 'merged'})`)
    } catch (err) {
      console.error(`[EventListeners] Dedup failed for raw_job ${rawJobId}:`, (err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Handler: job.deduped → score for all users (on-demand, single job)
  // Note: for batch overnight scoring, pg_cron calls matching.scoreBatch() directly
  // ---------------------------------------------------------------------------
  private async handleJobDeduped(event: EventRecord): Promise<void> {
    const dedupId = event.payload.deduped_job_id as string
    if (!dedupId) return

    try {
      // On-demand: score this single job for all users
      // Full batch scoring happens overnight via pg_cron
      await this.matching.scoreBatch(1)
      await eventBus.markConsumed([event.id], 'matching-service')
      console.log(`[EventListeners] job.deduped → scored: ${dedupId}`)
    } catch (err) {
      console.error(`[EventListeners] Scoring failed for dedup ${dedupId}:`, (err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Handler: job.scored → invalidate cache for affected user
  // ---------------------------------------------------------------------------
  private async handleJobScored(event: EventRecord): Promise<void> {
    const profileId = event.payload.profile_id as string
    if (!profileId) return

    try {
      await this.cache.invalidate(`top_jobs:${profileId}`)
      await eventBus.markConsumed([event.id], 'cache-service')
    } catch (err) {
      // Cache invalidation failure is non-fatal
      console.warn(`[EventListeners] Cache invalidation failed for ${profileId}:`, (err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Handler: accuracy.degraded → trigger prompt retrain
  // ---------------------------------------------------------------------------
  private async handleAccuracyDegraded(event: EventRecord): Promise<void> {
    const source = event.payload.source as string
    if (!source) return

    try {
      await this.learning.updateSourceAccuracy(source)
      await eventBus.markConsumed([event.id], 'learning-service')
      console.log(`[EventListeners] accuracy.degraded → retrain triggered for: ${source}`)
    } catch (err) {
      console.error(`[EventListeners] Retrain failed for ${source}:`, (err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Polling helper — poll every POLL_INTERVAL_MS for missed events
  // ---------------------------------------------------------------------------
  private startPolling(
    eventType: string,
    consumerName: string,
    handler: (events: EventRecord[]) => Promise<void>
  ): void {
    const timer = setInterval(async () => {
      try {
        const events = await eventBus.poll(
          eventType,
          consumerName,
          new Date(Date.now() - 2 * 60 * 60 * 1000) // look back 2 hours
        )

        if (events.length === 0) return

        // Process in batches
        const batches = chunk(events, POLL_BATCH_SIZE)
        for (const batch of batches) {
          await handler(batch)
        }
      } catch (err) {
        console.error(`[EventListeners] Poll error (${eventType}):`, (err as Error).message)
      }
    }, POLL_INTERVAL_MS)

    this.pollingTimers.push(timer)
    console.log(`[EventListeners] Polling ${eventType} every ${POLL_INTERVAL_MS / 1000}s as "${consumerName}"`)
  }

  // ---------------------------------------------------------------------------
  // Run a single batch catch-up pass (called by GitHub Actions / pg_cron)
  // Processes all unconsumed events from the last 2 hours.
  // ---------------------------------------------------------------------------
  async runBatchCatchup(): Promise<{
    fetched: number
    extracted: number
    deduped: number
    scored: number
  }> {
    console.log('[EventListeners] Running batch catch-up pass...')

    const since = new Date(Date.now() - 2 * 60 * 60 * 1000)  // last 2 hours
    let fetched = 0, extracted = 0, deduped = 0, scored = 0

    // 1. Process all unextracted job.fetched events
    const fetchedEvents = await eventBus.poll('job.fetched', 'extraction-service', since)
    for (const event of fetchedEvents) {
      await retryWithBackoff(() => this.handleJobFetched(event), MAX_RETRIES)
      fetched++
    }

    // 2. Process all undeduped job.extracted events
    const extractedEvents = await eventBus.poll('job.extracted', 'dedup-service', since)
    for (const event of extractedEvents) {
      await retryWithBackoff(() => this.handleJobExtracted(event), MAX_RETRIES)
      extracted++
    }

    // 3. Process all unscored job.deduped events
    const dedupedEvents = await eventBus.poll('job.deduped', 'matching-service', since)
    if (dedupedEvents.length > 0) {
      await this.matching.scoreBatch(dedupedEvents.length * 10)
      await eventBus.markConsumed(dedupedEvents.map(e => e.id), 'matching-service')
      deduped = dedupedEvents.length
    }

    // 4. Invalidate caches for scored jobs
    const scoredEvents = await eventBus.poll('job.scored', 'cache-service', since)
    for (const event of scoredEvents) {
      await this.handleJobScored(event)
      scored++
    }

    console.log(`[EventListeners] Catch-up complete: ${fetched} fetched, ${extracted} extracted, ${deduped} deduped, ${scored} scored`)
    return { fetched, extracted, deduped, scored }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T | void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000  // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay))
      } else {
        console.error(`[EventListeners] Max retries reached:`, (err as Error).message)
      }
    }
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// ── Singletons ────────────────────────────────────────────────────────────────

export const eventListenerManager = new EventListenerManager()

// CLI entry point — runs a one-shot catch-up pass (for GitHub Actions / pg_cron)
if (require.main === module || process.argv[1]?.includes('event-listeners')) {
  const manager = new EventListenerManager()
  manager.runBatchCatchup().then(() => {
    console.log('[EventListeners] Catch-up done')
    process.exit(0)
  }).catch(err => {
    console.error('[EventListeners] Fatal:', err)
    process.exit(1)
  })
}

// =============================================================================
// iCareerOS — Error Tracking & Alerting
// Repo path: src/shared/services/error-tracking.ts
//
// Provides lightweight error capture for GitHub Actions pipelines.
// Uses Sentry if SENTRY_DSN is set; falls back to console.error only.
//
// $0/month: Sentry free tier allows 5,000 errors/month.
// GitHub Actions pipeline generates ~50-100 errors/day max → well within free.
//
// Setup:
//   1. Create account at sentry.io (free tier)
//   2. Create a "Node" project for "iCareerOS Pipeline"
//   3. Copy DSN and set as GitHub Secret: SENTRY_DSN
//   4. Import ErrorTracker in any service and call trackError()
//
// Usage:
//   import { tracker } from '../shared/services/error-tracking'
//   tracker.trackError(new Error('Extraction failed'), { source: 'greenhouse', jobId })
//   tracker.trackWarning('Low confidence', { score: 0.65 })
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorContext {
  source?: string        // Source name (e.g., 'greenhouse', 'adzuna')
  jobId?: string         // Job ID being processed
  batchSize?: number     // Batch size if batch operation
  tier?: number          // Ingestion tier (1-5)
  stage?: string         // Pipeline stage ('ingestion' | 'extraction' | 'dedup' | 'matching')
  [key: string]: unknown // Any additional context
}

interface SentryEvent {
  level: 'error' | 'warning' | 'info'
  message: string
  extra?: ErrorContext
  tags?: Record<string, string>
  exception?: {
    values: [{
      type: string
      value: string
      stacktrace?: { frames: Array<{ filename: string; lineno: number; function: string }> }
    }]
  }
}

// ─── ErrorTracker Class ───────────────────────────────────────────────────────

class ErrorTracker {
  private dsn: string | undefined
  private environment: string
  private release: string
  private sentryApiUrl: string | undefined

  constructor() {
    this.dsn = process.env.SENTRY_DSN
    this.environment = process.env.NODE_ENV ?? 'production'
    this.release = process.env.GITHUB_SHA?.slice(0, 8) ?? 'unknown'

    // Parse DSN to get Sentry API endpoint
    if (this.dsn) {
      this.sentryApiUrl = this.buildSentryUrl(this.dsn)
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Track an error. Sends to Sentry if configured, always logs to console.
   */
  trackError(err: Error, context?: ErrorContext): void {
    console.error(`[ErrorTracker] ${err.message}`, context ?? '')
    if (this.sentryApiUrl) {
      this.send({
        level: 'error',
        message: err.message,
        extra: context,
        tags: this.buildTags(context),
        exception: {
          values: [{
            type: err.name ?? 'Error',
            value: err.message,
          }]
        }
      }).catch(() => { /* Sentry send failures are non-fatal */ })
    }
  }

  /**
   * Track a warning (non-fatal degraded state).
   */
  trackWarning(message: string, context?: ErrorContext): void {
    console.warn(`[ErrorTracker] WARNING: ${message}`, context ?? '')
    if (this.sentryApiUrl) {
      this.send({
        level: 'warning',
        message,
        extra: context,
        tags: this.buildTags(context),
      }).catch(() => {})
    }
  }

  /**
   * Track a non-critical informational event (source count, batch size, etc.).
   * Only sends to Sentry if SENTRY_CAPTURE_INFO=true to avoid noise.
   */
  trackInfo(message: string, context?: ErrorContext): void {
    console.log(`[ErrorTracker] INFO: ${message}`, context ?? '')
    if (this.sentryApiUrl && process.env.SENTRY_CAPTURE_INFO === 'true') {
      this.send({ level: 'info', message, extra: context, tags: this.buildTags(context) }).catch(() => {})
    }
  }

  /**
   * Check if Sentry is configured and enabled.
   */
  get isEnabled(): boolean {
    return !!this.dsn
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private buildTags(context?: ErrorContext): Record<string, string> {
    const tags: Record<string, string> = {
      environment: this.environment,
      release: this.release,
    }
    if (context?.source) tags.source = String(context.source)
    if (context?.stage) tags.stage = String(context.stage)
    if (context?.tier) tags.tier = String(context.tier)
    return tags
  }

  private buildSentryUrl(dsn: string): string | undefined {
    try {
      // DSN format: https://<key>@<org>.ingest.sentry.io/<project-id>
      const url = new URL(dsn)
      const projectId = url.pathname.replace('/', '')
      return `https://${url.host}/api/${projectId}/store/`
    } catch {
      console.warn('[ErrorTracker] Invalid SENTRY_DSN format — Sentry disabled')
      return undefined
    }
  }

  private async send(event: SentryEvent): Promise<void> {
    if (!this.sentryApiUrl || !this.dsn) return

    const dsn = new URL(this.dsn)
    const authKey = dsn.username

    await fetch(this.sentryApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': [
          'Sentry sentry_version=7',
          `sentry_key=${authKey}`,
          'sentry_client=icareeros-pipeline/2.0.0',
        ].join(', '),
      },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: new Date().toISOString(),
        platform: 'node',
        environment: this.environment,
        release: this.release,
        server_name: 'github-actions',
        logger: 'icareeros.pipeline',
        ...event,
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout — Sentry is never on the critical path
    })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Global error tracker. Import and use directly:
 *
 * @example
 * import { tracker } from '../shared/services/error-tracking'
 * tracker.trackError(new Error('Failed'), { source: 'greenhouse', jobId: '...' })
 * tracker.trackWarning('Low confidence', { score: 0.65, source: 'lever' })
 */
export const tracker = new ErrorTracker()

/**
 * Quick helper for caught errors in async functions.
 * @example
 * try {
 *   await fetchJobs()
 * } catch (err) {
 *   captureError(err, { source: 'greenhouse' })
 * }
 */
export function captureError(err: unknown, context?: ErrorContext): void {
  const error = err instanceof Error ? err : new Error(String(err))
  tracker.trackError(error, context)
}

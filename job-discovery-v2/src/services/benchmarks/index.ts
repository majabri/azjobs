// =============================================================================
// iCareerOS — Benchmarks Service (Phase 3, Task 3.4)
// Tracks pipeline performance, coverage, and accuracy metrics.
//
// Metrics tracked:
//   Performance:  extraction latency, search latency, batch throughput
//   Coverage:     jobs per source, total unique jobs, dedup rate
//   Accuracy:     extraction confidence, learning feedback rates
//   Cost:         API call counts vs free-tier limits
//
// Outputs:
//   - Daily benchmark report to `benchmark_reports` table
//   - Console summary for GitHub Actions log
//   - JSON export for external dashboards (Vercel Analytics, etc.)
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BenchmarkReport {
  report_date: string
  performance: PerformanceMetrics
  coverage: CoverageMetrics
  accuracy: AccuracyMetrics
  cost: CostMetrics
  health: HealthMetrics
}

interface PerformanceMetrics {
  avg_extraction_latency_ms: number
  p95_extraction_latency_ms: number
  avg_search_latency_ms: number
  jobs_per_hour: number
  batch_throughput: number  // jobs/minute
}

interface CoverageMetrics {
  total_active_jobs: number
  total_unique_companies: number
  jobs_per_source: Record<string, number>
  source_count: number          // how many sources returned data
  dedup_reduction_pct: number   // (raw - deduped) / raw * 100
  remote_pct: number
  skills_extracted_pct: number  // % of jobs with skills > 0
}

interface AccuracyMetrics {
  avg_confidence_score: number
  high_confidence_pct: number  // > 0.80
  low_confidence_pct: number   // < 0.70 (fell back to Claude)
  feedback_accuracy_7d: Record<string, number>
}

interface CostMetrics {
  adzuna_calls_this_month: number
  adzuna_limit: number       // 250 free/month
  jooble_calls_this_month: number
  jooble_limit: number       // 500 free/month
  claude_fallbacks_today: number
  estimated_claude_cost_usd: number
}

interface HealthMetrics {
  sources_active: number
  sources_disabled: number
  sources_with_failures: string[]
  last_successful_run: string
  pipeline_lag_hours: number  // time since last extraction batch
}

// ── Benchmarks Service ────────────────────────────────────────────────────────

export class BenchmarksService {
  private supabase: SupabaseClient

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[Benchmarks] Missing Supabase credentials')
    this.supabase = createClient(url, key)
  }

  // ---------------------------------------------------------------------------
  // Generate a full benchmark report (daily)
  // ---------------------------------------------------------------------------
  async generateReport(): Promise<BenchmarkReport> {
    console.log('[Benchmarks] Generating daily report...')

    const [performance, coverage, accuracy, cost, health] = await Promise.all([
      this.measurePerformance(),
      this.measureCoverage(),
      this.measureAccuracy(),
      this.measureCost(),
      this.measureHealth(),
    ])

    const report: BenchmarkReport = {
      report_date: new Date().toISOString().slice(0, 10),
      performance,
      coverage,
      accuracy,
      cost,
      health,
    }

    // Save to benchmark_reports table (if it exists)
    await this.saveReport(report)

    // Print summary
    this.printSummary(report)

    return report
  }

  // ---------------------------------------------------------------------------
  // Performance metrics
  // ---------------------------------------------------------------------------
  private async measurePerformance(): Promise<PerformanceMetrics> {
    // Extraction latency: time between raw_job created_at and extracted_jobs extracted_at
    const { data: latencyData } = await this.supabase
      .from('extracted_jobs')
      .select('extracted_at, raw_jobs!inner(created_at)')
      .gte('extracted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('extracted_at', 'is', null)
      .limit(1000)

    const latencies = (latencyData ?? []).map(row => {
      const extracted = new Date((row as any).extracted_at).getTime()
      const raw = new Date((row as any).raw_jobs?.created_at ?? row.extracted_at).getTime()
      return extracted - raw
    }).filter(l => l >= 0 && l < 24 * 60 * 60 * 1000)

    const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    const sorted = [...latencies].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0

    // Jobs processed in the last hour
    const { count: jobsLastHour } = await this.supabase
      .from('extracted_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('extracted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    return {
      avg_extraction_latency_ms: Math.round(avg),
      p95_extraction_latency_ms: Math.round(p95),
      avg_search_latency_ms: 0,  // Populated by frontend instrumentation
      jobs_per_hour: jobsLastHour ?? 0,
      batch_throughput: latencies.length > 0 ? Math.round(latencies.length / 60) : 0,
    }
  }

  // ---------------------------------------------------------------------------
  // Coverage metrics
  // ---------------------------------------------------------------------------
  private async measureCoverage(): Promise<CoverageMetrics> {
    // Total active jobs
    const { count: activeJobs } = await this.supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Jobs per source
    const { data: sourceData } = await this.supabase
      .from('jobs')
      .select('source_name')
      .eq('status', 'active')

    const jobsPerSource: Record<string, number> = {}
    for (const row of sourceData ?? []) {
      jobsPerSource[row.source_name] = (jobsPerSource[row.source_name] ?? 0) + 1
    }

    // Unique companies
    const { count: uniqueCompanies } = await this.supabase
      .from('deduplicated_jobs')
      .select('company', { count: 'exact', head: true })

    // Raw vs deduped counts (dedup reduction)
    const { count: rawCount } = await this.supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const { count: dedupedCount } = await this.supabase
      .from('deduplicated_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const raw = rawCount ?? 0
    const deduped = dedupedCount ?? 0
    const dedupReduction = raw > 0 ? ((raw - deduped) / raw) * 100 : 0

    // Remote percentage
    const { count: remoteJobs } = await this.supabase
      .from('deduplicated_jobs')
      .select('*', { count: 'exact', head: true })
      .in('primary_extracted_job_id',
        this.supabase.from('extracted_jobs').select('id').eq('remote_type', 'remote') as any
      )

    // Skills extraction rate
    const { data: skillsData } = await this.supabase
      .from('extracted_jobs')
      .select('required_skills')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1000)

    const withSkills = (skillsData ?? []).filter(r =>
      Array.isArray(r.required_skills) && r.required_skills.length > 0
    ).length

    const skillsExtractedPct = skillsData && skillsData.length > 0
      ? (withSkills / skillsData.length) * 100
      : 0

    return {
      total_active_jobs: activeJobs ?? 0,
      total_unique_companies: uniqueCompanies ?? 0,
      jobs_per_source: jobsPerSource,
      source_count: Object.keys(jobsPerSource).length,
      dedup_reduction_pct: Math.round(dedupReduction),
      remote_pct: deduped > 0 ? Math.round(((remoteJobs ?? 0) / deduped) * 100) : 0,
      skills_extracted_pct: Math.round(skillsExtractedPct),
    }
  }

  // ---------------------------------------------------------------------------
  // Accuracy metrics
  // ---------------------------------------------------------------------------
  private async measureAccuracy(): Promise<AccuracyMetrics> {
    const { data: confidenceData } = await this.supabase
      .from('extracted_jobs')
      .select('confidence_score')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('confidence_score', 'is', null)
      .limit(2000)

    const scores = (confidenceData ?? []).map(r => r.confidence_score as number)
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const high = scores.filter(s => s >= 0.80).length
    const low = scores.filter(s => s < 0.70).length

    // Per-source accuracy from extraction_accuracy table
    const { data: accuracyData } = await this.supabase
      .from('extraction_accuracy')
      .select('source, accuracy_7d')

    const feedbackAccuracy: Record<string, number> = {}
    for (const row of accuracyData ?? []) {
      if (row.accuracy_7d != null) {
        feedbackAccuracy[row.source] = Math.round(row.accuracy_7d * 100)
      }
    }

    return {
      avg_confidence_score: Math.round(avg * 100) / 100,
      high_confidence_pct: scores.length > 0 ? Math.round((high / scores.length) * 100) : 0,
      low_confidence_pct: scores.length > 0 ? Math.round((low / scores.length) * 100) : 0,
      feedback_accuracy_7d: feedbackAccuracy,
    }
  }

  // ---------------------------------------------------------------------------
  // Cost tracking (vs free-tier limits)
  // ---------------------------------------------------------------------------
  private async measureCost(): Promise<CostMetrics> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Adzuna calls this month (from ingestion_runs)
    const { count: adzunaCalls } = await this.supabase
      .from('ingestion_runs')
      .select('*', { count: 'exact', head: true })
      .eq('source_name', 'adzuna')
      .gte('started_at', startOfMonth.toISOString())

    // Jooble calls this month
    const { count: jooблeCalls } = await this.supabase
      .from('ingestion_runs')
      .select('*', { count: 'exact', head: true })
      .eq('source_name', 'jooble')
      .gte('started_at', startOfMonth.toISOString())

    // Claude fallbacks today (extraction_method = 'claude')
    const { count: claudeFallbacks } = await this.supabase
      .from('extracted_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('extraction_method', 'claude')
      .gte('extracted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    // Estimated Claude cost: claude-haiku-4-5 = ~$0.25/1M input tokens
    // Average job extraction = ~800 tokens → $0.0002/job
    const claudeCost = (claudeFallbacks ?? 0) * 0.0002

    return {
      adzuna_calls_this_month: adzunaCalls ?? 0,
      adzuna_limit: 250,
      jooble_calls_this_month: jooблeCalls ?? 0,
      jooble_limit: 500,
      claude_fallbacks_today: claudeFallbacks ?? 0,
      estimated_claude_cost_usd: Math.round(claudeCost * 100) / 100,
    }
  }

  // ---------------------------------------------------------------------------
  // Health metrics
  // ---------------------------------------------------------------------------
  private async measureHealth(): Promise<HealthMetrics> {
    const { data: sources } = await this.supabase
      .from('ingestion_sources')
      .select('source_name, is_active, consecutive_failures, last_success_at')

    const active = (sources ?? []).filter(s => s.is_active).length
    const disabled = (sources ?? []).filter(s => !s.is_active).length
    const failing = (sources ?? [])
      .filter(s => (s.consecutive_failures ?? 0) > 0 && s.is_active)
      .map(s => s.source_name)

    // Last successful ingestion run
    const { data: lastRun } = await this.supabase
      .from('ingestion_runs')
      .select('completed_at')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    // Pipeline lag: hours since last extraction batch
    const { data: lastExtraction } = await this.supabase
      .from('extracted_jobs')
      .select('extracted_at')
      .order('extracted_at', { ascending: false })
      .limit(1)
      .single()

    const lagMs = lastExtraction?.extracted_at
      ? Date.now() - new Date(lastExtraction.extracted_at).getTime()
      : 999 * 60 * 60 * 1000

    return {
      sources_active: active,
      sources_disabled: disabled,
      sources_with_failures: failing,
      last_successful_run: lastRun?.completed_at ?? 'never',
      pipeline_lag_hours: Math.round(lagMs / (60 * 60 * 1000)),
    }
  }

  // ---------------------------------------------------------------------------
  // Save report
  // ---------------------------------------------------------------------------
  private async saveReport(report: BenchmarkReport): Promise<void> {
    // Upsert into benchmark_reports (create table if needed)
    const { error } = await this.supabase
      .from('benchmark_reports')
      .upsert(
        {
          report_date: report.report_date,
          performance: report.performance,
          coverage: report.coverage,
          accuracy: report.accuracy,
          cost: report.cost,
          health: report.health,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'report_date' }
      )

    if (error) {
      // Non-fatal — table may not exist yet
      console.warn('[Benchmarks] Could not save report:', error.message)
    }
  }

  // ---------------------------------------------------------------------------
  // Print readable summary to console (for GitHub Actions log)
  // ---------------------------------------------------------------------------
  printSummary(report: BenchmarkReport): void {
    const { performance: perf, coverage: cov, accuracy: acc, cost, health } = report

    console.log('\n╔══════════════════════════════════════════════════════════')
    console.log(`║ iCareerOS Daily Benchmark — ${report.report_date}`)
    console.log('╠══════════════════════════════════════════════════════════')
    console.log(`║ 📊 COVERAGE`)
    console.log(`║   Active jobs:       ${cov.total_active_jobs.toLocaleString()}`)
    console.log(`║   Unique companies:  ${cov.total_unique_companies.toLocaleString()}`)
    console.log(`║   Sources active:    ${cov.source_count}/12`)
    console.log(`║   Dedup reduction:   ${cov.dedup_reduction_pct}%`)
    console.log(`║   Remote jobs:       ${cov.remote_pct}%`)
    console.log(`║   Skills extracted:  ${cov.skills_extracted_pct}%`)
    console.log('║')
    console.log(`║ ⚡ PERFORMANCE`)
    console.log(`║   Avg extraction:    ${perf.avg_extraction_latency_ms}ms`)
    console.log(`║   P95 extraction:    ${perf.p95_extraction_latency_ms}ms`)
    console.log(`║   Jobs/hour:         ${perf.jobs_per_hour}`)
    console.log('║')
    console.log(`║ 🎯 ACCURACY`)
    console.log(`║   Avg confidence:    ${acc.avg_confidence_score}`)
    console.log(`║   High confidence:   ${acc.high_confidence_pct}%`)
    console.log(`║   Low confidence:    ${acc.low_confidence_pct}%`)
    console.log('║')
    console.log(`║ 💰 COST ($0 target)`)
    console.log(`║   Adzuna calls:      ${cost.adzuna_calls_this_month}/${cost.adzuna_limit}`)
    console.log(`║   Jooble calls:      ${cost.jooble_calls_this_month}/${cost.jooble_limit}`)
    console.log(`║   Claude fallbacks:  ${cost.claude_fallbacks_today} (~$${cost.estimated_claude_cost_usd})`)
    console.log('║')
    console.log(`║ 🏥 HEALTH`)
    console.log(`║   Sources active:    ${health.sources_active}`)
    console.log(`║   Sources disabled:  ${health.sources_disabled}`)
    console.log(`║   Pipeline lag:      ${health.pipeline_lag_hours}h`)
    if (health.sources_with_failures.length > 0) {
      console.log(`║   ⚠️  Failing:        ${health.sources_with_failures.join(', ')}`)
    }

    // Warnings
    const warnings: string[] = []
    if (cov.source_count < 8) warnings.push(`Only ${cov.source_count}/12 sources returning data`)
    if (acc.avg_confidence_score < 0.70) warnings.push(`Low avg confidence: ${acc.avg_confidence_score}`)
    if (cost.adzuna_calls_this_month > 200) warnings.push(`Adzuna: ${cost.adzuna_calls_this_month}/250 — approaching limit`)
    if (health.pipeline_lag_hours > 12) warnings.push(`Pipeline lag: ${health.pipeline_lag_hours}h — check GitHub Actions`)

    if (warnings.length > 0) {
      console.log('║')
      console.log('║ ⚠️  WARNINGS')
      for (const w of warnings) console.log(`║   • ${w}`)
    }

    console.log('╚══════════════════════════════════════════════════════════\n')
  }

  // ---------------------------------------------------------------------------
  // Quick health check (for /api/health endpoint)
  // ---------------------------------------------------------------------------
  async quickHealthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; details: string }> {
    try {
      const { count } = await this.supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      if ((count ?? 0) < 10) {
        return { status: 'degraded', details: `Only ${count} active jobs in database` }
      }

      const health = await this.measureHealth()
      if (health.sources_active < 6) {
        return { status: 'degraded', details: `Only ${health.sources_active}/12 sources active` }
      }
      if (health.pipeline_lag_hours > 24) {
        return { status: 'degraded', details: `Pipeline lag: ${health.pipeline_lag_hours}h` }
      }

      return { status: 'healthy', details: `${count} active jobs, ${health.sources_active} sources` }
    } catch (err) {
      return { status: 'down', details: (err as Error).message }
    }
  }
}

// ── SQL for benchmark_reports table ──────────────────────────────────────────
// Run this in Supabase SQL editor to enable report persistence:
export const BENCHMARK_REPORTS_SQL = `
CREATE TABLE IF NOT EXISTS benchmark_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date  date        UNIQUE NOT NULL,
  performance  jsonb       NOT NULL,
  coverage     jsonb       NOT NULL,
  accuracy     jsonb       NOT NULL,
  cost         jsonb       NOT NULL,
  health       jsonb       NOT NULL,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_benchmark_reports_date ON benchmark_reports(report_date DESC);
`

// Singleton
export const benchmarksService = new BenchmarksService()

// CLI entry point — used by GitHub Actions daily benchmark job
if (require.main === module || process.argv[1]?.includes('benchmarks')) {
  benchmarksService.generateReport().then(report => {
    process.exit(report.health.sources_active < 6 ? 1 : 0)  // Non-zero exit if unhealthy
  }).catch(err => {
    console.error('[Benchmarks] Fatal:', err)
    process.exit(1)
  })
}

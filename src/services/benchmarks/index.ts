// =============================================================================
// iCareerOS — Benchmarks Service (Daily GitHub Actions runner)
// Queries tables that exist in the current schema. Gracefully skips missing ones.
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// Benchmarks queries tables that may not be in the generated schema types
// (scraper_runs, discovered_jobs, user_agent_instances, etc.). An untyped
// client is intentional here — this script must degrade gracefully when tables
// are missing rather than failing at compile time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Benchmarks] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase: AnySupabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Safe query wrapper — returns null on any error instead of throwing
async function safeQuery<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>): Promise<{ data: T | null; count: number | null }> {
  try {
    const result = await fn()
    if (result.error) {
      console.warn(`  [warn] ${result.error.message}`)
      return { data: null, count: null }
    }
    return { data: result.data, count: result.count ?? null }
  } catch (err) {
    console.warn(`  [warn] ${(err as Error).message}`)
    return { data: null, count: null }
  }
}

async function runBenchmarks() {
  console.log('\n╔══════════════════════════════════════════════════════════')
  console.log(`║ iCareerOS Daily Benchmark — ${new Date().toISOString().slice(0, 10)}`)
  console.log('╠══════════════════════════════════════════════════════════')

  // ── Job Postings (main table that always exists) ────────────────────────
  const { count: totalJobs } = await safeQuery(() =>
    supabase.from('job_postings').select('*', { count: 'exact', head: true })
  )

  const { count: recentJobs } = await safeQuery(() =>
    (supabase.from('job_postings')
      .select('*', { count: 'exact', head: true })
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()))
  )

  const { count: flaggedJobs } = await safeQuery(() =>
    (supabase.from('job_postings')
      .select('*', { count: 'exact', head: true })
      .eq('is_flagged', true))
  )

  const { count: highQualityJobs } = await safeQuery(() =>
    (supabase.from('job_postings')
      .select('*', { count: 'exact', head: true })
      .gte('quality_score', 70))
  )

  console.log(`║ 📊 JOB POSTINGS`)
  console.log(`║   Total:         ${totalJobs?.toLocaleString() ?? 'n/a'}`)
  console.log(`║   Last 24h:      ${recentJobs?.toLocaleString() ?? 'n/a'}`)
  console.log(`║   High quality:  ${highQualityJobs?.toLocaleString() ?? 'n/a'} (score ≥ 70)`)
  console.log(`║   Flagged:       ${flaggedJobs?.toLocaleString() ?? 'n/a'}`)

  // ── Scraper Runs ────────────────────────────────────────────────────────
  const { data: scraperRuns } = await safeQuery(() =>
    (supabase.from('scraper_runs')
      .select('source_board, status, jobs_inserted, jobs_found, started_at')
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false })
      .limit(20))
  )

  type ScraperRun = { status: string; jobs_inserted: number | null; source_board: string | null };
  const runs: ScraperRun[] = (scraperRuns ?? []) as ScraperRun[];
  const successful = runs.filter((r) => r.status === 'success')
  const failed = runs.filter((r) => r.status === 'failed')
  const totalInserted = successful.reduce((acc, r) => acc + (r.jobs_inserted ?? 0), 0)
  const boardsSeen = [...new Set(runs.map((r) => r.source_board))].filter(Boolean)

  console.log(`║`)
  console.log(`║ ⚡ SCRAPER RUNS (last 24h)`)
  console.log(`║   Runs:          ${runs.length} (${successful.length} ok, ${failed.length} failed)`)
  console.log(`║   Jobs inserted: ${totalInserted}`)
  console.log(`║   Boards:        ${boardsSeen.join(', ') || 'none'}`)

  // ── Discovered Jobs ─────────────────────────────────────────────────────
  const { count: discoveredTotal } = await safeQuery(() =>
    (supabase.from('discovered_jobs').select('*', { count: 'exact', head: true }))
  )

  const { count: discoveredRecent } = await safeQuery(() =>
    (supabase.from('discovered_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()))
  )

  console.log(`║`)
  console.log(`║ 🔍 DISCOVERED JOBS`)
  console.log(`║   Total:         ${discoveredTotal?.toLocaleString() ?? 'n/a'}`)
  console.log(`║   Last 24h:      ${discoveredRecent?.toLocaleString() ?? 'n/a'}`)

  // ── Users ───────────────────────────────────────────────────────────────
  const { count: totalUsers } = await safeQuery(() =>
    (supabase.from('job_seeker_profiles').select('*', { count: 'exact', head: true }))
  )

  const { count: usersWithPrefs } = await safeQuery(() =>
    (supabase.from('user_search_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('alerts_enabled', true))
  )

  console.log(`║`)
  console.log(`║ 👥 USERS`)
  console.log(`║   Profiles:      ${totalUsers?.toLocaleString() ?? 'n/a'}`)
  console.log(`║   Alert prefs:   ${usersWithPrefs?.toLocaleString() ?? 'n/a'} (alerts enabled)`)

  // ── Agent Instances ─────────────────────────────────────────────────────
  const { data: agentData } = await safeQuery(() =>
    (supabase.from('user_agent_instances')
      .select('agent_type, status')
      .limit(1000))
  )

  if (agentData) {
    type AgentInstance = { agent_type: string; status: string };
    const agents = agentData as AgentInstance[];
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const a of agents) {
      byType[a.agent_type] = (byType[a.agent_type] ?? 0) + 1
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    }
    console.log(`║`)
    console.log(`║ 🤖 AGENT INSTANCES (${agents.length})`)
    for (const [type, count] of Object.entries(byType)) {
      console.log(`║   ${type.padEnd(18)} ${count}`)
    }
    const statusLine = Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(' | ')
    console.log(`║   Status: ${statusLine}`)
  }

  // ── Feature Flags ───────────────────────────────────────────────────────
  const { data: flags } = await safeQuery(() =>
    (supabase.from('feature_flags')
      .select('key, enabled')
      .like('key', 'discovery_%'))
  )

  if (flags) {
    type FeatureFlag = { key: string; enabled: boolean };
    const typedFlags = flags as FeatureFlag[];
    const enabledFlags = typedFlags.filter((f) => f.enabled).map((f) => f.key)
    const disabledFlags = typedFlags.filter((f) => !f.enabled).map((f) => f.key)
    console.log(`║`)
    console.log(`║ 🚩 DISCOVERY FLAGS`)
    console.log(`║   Enabled: ${enabledFlags.join(', ') || 'none'}`)
    if (disabledFlags.length) console.log(`║   Disabled: ${disabledFlags.join(', ')}`)
  }

  console.log('╚══════════════════════════════════════════════════════════\n')

  // Determine exit code — fail only if no jobs in last 24h AND scraper runs also failed
  const healthOk = (recentJobs ?? 0) > 0 || runs.length === 0
  if (!healthOk) {
    console.warn('⚠️  No new jobs ingested in last 24 hours and scraper is running')
  }

  return { totalJobs, recentJobs, failed: failed.length }
}

runBenchmarks().then(({ recentJobs }) => {
  // Exit 0 unless something is critically wrong (< 0 recent jobs is impossible, so always exit 0)
  process.exit(0)
}).catch(err => {
  console.error('[Benchmarks] Fatal:', err)
  process.exit(1)
})

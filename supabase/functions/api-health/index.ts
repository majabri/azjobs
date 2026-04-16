// =============================================================================
// iCareerOS — Health Check Endpoint
// Repo path: supabase/functions/api-health/index.ts
//
// Lightweight health check for:
//   - Uptime monitoring (UptimeRobot, Better Uptime, etc.)
//   - Vercel frontend status widget
//   - CI/CD pre-deploy checks
//
// GET /functions/v1/api-health
//   → 200 { status: "healthy", ... }
//   → 200 { status: "degraded", ... }   (pipeline slow but running)
//   → 503 { status: "down", ... }       (DB unreachable or critical failure)
//
// Auth: Public (no auth required — health checks must be unauthenticated)
// Response time target: <500ms
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down'
  version: string
  timestamp: string
  checks: {
    database: 'ok' | 'error'
    active_jobs: number
    sources_active: number
    pipeline_lag_hours: number
    last_ingestion: string | null
  }
  message: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Run checks in parallel for speed
    const [
      activeJobsResult,
      sourcesResult,
      latestJobResult,
    ] = await Promise.allSettled([
      // Check 1: Active job count
      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Check 2: Active sources
      supabase
        .from('ingestion_sources')
        .select('source_name, active, last_success_at')
        .eq('active', true),

      // Check 3: Most recent ingestion
      supabase
        .from('jobs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    // Extract results
    const activeJobs = activeJobsResult.status === 'fulfilled'
      ? (activeJobsResult.value.count ?? 0)
      : 0

    const sourcesActive = sourcesResult.status === 'fulfilled'
      ? (sourcesResult.value.data?.length ?? 0)
      : 0

    const lastIngestion = latestJobResult.status === 'fulfilled'
      ? (latestJobResult.value.data?.created_at ?? null)
      : null

    // Calculate pipeline lag
    const lagHours = lastIngestion
      ? (Date.now() - new Date(lastIngestion).getTime()) / (1000 * 60 * 60)
      : 999

    const dbOk = activeJobsResult.status === 'fulfilled' && !activeJobsResult.value.error

    // Determine overall status
    let status: HealthResponse['status'] = 'healthy'
    let message = `${activeJobs} active jobs, ${sourcesActive}/12 sources, lag ${Math.round(lagHours)}h`

    if (!dbOk) {
      status = 'down'
      message = 'Database connection failed'
    } else if (activeJobs < 10) {
      status = 'degraded'
      message = `Low job count: only ${activeJobs} active jobs`
    } else if (sourcesActive < 6) {
      status = 'degraded'
      message = `Only ${sourcesActive}/12 sources active`
    } else if (lagHours > 24) {
      status = 'degraded'
      message = `Pipeline lag: ${Math.round(lagHours)} hours`
    }

    const responseMs = Date.now() - startTime
    const httpStatus = status === 'down' ? 503 : 200

    const body: HealthResponse & { response_ms: number } = {
      status,
      version: '2.0.0',
      timestamp,
      checks: {
        database: dbOk ? 'ok' : 'error',
        active_jobs: activeJobs,
        sources_active: sourcesActive,
        pipeline_lag_hours: Math.round(lagHours),
        last_ingestion: lastIngestion,
      },
      message,
      response_ms: responseMs,
    }

    return new Response(JSON.stringify(body, null, 2), {
      status: httpStatus,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseMs}ms`,
      },
    })
  } catch (err) {
    const responseMs = Date.now() - startTime

    return new Response(JSON.stringify({
      status: 'down',
      version: '2.0.0',
      timestamp,
      checks: {
        database: 'error',
        active_jobs: 0,
        sources_active: 0,
        pipeline_lag_hours: 999,
        last_ingestion: null,
      },
      message: `Health check failed: ${(err as Error).message}`,
      response_ms: responseMs,
    } satisfies HealthResponse & { response_ms: number }, null, 2), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

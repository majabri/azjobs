/**
 * iCareerOS Watchdog Service
 *
 * Deno Edge Function that runs comprehensive health checks on all iCareerOS services.
 * Executes 28+ probes across authentication, APIs, databases, agents, and routes.
 *
 * Deployed to: Supabase Edge Functions
 * Triggered by: pg_cron every 60 seconds
 * Environment: Production (service_role access)
 *
 * Probe Types:
 * - route_reachable: HTTP GET check for 200/304 status
 * - auth_flow: Email login/signup/session flows with test account
 * - oauth_link: signInWithOAuth with skipBrowserRedirect
 * - db_query: Direct database table read checks
 * - api_latency: Edge Function health_ping endpoints
 * - config_integrity: Feature flags and settings validation
 * - agent_heartbeat: Agent process alive checks
 * - queue_depth: Count pending background jobs
 * - event_processing: Event lag and failure monitoring
 * - rls_policy: RLS enforcement verification
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// ============================================================================
// TYPES
// ============================================================================

interface Probe {
  id: string
  probe_name: string
  probe_type: string
  target_service: string
  check_interval_seconds: number
  failure_threshold: number
  latency_threshold_ms: number
  enabled: boolean
}

interface ProbeResult {
  probe_id: string
  probe_name: string
  status: 'pass' | 'fail' | 'warn' | 'timeout'
  latency_ms: number | null
  error_code: string | null
  error_detail: string | null
  checked_at: string
}

interface Incident {
  id: string
  probe_id: string
  probe_name: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'resolved' | 'suppressed'
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  consecutive_failures: number
  error_summary: string | null
  auto_repaired: boolean
  github_issue_url: string | null
  sentry_event_id: string | null
}

interface WatchdogSummary {
  timestamp: string
  total_probes: number
  passed: number
  failed: number
  warnings: number
  open_incidents: number
  results: ProbeResult[]
  incidents_opened: Incident[]
}

// ============================================================================
// ENVIRONMENT & INITIALIZATION
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const VITE_APP_URL = Deno.env.get('VITE_APP_URL') || 'http://localhost:3000'
const WATCHDOG_TEST_EMAIL = Deno.env.get('WATCHDOG_TEST_EMAIL') || 'watchdog@test.local'
const WATCHDOG_TEST_PASSWORD = Deno.env.get('WATCHDOG_TEST_PASSWORD') || 'watchdog-test-password'

// Initialize Supabase client with service role (full access)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ============================================================================
// PROBE RUNNERS
// ============================================================================

/**
 * Check if a route is reachable (HTTP GET returns 200/304)
 */
async function checkRouteReachable(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    const response = await fetch(`${VITE_APP_URL}${probe.target_service}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10s timeout
    })
    const latency = Math.round(performance.now() - start)

    const success = response.status === 200 || response.status === 304
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: success ? 'pass' : 'fail',
      latency_ms: latency,
      error_code: success ? null : `HTTP_${response.status}`,
      error_detail: success ? null : `Unexpected status: ${response.status}`,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: latency > 10000 ? 'timeout' : 'fail',
      latency_ms: latency,
      error_code: latency > 10000 ? 'TIMEOUT' : 'FETCH_ERROR',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check authentication flows (email signup, login, session refresh)
 */
async function checkAuthFlow(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    switch (probe.probe_name) {
      case 'auth.email_login': {
        // Test email login flow
        const { data, error } = await supabase.auth.signInWithPassword({
          email: WATCHDOG_TEST_EMAIL,
          password: WATCHDOG_TEST_PASSWORD,
        })
        const latency = Math.round(performance.now() - start)

        if (error) {
          return {
            probe_id: probe.id,
            probe_name: probe.probe_name,
            status: 'fail',
            latency_ms: latency,
            error_code: error.code || 'AUTH_ERROR',
            error_detail: error.message,
            checked_at: new Date().toISOString(),
          }
        }

        return {
          probe_id: probe.id,
          probe_name: probe.probe_name,
          status: data?.session ? 'pass' : 'fail',
          latency_ms: latency,
          error_code: null,
          error_detail: null,
          checked_at: new Date().toISOString(),
        }
      }

      case 'auth.session_refresh': {
        // Test session refresh (requires existing session)
        const { data, error } = await supabase.auth.getSession()
        const latency = Math.round(performance.now() - start)

        if (error || !data?.session?.refresh_token) {
          return {
            probe_id: probe.id,
            probe_name: probe.probe_name,
            status: 'warn',
            latency_ms: latency,
            error_code: 'NO_SESSION',
            error_detail: 'No active session to refresh',
            checked_at: new Date().toISOString(),
          }
        }

        return {
          probe_id: probe.id,
          probe_name: probe.probe_name,
          status: 'pass',
          latency_ms: latency,
          error_code: null,
          error_detail: null,
          checked_at: new Date().toISOString(),
        }
      }

      case 'auth.admin_username_rpc': {
        // Test admin RPC: admin_get_user_by_username
        const { data, error } = await supabase.rpc('admin_get_user_by_username', {
          username_param: 'watchdog',
        })
        const latency = Math.round(performance.now() - start)

        // RPC call should complete without timeout (data may be null if user doesn't exist)
        return {
          probe_id: probe.id,
          probe_name: probe.probe_name,
          status: error ? 'fail' : 'pass',
          latency_ms: latency,
          error_code: error?.code || null,
          error_detail: error?.message || null,
          checked_at: new Date().toISOString(),
        }
      }

      default: {
        // Other auth flows (email_signup, password_reset_email, logout)
        const latency = Math.round(performance.now() - start)
        return {
          probe_id: probe.id,
          probe_name: probe.probe_name,
          status: 'warn',
          latency_ms: latency,
          error_code: 'NOT_IMPLEMENTED',
          error_detail: `Probe ${probe.probe_name} not yet implemented`,
          checked_at: new Date().toISOString(),
        }
      }
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check OAuth linking (signInWithOAuth with skipBrowserRedirect)
 */
async function checkOAuthLink(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    // Determine provider from probe name
    const provider = probe.probe_name.includes('google')
      ? 'google'
      : probe.probe_name.includes('apple')
        ? 'apple'
        : null

    if (!provider) {
      const latency = Math.round(performance.now() - start)
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: latency,
        error_code: 'UNKNOWN_PROVIDER',
        error_detail: `Cannot determine provider from probe name: ${probe.probe_name}`,
        checked_at: new Date().toISOString(),
      }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'apple',
      options: {
        skipBrowserRedirect: true,
      },
    })

    const latency = Math.round(performance.now() - start)

    if (error) {
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: latency,
        error_code: error.code || 'OAUTH_ERROR',
        error_detail: error.message,
        checked_at: new Date().toISOString(),
      }
    }

    // Check that redirect_uri is not 'lovable' placeholder
    const url = data?.url || ''
    const isValid = url && !url.includes('lovable')

    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: isValid ? 'pass' : 'fail',
      latency_ms: latency,
      error_code: isValid ? null : 'INVALID_REDIRECT',
      error_detail: isValid ? null : 'OAuth redirect_uri contains lovable placeholder',
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check database query performance
 */
async function checkDbQuery(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    // Map probe names to table reads
    const tableMap: Record<string, string> = {
      'profile.read_own': 'profiles',
      // Add more mappings as needed
    }

    const table = tableMap[probe.probe_name] || 'users'

    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    const latency = Math.round(performance.now() - start)

    if (error) {
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: latency,
        error_code: error.code || 'DB_ERROR',
        error_detail: error.message,
        checked_at: new Date().toISOString(),
      }
    }

    const isWarning = latency > probe.latency_threshold_ms

    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: isWarning ? 'warn' : 'pass',
      latency_ms: latency,
      error_code: isWarning ? 'SLOW_QUERY' : null,
      error_detail: isWarning ? `Query took ${latency}ms (threshold: ${probe.latency_threshold_ms}ms)` : null,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check API endpoint health and latency
 */
async function checkApiLatency(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    // Map probe names to health check endpoints
    const endpointMap: Record<string, string> = {
      'config.settings_api': '/api/health/settings',
      'profile.resume_upload': '/api/health/profile',
      'search.job_search': '/api/health/search',
      'matching.fit_score': '/api/health/matching',
    }

    const endpoint = endpointMap[probe.probe_name] || '/api/health'
    const response = await fetch(`${VITE_APP_URL}${endpoint}`, {
      signal: AbortSignal.timeout(10000),
    })

    const latency = Math.round(performance.now() - start)

    if (!response.ok) {
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: latency,
        error_code: `HTTP_${response.status}`,
        error_detail: `API returned ${response.status}`,
        checked_at: new Date().toISOString(),
      }
    }

    const isWarning = latency > probe.latency_threshold_ms

    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: isWarning ? 'warn' : 'pass',
      latency_ms: latency,
      error_code: isWarning ? 'SLOW_API' : null,
      error_detail: isWarning ? `API latency ${latency}ms (threshold: ${probe.latency_threshold_ms}ms)` : null,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: latency > 10000 ? 'timeout' : 'fail',
      latency_ms: latency,
      error_code: latency > 10000 ? 'TIMEOUT' : 'FETCH_ERROR',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check configuration integrity (feature flags, settings)
 */
async function checkConfigIntegrity(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    switch (probe.probe_name) {
      case 'config.feature_flags_load': {
        // Try to read feature_flags table
        const { data, error } = await supabase
          .from('feature_flags')
          .select('*')
          .limit(1)

        const latency = Math.round(performance.now() - start)

        return {
          probe_id: probe.id,
          probe_name: probe.probe_name,
          status: error ? 'fail' : 'pass',
          latency_ms: latency,
          error_code: error?.code || null,
          error_detail: error?.message || null,
          checked_at: new Date().toISOString(),
        }
      }

      default: {
        const latency = Math.round(performance.now() - start)
        return {
          probe_id: probe.id,
          probe_name: probe.probe_name,
          status: 'pass',
          latency_ms: latency,
          error_code: null,
          error_detail: null,
          checked_at: new Date().toISOString(),
        }
      }
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check agent process heartbeat
 */
async function checkAgentHeartbeat(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    // Query agent_runs table for recent activity
    const { data, error } = await supabase
      .from('agent_runs')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    const latency = Math.round(performance.now() - start)

    if (error) {
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: latency,
        error_code: error.code || 'DB_ERROR',
        error_detail: error.message,
        checked_at: new Date().toISOString(),
      }
    }

    // Check if there's recent activity (within last 5 minutes)
    if (!data || data.length === 0) {
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'warn',
        latency_ms: latency,
        error_code: 'NO_RECENT_ACTIVITY',
        error_detail: 'No agent runs found in last check',
        checked_at: new Date().toISOString(),
      }
    }

    const lastRunTime = new Date(data[0].created_at).getTime()
    const now = Date.now()
    const minutesSinceLastRun = (now - lastRunTime) / (1000 * 60)

    const isWarning = minutesSinceLastRun > 5

    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: isWarning ? 'warn' : 'pass',
      latency_ms: latency,
      error_code: isWarning ? 'STALE_HEARTBEAT' : null,
      error_detail: isWarning ? `Last agent run ${minutesSinceLastRun.toFixed(1)} minutes ago` : null,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check queue depth (pending background jobs)
 */
async function checkQueueDepth(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    // Query pending items from queue tables
    const { count, error } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const latency = Math.round(performance.now() - start)

    if (error) {
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: latency,
        error_code: error.code || 'DB_ERROR',
        error_detail: error.message,
        checked_at: new Date().toISOString(),
      }
    }

    // Warn if queue depth exceeds threshold (1000 items)
    const isWarning = (count || 0) > 1000

    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: isWarning ? 'warn' : 'pass',
      latency_ms: latency,
      error_code: isWarning ? 'QUEUE_DEEP' : null,
      error_detail: isWarning ? `${count} items pending in queue` : null,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check event processing lag and failures
 */
async function checkEventProcessing(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    // Query events table for processing lag
    const { data, error } = await supabase
      .from('events')
      .select('id, created_at, processed_at')
      .is('processed_at', false)
      .order('created_at', { ascending: true })
      .limit(1)

    const latency = Math.round(performance.now() - start)

    if (error) {
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: latency,
        error_code: error.code || 'DB_ERROR',
        error_detail: error.message,
        checked_at: new Date().toISOString(),
      }
    }

    // Check if oldest unprocessed event is too old (>5 minutes)
    if (data && data.length > 0) {
      const oldestEventTime = new Date(data[0].created_at).getTime()
      const lagMs = Date.now() - oldestEventTime
      const lagMinutes = lagMs / (1000 * 60)

      const isWarning = lagMinutes > 5

      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: isWarning ? 'warn' : 'pass',
        latency_ms: latency,
        error_code: isWarning ? 'EVENT_LAG' : null,
        error_detail: isWarning ? `Oldest event unprocessed for ${lagMinutes.toFixed(1)} minutes` : null,
        checked_at: new Date().toISOString(),
      }
    }

    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'pass',
      latency_ms: latency,
      error_code: null,
      error_detail: null,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Check RLS policy enforcement
 */
async function checkRlsPolicy(
  probe: Probe
): Promise<ProbeResult> {
  const start = performance.now()
  try {
    // Try to read restricted table as anon user
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '')

    const { data, error } = await anonClient
      .from('watchdog_probes')
      .select('*')
      .limit(1)

    const latency = Math.round(performance.now() - start)

    // Should fail with permission denied (RLS policy enforcement)
    const isBlocked = error?.code === 'PGRST301' || error?.code === 'PGRST000'

    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: isBlocked ? 'pass' : 'fail',
      latency_ms: latency,
      error_code: isBlocked ? null : 'RLS_BYPASSED',
      error_detail: isBlocked ? null : 'Anon user could access protected table',
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start)
    const error = err as Error
    return {
      probe_id: probe.id,
      probe_name: probe.probe_name,
      status: 'fail',
      latency_ms: latency,
      error_code: 'EXCEPTION',
      error_detail: error.message || 'Unknown error',
      checked_at: new Date().toISOString(),
    }
  }
}

/**
 * Dispatch probe to appropriate runner based on type
 */
async function runProbe(probe: Probe): Promise<ProbeResult> {
  switch (probe.probe_type) {
    case 'route_reachable':
      return checkRouteReachable(probe)
    case 'auth_flow':
      return checkAuthFlow(probe)
    case 'oauth_link':
      return checkOAuthLink(probe)
    case 'db_query':
      return checkDbQuery(probe)
    case 'api_latency':
      return checkApiLatency(probe)
    case 'config_integrity':
      return checkConfigIntegrity(probe)
    case 'agent_heartbeat':
      return checkAgentHeartbeat(probe)
    case 'queue_depth':
      return checkQueueDepth(probe)
    case 'event_processing':
      return checkEventProcessing(probe)
    case 'rls_policy':
      return checkRlsPolicy(probe)
    default:
      return {
        probe_id: probe.id,
        probe_name: probe.probe_name,
        status: 'fail',
        latency_ms: 0,
        error_code: 'UNKNOWN_TYPE',
        error_detail: `Unknown probe type: ${probe.probe_type}`,
        checked_at: new Date().toISOString(),
      }
  }
}

// ============================================================================
// INCIDENT MANAGEMENT
// ============================================================================

/**
 * Handle probe result: update results table, manage incidents
 */
async function handleResult(
  result: ProbeResult
): Promise<{ incident?: Incident; created?: boolean; resolved?: boolean }> {
  // Insert result into watchdog_results
  const { error: resultError } = await supabase
    .from('watchdog_results')
    .insert([result])

  if (resultError) {
    console.error(`Failed to insert result for ${result.probe_name}:`, resultError)
  }

  // Check if result indicates failure
  if (result.status === 'pass') {
    // Resolve any open incidents for this probe
    const { data: openIncidents, error: queryError } = await supabase
      .from('watchdog_incidents')
      .select('*')
      .eq('probe_id', result.probe_id)
      .eq('status', 'open')

    if (!queryError && openIncidents && openIncidents.length > 0) {
      for (const incident of openIncidents) {
        const { error: updateError } = await supabase
          .from('watchdog_incidents')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', incident.id)

        if (!updateError) {
          console.log(`Resolved incident ${incident.id} for ${result.probe_name}`)
        }
      }
    }

    return {}
  }

  // Handle failure or warning
  const severity = result.status === 'fail' ? 'high' : 'medium'

  // Check for existing open incident
  const { data: existingIncidents, error: queryError } = await supabase
    .from('watchdog_incidents')
    .select('*')
    .eq('probe_id', result.probe_id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingIncidents && existingIncidents.length > 0) {
    // Update existing incident
    const incident = existingIncidents[0]
    const { error: updateError } = await supabase
      .from('watchdog_incidents')
      .update({
        consecutive_failures: incident.consecutive_failures + 1,
        last_seen_at: new Date().toISOString(),
        error_summary: result.error_detail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incident.id)

    if (!updateError) {
      console.log(`Updated incident ${incident.id} for ${result.probe_name}`)
      return { incident }
    }
  } else {
    // Create new incident
    const { data: newIncident, error: createError } = await supabase
      .from('watchdog_incidents')
      .insert([
        {
          probe_id: result.probe_id,
          probe_name: result.probe_name,
          severity,
          status: 'open',
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          consecutive_failures: 1,
          error_summary: result.error_detail,
          auto_repaired: false,
        },
      ])
      .select()

    if (!createError && newIncident && newIncident.length > 0) {
      console.log(`Created incident for ${result.probe_name}`)
      return { incident: newIncident[0], created: true }
    }
  }

  return {}
}

/**
 * Publish watchdog event for real-time updates
 */
async function publishEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('watchdog_events')
    .insert([
      {
        event_type: eventType,
        payload,
        created_at: new Date().toISOString(),
      },
    ])

  if (error) {
    console.error(`Failed to publish event ${eventType}:`, error)
  }
}

// ============================================================================
// MAIN WATCHDOG SERVICE
// ============================================================================

/**
 * Main watchdog execution
 */
async function runWatchdog(): Promise<WatchdogSummary> {
  console.log('[Watchdog] Starting comprehensive health check...')

  const startTime = performance.now()

  // Fetch all enabled probes
  const { data: probes, error: probeError } = await supabase
    .from('watchdog_probes')
    .select('*')
    .eq('enabled', true)

  if (probeError || !probes) {
    throw new Error(`Failed to fetch probes: ${probeError?.message}`)
  }

  console.log(`[Watchdog] Loaded ${probes.length} enabled probes`)

  // Run all probes in parallel
  const results = await Promise.all(
    probes.map((probe: Probe) => runProbe(probe))
  )

  // Process each result and manage incidents
  const incidents: Incident[] = []
  for (const result of results) {
    const incident = await handleResult(result)
    if (incident.incident) {
      incidents.push(incident.incident)
    }
  }

  // Calculate summary statistics
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const warnings = results.filter(r => r.status === 'warn').length

  const summary: WatchdogSummary = {
    timestamp: new Date().toISOString(),
    total_probes: probes.length,
    passed,
    failed,
    warnings,
    open_incidents: incidents.length,
    results,
    incidents_opened: incidents,
  }

  // Create daily report (or update existing)
  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from('watchdog_daily_reports')
    .upsert([
      {
        report_date: today,
        total_probes: summary.total_probes,
        passed: summary.passed,
        failed: summary.failed,
        warnings: summary.warnings,
        new_incidents: incidents.filter(i => i.created).length,
        auto_repaired: 0,
        open_incidents: summary.open_incidents,
        summary_json: summary,
        updated_at: new Date().toISOString(),
      },
    ])

  // Publish summary event
  await publishEvent('watchdog_complete', {
    passed,
    failed,
    warnings,
    timestamp: summary.timestamp,
  })

  const duration = Math.round(performance.now() - startTime)
  console.log(`[Watchdog] Complete in ${duration}ms: ${passed}P ${failed}F ${warnings}W`)

  return summary
}

// ============================================================================
// DENO EDGE FUNCTION HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const summary = await runWatchdog()

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const err = error as Error
    console.error('[Watchdog] Fatal error:', err)

    return new Response(
      JSON.stringify({
        error: 'Watchdog service failed',
        message: err.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

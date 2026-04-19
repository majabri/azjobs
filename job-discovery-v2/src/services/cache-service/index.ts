// =============================================================================
// iCareerOS — Cache Service (Phase 3)
// Pre-warms search results so users see <1s latency on every query.
//
// Strategy:
//   - Uses Supabase's built-in Redis (no extra cost) OR a simple in-memory
//     LRU cache for the Edge Function process.
//   - Pre-warm runs nightly after the matching pipeline completes (~06:00 UTC)
//   - Common queries cached: top 20 jobs for each active user
//   - Cache TTL: 24 hours (refreshed each night)
//   - Cache miss: fall back to live Supabase query (still fast, ~200ms)
//
// Two implementations:
//   1. SupabaseCache — uses a `query_cache` table (zero extra cost)
//   2. MemoryCache — in-process LRU (for Edge Functions, resets on cold start)
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  cached_at: string
  expires_at: string
  hit_count: number
}

interface TopJobsResult {
  jobs: Array<{
    id: string
    title: string
    company: string
    location: string | null
    source_count: number
    fit_score: number
    skill_match_pct: number
    remote_type: string | null
    required_skills: string[]
    salary_min: number | null
    salary_max: number | null
    fit_reasoning: string
  }>
  total: number
  cached_at: string | null
}

// ── Supabase-backed cache (persistent, survives Edge Function cold starts) ────

export class SupabaseCache {
  private supabase: SupabaseClient
  private defaultTtlMs = 24 * 60 * 60 * 1000  // 24 hours

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[Cache] Missing Supabase credentials')
    this.supabase = createClient(url, key)
  }

  async get<T>(key: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from('query_cache')
      .select('data, expires_at')
      .eq('cache_key', key)
      .single()

    if (error || !data) return null
    if (new Date(data.expires_at) < new Date()) {
      // Expired — delete and return null
      await this.supabase.from('query_cache').delete().eq('cache_key', key)
      return null
    }

    // Increment hit count (fire-and-forget)
    this.supabase
      .from('query_cache')
      .update({ hit_count: this.supabase.rpc('increment', { x: 1 }) })
      .eq('cache_key', key)
      .then(() => {})

    return data.data as T
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtlMs
    const expiresAt = new Date(Date.now() + ttl).toISOString()

    await this.supabase.from('query_cache').upsert({
      cache_key: key,
      data: value,
      cached_at: new Date().toISOString(),
      expires_at: expiresAt,
      hit_count: 0,
    }, { onConflict: 'cache_key' })
  }

  async invalidate(keyPattern: string): Promise<void> {
    await this.supabase
      .from('query_cache')
      .delete()
      .like('cache_key', keyPattern)
  }

  async purgeExpired(): Promise<number> {
    const { data } = await this.supabase
      .from('query_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('cache_key')

    return data?.length ?? 0
  }
}

// ── In-memory LRU cache (for Edge Functions, fast but ephemeral) ──────────────

export class MemoryCache {
  private cache = new Map<string, { value: any; expiresAt: number }>()
  private maxSize: number

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return null
    }
    // Move to end (LRU behaviour)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs = 24 * 60 * 60 * 1000): void {
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  invalidate(keyPattern: string): void {
    const regex = new RegExp(keyPattern.replace('*', '.*'))
    for (const key of this.cache.keys()) {
      if (regex.test(key)) this.cache.delete(key)
    }
  }

  get size(): number { return this.cache.size }
}

// ── Cache Service (high-level API used by the app) ────────────────────────────

export class CacheService {
  private db: SupabaseCache
  private mem: MemoryCache

  constructor() {
    this.db = new SupabaseCache()
    this.mem = new MemoryCache(500)
  }

  // ---------------------------------------------------------------------------
  // Get top jobs for a user (most common query — pre-warmed nightly)
  // ---------------------------------------------------------------------------
  async getTopJobsForUser(userId: string, limit = 20): Promise<TopJobsResult | null> {
    const key = `top_jobs:${userId}:${limit}`

    // L1: memory (fastest, ~0ms)
    const memHit = this.mem.get<TopJobsResult>(key)
    if (memHit) return { ...memHit, cached_at: 'memory' }

    // L2: Supabase cache table (~50ms)
    const dbHit = await this.db.get<TopJobsResult>(key)
    if (dbHit) {
      this.mem.set(key, dbHit, 60 * 60 * 1000)  // Promote to memory cache (1h)
      return { ...dbHit, cached_at: 'database' }
    }

    // Cache miss — caller should fetch from live DB and call setTopJobsForUser()
    return null
  }

  async setTopJobsForUser(userId: string, jobs: TopJobsResult, limit = 20): Promise<void> {
    const key = `top_jobs:${userId}:${limit}`
    this.mem.set(key, jobs, 60 * 60 * 1000)          // Memory: 1 hour
    await this.db.set(key, jobs, 24 * 60 * 60 * 1000) // DB: 24 hours
  }

  // ---------------------------------------------------------------------------
  // Pre-warm: build cache for all active users (called after nightly scoring)
  // ---------------------------------------------------------------------------
  async prewarmAllUsers(limit = 20): Promise<{ warmed: number; failed: number }> {
    const supabase = new SupabaseCache()['supabase']

    const { data: profiles } = await supabase
      .from('user_search_preferences')
      .select('user_id')

    let warmed = 0, failed = 0

    for (const { user_id } of profiles ?? []) {
      try {
        await this.prewarmUser(user_id, supabase, limit)
        warmed++
      } catch (err) {
        failed++
        console.error(`[Cache] Prewarm failed for ${user_id}:`, (err as Error).message)
      }
    }

    console.log(`[Cache] Pre-warm complete: ${warmed} users warmed, ${failed} failed`)
    return { warmed, failed }
  }

  private async prewarmUser(userId: string, supabase: SupabaseClient, limit: number): Promise<void> {
    const { data: scores } = await supabase
      .from('job_scores')
      .select(`
        fit_score, skill_match_pct, experience_match_pct,
        location_match_pct, salary_match_pct, fit_reasoning,
        deduplicated_jobs!inner(
          id, title, company, location, source_count,
          extracted_jobs!inner(remote_type, required_skills, salary_min, salary_max)
        )
      `)
      .eq('profile_id', userId)
      .gte('fit_score', 40)
      .order('fit_score', { ascending: false })
      .limit(limit)

    if (!scores || scores.length === 0) return

    const jobs = scores.map((s: any) => ({
      id: s.deduplicated_jobs.id,
      title: s.deduplicated_jobs.title,
      company: s.deduplicated_jobs.company,
      location: s.deduplicated_jobs.location,
      source_count: s.deduplicated_jobs.source_count,
      fit_score: s.fit_score,
      skill_match_pct: s.skill_match_pct,
      remote_type: s.deduplicated_jobs.extracted_jobs?.remote_type ?? null,
      required_skills: s.deduplicated_jobs.extracted_jobs?.required_skills ?? [],
      salary_min: s.deduplicated_jobs.extracted_jobs?.salary_min ?? null,
      salary_max: s.deduplicated_jobs.extracted_jobs?.salary_max ?? null,
      fit_reasoning: s.fit_reasoning,
    }))

    await this.setTopJobsForUser(userId, {
      jobs,
      total: jobs.length,
      cached_at: new Date().toISOString(),
    }, limit)
  }

  // ---------------------------------------------------------------------------
  // Invalidate a user's cache (called when their preferences change)
  // ---------------------------------------------------------------------------
  async invalidateUser(userId: string): Promise<void> {
    this.mem.invalidate(`top_jobs:${userId}:*`)
    await this.db.invalidate(`top_jobs:${userId}:%`)
  }

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------
  async purgeExpired(): Promise<number> {
    return this.db.purgeExpired()
  }

  get memoryStats() {
    return { size: this.mem.size, maxSize: 500 }
  }
}

// SQL migration needed for SupabaseCache — add to a new migration file:
export const CACHE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS query_cache (
  cache_key   text        PRIMARY KEY,
  data        jsonb       NOT NULL,
  cached_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  hit_count   integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at);

-- Auto-purge expired entries weekly
SELECT cron.schedule(
  'purge-query-cache',
  '0 1 * * 0',
  $$DELETE FROM query_cache WHERE expires_at < now()$$
);

-- RLS
ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_cache" ON query_cache FOR ALL USING (auth.role() = 'service_role');
`

// Singleton
export const cacheService = new CacheService()

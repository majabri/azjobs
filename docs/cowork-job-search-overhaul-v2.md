# iCareerOS — Job Search & Matching Overhaul
## Cowork Instruction Document — v2.0 (Rationalized)

**Date:** April 20, 2026  
**Owner:** Amir Jabri  
**Repo:** https://github.com/majabri/azjobs  
**Production Supabase:** `bryoehuhhhjqcueomgev`  
**Staging Supabase:** `muevgfmpzykihjuihnga`  
**Supersedes:** v1.0 Cowork Instruction Document

---

## What Changed From v1

This version was reconciled against the current codebase state (April 20, 2026). The following tasks from v1 were **removed or adjusted**:

| v1 Task | Status | Reason |
|---|---|---|
| Task 1.2 — Opportunity Radar wiring (#207) | ✅ **DONE** | Fixed in PR #218, 75 jobs confirmed |
| Task 1.4 — `<UNKNOWN>` location chip (#209) | ✅ **DONE** | Not present in code; #209 resolved in PR sweep |
| Task 2.4 — Add Adzuna source | ✅ **DONE** | Adapter exists in `discovery-agent`, flag `discovery_board_adzuna` is OFF pending keys |
| Task 2.5 — Add USAJobs source | ✅ **DONE** | Adapter exists in `discovery-agent`, flag `discovery_board_usajobs` is OFF pending keys |
| Task 2.1 — Add FTS/remote indexes | ✅ **DONE** | Already present on `job_postings` from migration `20260413_001_job_postings.sql` |
| Task 2.3 — Add `expires_at` column | ✅ **DONE** | `job_postings.expires_at` is `GENERATED AS (scraped_at + 7 days)` |

Additionally, v1 referenced `public.jobs` as the canonical job table throughout. The **actual canonical table is `job_postings`**. See Architecture note below.

---

## Critical Architecture Note — Read This First

The codebase has three separate job data stores. Do not confuse them:

| Table/View | Type | Purpose | Written by |
|---|---|---|---|
| `job_postings` | TABLE | Active search source for `search-jobs` edge function | GitHub Actions Python scraper (every 2h) |
| `scraped_jobs` | VIEW | Computed view over `job_postings` (adds market_rate, seniority) | DO NOT touch — view only |
| `discovery_jobs` | TABLE | Staging layer for Discovery Agent | `discovery-agent` edge function |
| `discovered_jobs` | TABLE | Per-user relevance-scored jobs | `bridge_jobs_to_discovered()` pg_cron (every 30 min) |
| `public.jobs` | TABLE | Phase 0 ingestion output (12-source adapter) | Ingestion adapters — may be inactive |

The `search-jobs` edge function reads **`job_postings`** only. Discovery Agent results (`discovery_jobs` → `discovered_jobs`) are not currently surfaced in search — this is a gap addressed in Task N1 below.

---

## Critical Rules

1. All work targets `dev` branch only. Never push to `main`. Amir merges dev→main personally.
2. One GitHub Issue per task. One feature branch per task. One PR per task targeting `dev`.
3. Use `bun` exclusively. Never npm or yarn.
4. Every task has a 🛑 PAUSE point. Stop, post results on the Issue, wait for Amir's confirmation.
5. Never modify `src/services/matching/`, `src/lib/job-search/jobQualityEngine.ts`, or any file not explicitly mentioned without documenting it first.
6. Every new external data source must be gated behind a feature flag.
7. Always use `supabase.functions.invoke("<fn>", { body })`. Never raw `fetch()` to edge functions. Exception: SSE streaming (mock-interview) uses raw fetch with `resp.body?.getReader()`.

---

## Phase 0 — Diagnostics (Run Before Any Code Changes)

### Task 0.1 — Production Database Diagnostics

**GitHub Issue:** `"chore: run Phase 0 diagnostics before job search overhaul"`  
**Branch:** `chore/phase0-diagnostics`

Run the following queries in the Supabase SQL Editor (`bryoehuhhhjqcueomgev`). Post all output as a comment on the issue before any Phase 1 work.

**Query 1 — All job-related tables and views:**
```sql
SELECT
  c.relname AS name,
  CASE c.relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
    ELSE c.relkind::text
  END AS kind,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname ILIKE ANY(ARRAY[
    '%job%','%scraped%','%discovered%','%postings%','%matches%'
  ])
ORDER BY c.relname;
```

**Query 2 — Profile tables (critical for search-jobs rewrite):**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'career_profiles', 'user_profiles',
    'job_seeker_profiles', 'user_job_matches',
    'resume_versions', 'user_skills'
  )
ORDER BY tablename;
```

**Query 3 — User and match coverage:**
```sql
SELECT COUNT(*) AS total_auth_users FROM auth.users;

SELECT COUNT(*) AS job_seeker_count
FROM user_roles WHERE role = 'job_seeker';

SELECT COUNT(DISTINCT user_id) AS users_with_matches
FROM user_job_matches;
```

**Query 4 — job_postings row count and source breakdown (canonical search table):**
```sql
SELECT
  source,
  COUNT(*) AS row_count,
  MAX(scraped_at) AS latest_ingestion,
  MIN(scraped_at) AS earliest_ingestion
FROM public.job_postings
GROUP BY source
ORDER BY row_count DESC;
```

**Query 5 — public.jobs row count (Phase 0 ingestion table — verify if active):**
```sql
SELECT
  source_name,
  COUNT(*) AS row_count,
  MAX(date_scraped) AS latest_scrape
FROM public.jobs
GROUP BY source_name
ORDER BY row_count DESC;
```

**Query 6 — Feature flags:**
```sql
SELECT key, enabled, description
FROM feature_flags
ORDER BY key;
```

**Query 7 — discovery_jobs and discovered_jobs status:**
```sql
SELECT COUNT(*) AS discovery_jobs_count FROM discovery_jobs;
SELECT COUNT(*) AS discovered_jobs_count FROM discovered_jobs;
SELECT COUNT(DISTINCT user_id) AS users_with_discoveries FROM discovered_jobs;
```

**Query 8 — pg_cron jobs:**
```sql
SELECT jobname, schedule, command, active
FROM cron.job
ORDER BY jobname;
```

**Query 9 — job_postings columns (confirm schema):**
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'job_postings'
ORDER BY ordinal_position;
```

**Query 10 — Real user for testing (non-test account):**
```sql
SELECT u.email, u.id, ur.role
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'job_seeker'
  AND u.email != 'majabri714@gmail.com'
LIMIT 5;
```

🛑 **PAUSE 0.1** — Post all query results as a comment on the issue. Do not proceed to Phase 1 until Amir responds with "Phase 1 approved."

---

## Phase 1 — Fix Search For All Users

### Task 1.1 — Rewrite `search-jobs` Edge Function (Four-Mode Search)

**GitHub Issue:** `"fix: search-jobs returns 0 results for new users with no profile — implement four-mode graceful degradation"`  
**Branch:** `fix/search-jobs-four-mode`

**Background:** The current `search-jobs` v5 function reads from `job_postings` and optionally enriches with `user_job_matches`. It works for the test user (full profile + pre-computed matches) but degrades poorly for new users because:
- It always requires a `query`/`skills`/`targetTitles` to build meaningful filters
- Empty search returns whatever falls from `software engineer` fallback
- No profile-based discovery mode for authenticated users with zero criteria

The fix implements a four-mode decision tree.

**Step 1 — Read current implementation:**
```bash
cat supabase/functions/search-jobs/index.ts
```
Note the existing auth pattern, CORS headers, and PostgREST fetch helpers. Preserve all of these.

**Step 2 — Confirm profile table from Phase 0.**
From Phase 0 Query 2, the confirmed profile table is `job_seeker_profiles` (verified in codebase). The relevant columns are: `skills`, `career_level`, `location`, `preferred_job_types`, `target_job_titles`, `summary`.

**Step 3 — Rewrite with four-mode architecture.**

Replace the data-fetching and result-building logic. Preserve existing CORS headers and auth patterns.

```typescript
// supabase/functions/search-jobs/index.ts
// iCareerOS Job Search — v6
// Four-mode search: handles every combination of criteria + profile completeness.
// Reads from: job_postings (primary) + discovered_jobs (Discovery Agent results)

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchRequest {
  searchTerm?: string
  location?: string
  isRemote?: boolean
  jobType?: string
  salaryMin?: number
  salaryMax?: number
  careerLevel?: string
  postedWithinDays?: number  // default 30
  limit?: number
  offset?: number
  // Legacy aliases (from existing callers — preserve compat)
  query?: string
  skills?: string[]
  targetTitles?: string[]
  days_old?: number
}

interface SearchResult {
  jobs: JobResult[]
  total: number
  mode: 'targeted_scored' | 'targeted_unscored' | 'profile_discovery' | 'pure_discovery'
  profileComplete: boolean
  nudge?: string
  source: string
}

interface JobResult {
  id: string
  title: string
  company: string
  location: string
  is_remote: boolean
  job_type: string
  salary_min: number | null
  salary_max: number | null
  description: string
  job_url: string
  source: string
  posted_at: string
  fit_score: number | null
  skill_match_pct: number | null
  match_reasons: string[]
  skill_gaps: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- Parse Request (support both old and new field names) ---
    const body: SearchRequest = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : Object.fromEntries(new URL(req.url).searchParams)

    // Normalize: support legacy field names from existing callers
    const searchTerm = body.searchTerm?.trim() || body.query?.trim() || ''
    const daysOld = body.postedWithinDays || body.days_old || 30
    const limit = Math.min(Number(body.limit) || 50, 100)
    const offset = Number(body.offset) || 0

    const hasCriteria = !!(
      searchTerm ||
      body.location?.trim() ||
      body.isRemote !== undefined ||
      body.jobType ||
      body.salaryMin ||
      body.careerLevel ||
      (body.skills?.length ?? 0) > 0 ||
      (body.targetTitles?.length ?? 0) > 0
    )

    // --- Load User Profile (gracefully — never throws if missing) ---
    const { data: profile } = await supabaseService
      .from('job_seeker_profiles')
      .select('skills, career_level, location, preferred_job_types, target_job_titles, summary')
      .eq('user_id', user.id)
      .maybeSingle()  // CRITICAL: maybeSingle — never throws for new users

    const hasProfile = !!(
      profile && (
        (Array.isArray(profile.skills) && profile.skills.length > 0) ||
        profile.career_level ||
        (Array.isArray(profile.target_job_titles) && profile.target_job_titles.length > 0)
      )
    )

    // --- Four-Mode Decision Tree ---
    let result: SearchResult

    if (hasCriteria && hasProfile) {
      result = await targetedScoredSearch(supabaseService, user.id, body, profile, searchTerm, daysOld, limit, offset)
    } else if (hasCriteria && !hasProfile) {
      result = await targetedUnscoredSearch(supabaseService, body, searchTerm, daysOld, limit, offset)
    } else if (!hasCriteria && hasProfile) {
      result = await profileDiscovery(supabaseService, user.id, profile, limit, offset)
    } else {
      result = await pureDiscovery(supabaseService, limit, offset)
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[search-jobs] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── Shared Query Builder (reads job_postings) ────────────────────────────────
async function queryJobPostings(supabase: any, params: {
  searchTerm?: string, location?: string, isRemote?: boolean, jobType?: string,
  salaryMin?: number, careerLevel?: string, daysOld?: number,
  skills?: string[], targetTitles?: string[]
}, limit: number, offset: number): Promise<any[]> {
  let query = supabase
    .from('job_postings')
    .select('id, external_id, title, company, location, is_remote, job_type, salary_min, salary_max, salary_currency, description, job_url, source, date_posted, scraped_at')

  // Build search term from all criteria
  const terms: string[] = []
  if (params.searchTerm) terms.push(params.searchTerm)
  if (params.targetTitles?.length) terms.push(...params.targetTitles.slice(0, 3))
  if (params.skills?.length && !terms.length) terms.push(...params.skills.slice(0, 3))

  if (terms.length > 0) {
    const t = encodeURIComponent(terms[0])  // Use first term for ilike
    query = query.or(`title.ilike.%${t}%,description.ilike.%${t}%,company.ilike.%${t}%`)
  }

  if (params.location?.trim()) {
    const loc = params.location.trim()
    query = query.or(`location.ilike.%${loc}%,is_remote.eq.true`)
  }

  if (params.isRemote === true) query = query.eq('is_remote', true)
  if (params.jobType) query = query.eq('job_type', params.jobType)
  if (params.salaryMin) query = query.gte('salary_max', params.salaryMin)
  if (params.careerLevel) query = query.ilike('title', `%${params.careerLevel}%`)

  const cutoff = new Date(Date.now() - (params.daysOld ?? 30) * 24 * 60 * 60 * 1000).toISOString()
  query = query
    .gt('expires_at', new Date().toISOString())  // Only non-expired jobs
    .gte('scraped_at', cutoff)
    .order('scraped_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) { console.error('[queryJobPostings] Error:', error); return [] }
  return data || []
}

// ─── Mode A: Targeted + Scored ────────────────────────────────────────────────
async function targetedScoredSearch(
  supabase: any, userId: string, body: SearchRequest, profile: any,
  searchTerm: string, daysOld: number, limit: number, offset: number
): Promise<SearchResult> {
  const jobs = await queryJobPostings(supabase, { ...body, searchTerm, daysOld }, limit, offset)
  const scored = await attachFitScores(supabase, userId, jobs, profile)
  return { jobs: scored, total: scored.length, mode: 'targeted_scored', profileComplete: true, source: 'icareeros-v6' }
}

// ─── Mode B: Targeted + Unscored ──────────────────────────────────────────────
async function targetedUnscoredSearch(
  supabase: any, body: SearchRequest, searchTerm: string, daysOld: number, limit: number, offset: number
): Promise<SearchResult> {
  const jobs = await queryJobPostings(supabase, { ...body, searchTerm, daysOld }, limit, offset)
  return {
    jobs: jobs.map(j => normalizeJob(j, null)),
    total: jobs.length,
    mode: 'targeted_unscored',
    profileComplete: false,
    nudge: 'Complete your Career Profile to see your fit score for each job.',
    source: 'icareeros-v6',
  }
}

// ─── Mode C: Profile Discovery ────────────────────────────────────────────────
async function profileDiscovery(
  supabase: any, userId: string, profile: any, limit: number, offset: number
): Promise<SearchResult> {
  // Try discovered_jobs first (Discovery Agent results, already scored for this user)
  const { data: discovered } = await supabase
    .from('discovered_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('relevance_score', { ascending: false })
    .limit(limit)

  if (discovered && discovered.length >= 10) {
    // Enough Discovery Agent results — use them
    return {
      jobs: discovered.map((j: any) => ({
        id: j.job_id || j.id,
        title: j.title || '',
        company: j.company || '',
        location: j.location || '',
        is_remote: j.is_remote || false,
        job_type: j.employment_type || '',
        salary_min: j.salary_min || null,
        salary_max: j.salary_max || null,
        description: j.description || '',
        job_url: j.source_url || '',
        source: j.source_board || 'discovery',
        posted_at: j.posted_at || '',
        fit_score: j.relevance_score || null,
        skill_match_pct: null,
        match_reasons: j.match_reasons || [],
        skill_gaps: j.skill_gaps || [],
      })),
      total: discovered.length,
      mode: 'profile_discovery',
      profileComplete: true,
      nudge: 'Showing opportunities matched to your profile. Add search terms to narrow results.',
      source: 'icareeros-v6',
    }
  }

  // Fall back to job_postings with soft criteria from profile
  const softParams = {
    isRemote: profile.location?.toLowerCase() === 'remote' ? true : undefined,
    careerLevel: profile.career_level || undefined,
    daysOld: 30,
  }
  const jobs = await queryJobPostings(supabase, softParams, limit * 2, 0)
  const diversified = diversifyResults(jobs, limit)
  const scored = await attachFitScores(supabase, userId, diversified, profile)
  return {
    jobs: scored, total: scored.length, mode: 'profile_discovery', profileComplete: true,
    nudge: 'Showing opportunities matched to your profile. Add search terms to narrow results.',
    source: 'icareeros-v6',
  }
}

// ─── Mode D: Pure Discovery ───────────────────────────────────────────────────
async function pureDiscovery(supabase: any, limit: number, offset: number): Promise<SearchResult> {
  const { data: rawJobs } = await supabase
    .from('job_postings')
    .select('id, external_id, title, company, location, is_remote, job_type, salary_min, salary_max, salary_currency, description, job_url, source, date_posted, scraped_at')
    .gt('expires_at', new Date().toISOString())
    .gte('scraped_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('scraped_at', { ascending: false })
    .limit(limit * 4)

  const diversified = diversifyResults(rawJobs || [], limit)
  return {
    jobs: diversified.map(j => normalizeJob(j, null)),
    total: diversified.length,
    mode: 'pure_discovery',
    profileComplete: false,
    nudge: 'Showing a variety of open roles. Complete your profile to see jobs matched to your skills.',
    source: 'icareeros-v6',
  }
}

// ─── Fit Score Attachment ─────────────────────────────────────────────────────
async function attachFitScores(supabase: any, userId: string, jobs: any[], profile: any): Promise<JobResult[]> {
  if (!jobs.length) return []
  const jobIds = jobs.map(j => j.id)
  const { data: matches } = await supabase
    .from('user_job_matches')
    .select('job_posting_id, fit_score, skill_match_pct, match_reasons, skill_gaps')
    .eq('user_id', userId)
    .in('job_posting_id', jobIds)
  const matchMap = new Map((matches || []).map((m: any) => [m.job_posting_id, m]))
  return jobs.map(job => {
    const match = matchMap.get(job.id)
    if (match) return normalizeJob(job, match)
    return normalizeJob(job, { fit_score: calculateInlineScore(job, profile) })
  })
}

function normalizeJob(j: any, match: any): JobResult {
  return {
    id: j.id,
    title: j.title || '',
    company: j.company || '',
    location: j.location || '',
    is_remote: j.is_remote || false,
    job_type: j.job_type || '',
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    description: (j.description || '').slice(0, 2000),
    job_url: j.job_url || '',
    source: j.source || 'db',
    posted_at: j.date_posted || j.scraped_at || '',
    fit_score: match?.fit_score ?? null,
    skill_match_pct: match?.skill_match_pct ?? null,
    match_reasons: match?.match_reasons || [],
    skill_gaps: match?.skill_gaps || [],
  }
}

function calculateInlineScore(job: any, profile: any): number | null {
  if (!profile) return null
  let score = 50
  if (profile.location?.toLowerCase() === 'remote' && job.is_remote) score += 15
  else if (profile.location?.toLowerCase() === 'remote' && !job.is_remote) score -= 10
  if (job.scraped_at) {
    const daysOld = (Date.now() - new Date(job.scraped_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysOld < 3) score += 10
    else if (daysOld < 7) score += 5
    else if (daysOld > 21) score -= 5
  }
  return Math.max(0, Math.min(100, score))
}

function diversifyResults(jobs: any[], targetCount: number): any[] {
  if (jobs.length <= targetCount) return jobs
  const buckets = new Map<string, any[]>()
  const maxPerSource = Math.ceil(targetCount / 3)
  for (const job of jobs) {
    const src = job.source || 'unknown'
    if (!buckets.has(src)) buckets.set(src, [])
    const b = buckets.get(src)!
    if (b.length < maxPerSource) b.push(job)
  }
  const result: any[] = []
  const arrays = Array.from(buckets.values())
  let i = 0
  while (result.length < targetCount) {
    const b = arrays[i % arrays.length]
    if (b?.length > 0) result.push(b.shift())
    i++
    if (arrays.every(a => a.length === 0)) break
  }
  return result
}
```

**Step 4 — Deploy to staging first:**
```bash
supabase functions deploy search-jobs --project-ref muevgfmpzykihjuihnga
```

Test these four scenarios against staging:
- Brand new user, no profile, no search → should return 20+ diverse jobs
- Brand new user, type "software engineer" → jobs matching, no fit scores, nudge shown
- Test account (full profile), no search → profile-matched discovery results
- Test account, type "python remote" → filtered results with fit scores

**Step 5 — Deploy to production:**
```bash
supabase functions deploy search-jobs --project-ref bryoehuhhhjqcueomgev
```

**Validation Criteria:**
- [ ] New user with zero profile gets 20+ jobs (not empty state)
- [ ] Empty search always returns results (never empty state)
- [ ] Test user gets scored results with `fit_score` values
- [ ] No 500 errors in edge function logs for any scenario
- [ ] Legacy field names (`query`, `skills`, `targetTitles`, `days_old`) still work (backward compat)

🛑 **PAUSE 1.1** — Post staging test results as comment on issue. Wait for approval before production deploy.

---

### Task 1.2 — Fix Remaining Raw-Fetch Calls (Issues #208/#209 Remainder)

**GitHub Issue:** `"fix: migrate remaining raw fetch() calls to supabase.functions.invoke() — AutoApply and Career pages"`  
**Branch:** `fix/raw-fetch-invoke-remainder`

**Context:** Issues #208 and #209 were largely fixed across 6 PRs (merged April 20). Three files still use raw `fetch()` to call edge functions, causing silent 401 auth failures for some users.

**Confirmed remaining raw-fetch files:**
1. `src/pages/AutoApply.tsx` — calls `search-jobs`, `rewrite-resume`, `generate-cover-letter` via raw fetch
2. `src/pages/Career.tsx` — calls `career-path-analysis` via raw fetch
3. `src/components/AnalysisResults.tsx` — check and fix if present
4. `src/components/RecruiterAssistant.tsx` — check and fix if present
5. `src/components/CareerPathIntelligence.tsx` — check and fix if present

**Step 1 — Audit all remaining raw fetch calls:**
```bash
git checkout dev && git pull origin dev
grep -rn "fetch(\`\${import.meta.env.VITE_SUPABASE_URL}/functions" \
  src/ --include="*.tsx" --include="*.ts" | grep -v "mock-interview"
```

For each match, convert to invoke pattern:

```typescript
// BEFORE (broken — bypasses auth injection):
const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/some-function`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify(payload),
})
const data = await resp.json()

// AFTER (correct):
const { data, error } = await supabase.functions.invoke('some-function', { body: payload })
if (error) throw error
```

**Exception — do NOT convert:**
- `mock-interview` — uses SSE streaming (`resp.body?.getReader()`). Raw fetch is correct here.

**Step 2 — Fix AutoApply.tsx specifically:**

The `Find & Queue Jobs` handler in `AutoApply.tsx` also uses raw fetch for `search-jobs`. After converting to invoke, also ensure it creates an `agent_runs` row:

```typescript
// After successful search, log an agent run
await supabase.from('agent_runs').insert({
  user_id: session.user.id,
  status: 'completed',
  started_at: new Date().toISOString(),
  finished_at: new Date().toISOString(),
  errors: [],
}).catch(console.warn)
```

**Validation Criteria:**
- [ ] `grep -rn "fetch.*VITE_SUPABASE_URL" src/` returns only `mock-interview` matches
- [ ] All fixed pages work in the browser (no 401 errors in DevTools Network tab)
- [ ] AutoApply `Find & Queue Jobs` creates a row in `agent_runs`
- [ ] Career `Generate Roadmap` fires a request to `career-path-analysis`

🛑 **PAUSE 1.2** — Post DevTools Network screenshot showing `functions.invoke` calls. Wait for approval.

---

### Task N1 — Connect Discovery Agent Results to Search (New)

**GitHub Issue:** `"feat: surface discovery_jobs results in search-jobs — unify two ingestion pipelines in one search layer"`  
**Branch:** `feat/unify-search-discovery-results`

**Context:** There are currently two separate job pipelines that never talk to each other:
- Python scraper → `job_postings` → `search-jobs` reads it
- Discovery Agent → `discovery_jobs` → bridge → `discovered_jobs` — but `search-jobs` never reads this

Users with `discovered_jobs` rows (computed by the bridge every 30 min) don't see them in search.

**This task is mostly done** if Task 1.1 is implemented — Mode C (profileDiscovery) in the v6 rewrite already queries `discovered_jobs`. Verify that the bridge is running and producing rows:

```sql
-- Confirm bridge is producing rows
SELECT COUNT(*), COUNT(DISTINCT user_id) FROM discovered_jobs;

-- Confirm pg_cron job is active
SELECT jobname, active FROM cron.job WHERE jobname ILIKE '%bridge%';
```

If `discovered_jobs` has rows for real users, the Task 1.1 rewrite handles this automatically. If not, the cron job may need to be triggered manually:

```sql
SELECT bridge_jobs_to_discovered();
```

**Validation:**
- [ ] `discovered_jobs` has rows for at least one non-test user
- [ ] Searching with no criteria as a user who has `discovered_jobs` returns those jobs (mode = `profile_discovery`)

No PAUSE needed — this is a verification step only.

---

## Phase 2 — Job Ingestion Hardening

*Begin only after Phase 1 is fully merged to dev.*

### Task 2.1 — Enable Adzuna and USAJobs Sources

**GitHub Issue:** `"feat: activate Adzuna and USAJobs discovery-agent adapters — add API secrets to Supabase"`  
**Branch:** `feat/enable-adzuna-usajobs-sources`

**Context:** Both adapters are fully implemented in the `discovery-agent` edge function (v7, deployed). The only blockers are the API secrets and feature flags.

**Step 1 — Amir: Set secrets in Supabase Dashboard** (`bryoehuhhhjqcueomgev` → Edge Functions → Secrets):
- `ADZUNA_APP_ID` — from https://developer.adzuna.com
- `ADZUNA_APP_KEY` — from https://developer.adzuna.com
- `USAJOBS_API_KEY` — free from https://developer.usajobs.gov/apirequest/
- `USAJOBS_USER_AGENT` — set to `icareeros@jabrisolutions.com`

**Step 2 — Enable feature flags after secrets are set:**
```sql
UPDATE feature_flags
SET enabled = true
WHERE key IN ('discovery_board_adzuna', 'discovery_board_usajobs');
```

**Step 3 — Smoke test:**
```bash
curl -X POST \
  https://bryoehuhhhjqcueomgev.supabase.co/functions/v1/discovery-agent \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"search_term":"software engineer","results_wanted":10}'
```

Check response: both `adzuna` and `usajobs` should show `inserted > 0` in results.

**Validation:**
- [ ] `discovery_jobs` gains new rows with `source_board = 'adzuna'`
- [ ] `discovery_jobs` gains new rows with `source_board = 'usajobs'`
- [ ] `scraper_runs` shows success entries for both adapters

🛑 **PAUSE 2.1** — Post smoke test response JSON and confirm row counts. Wait for approval.

---

### Task 2.2 — Add Expired Job Cleanup Cron

**GitHub Issue:** `"feat: add daily pg_cron job to delete expired job_postings rows"`  
**Branch:** `feat/job-expiry-cleanup-cron`

**Context:** `job_postings` already has `expires_at GENERATED ALWAYS AS (scraped_at + 7 days)`. The column and index exist. What's missing is the cron job that actually deletes expired rows.

```sql
-- Migration: add_job_postings_expiry_cron.sql

-- Daily cleanup at 3am UTC
SELECT cron.schedule(
  'delete-expired-job-postings',
  '0 3 * * *',
  $$DELETE FROM public.job_postings WHERE expires_at < now()$$
);

-- Also add cleanup for discovery_jobs staging table (30-day retention)
SELECT cron.schedule(
  'delete-stale-discovery-jobs',
  '30 3 * * *',
  $$DELETE FROM public.discovery_jobs WHERE scraped_at < now() - interval '30 days'$$
);
```

Apply as a migration:
```bash
supabase migration new add_job_expiry_cron
# Add SQL above to the migration file
supabase db push --project-ref bryoehuhhhjqcueomgev
```

🛑 **PAUSE 2.2** — Confirm migration applied. Run:
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname ILIKE '%expir%' OR jobname ILIKE '%stale%';
```

---

### Task 2.3 — Admin Job Ingestion Health Panel

**GitHub Issue:** `"feat: add job ingestion health panel to Command Center — source row counts and freshness"`  
**Branch:** `feat/admin-job-ingestion-health`

**Context:** The existing `DiscoveryHealthPanel` in AdminSystem.tsx shows `scraper_runs` audit data (adapter-level health). This task adds a complementary panel showing the actual job counts and freshness in `job_postings` — useful for monitoring the Python scraper pipeline separately from the Discovery Agent.

Open a Lovable prompt on this branch:

```
In the admin Command Center (/admin), add a "Job Ingestion Health" panel BELOW the existing Discovery Agent health panel.

Data comes from this Supabase query (run on component mount and refresh):
  SELECT source, COUNT(*) as row_count,
    MAX(scraped_at) as latest_scrape,
    MIN(scraped_at) as oldest_scrape
  FROM public.job_postings
  GROUP BY source
  ORDER BY row_count DESC

Display as a table with columns:
- Source name (left-aligned)
- Job count (badge — indigo/teal)
- Latest scrape (relative time, e.g. "2 hours ago")
- Status chip: GREEN if latest_scrape within 24h, YELLOW if within 72h, RED if older

Show a "Total Jobs in job_postings" summary line at the top.

Also query discovery_jobs for the Discovery Agent pipeline count:
  SELECT source_board, COUNT(*) FROM discovery_jobs GROUP BY source_board

Show this as a second section titled "Discovery Agent Pipeline" in the same panel.

Auto-refresh every 5 minutes. Add a "Refresh" button (top right of panel).

Use the existing design language from DiscoveryHealthPanel.tsx — same card style, same badge variants.
```

---

## Phase 3 — Matching Engine Improvements

*Begin only after Phase 2 is fully deployed and stable.*

### Task 3.1 — Skill Synonym Normalization

**GitHub Issue:** `"feat: add skill_synonyms table to normalize React vs React.js vs ReactJS in matching"`  
**Branch:** `feat/skill-synonym-normalization`

**Step 1 — Create and seed the table:**
```sql
-- Migration: skill_synonyms.sql
CREATE TABLE IF NOT EXISTS public.skill_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical text NOT NULL,
  synonym text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(canonical, synonym)
);

ALTER TABLE public.skill_synonyms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read skill synonyms"
  ON public.skill_synonyms FOR SELECT USING (true);
CREATE POLICY "service role can write skill synonyms"
  ON public.skill_synonyms FOR ALL USING (auth.role() = 'service_role');

INSERT INTO public.skill_synonyms (canonical, synonym) VALUES
  ('React', 'React.js'), ('React', 'ReactJS'), ('React', 'React JS'),
  ('Node.js', 'Node'), ('Node.js', 'NodeJS'), ('Node.js', 'Node JS'),
  ('TypeScript', 'TS'), ('JavaScript', 'JS'), ('JavaScript', 'ES6'),
  ('Python', 'Python3'), ('Python', 'Python 3'),
  ('Machine Learning', 'ML'), ('Machine Learning', 'machine-learning'),
  ('Artificial Intelligence', 'AI'),
  ('PostgreSQL', 'Postgres'), ('PostgreSQL', 'psql'),
  ('Kubernetes', 'K8s'), ('Docker', 'containerization'),
  ('GraphQL', 'GQL'), ('REST API', 'RESTful API'), ('REST API', 'REST'),
  ('Amazon Web Services', 'AWS'), ('Google Cloud Platform', 'GCP'),
  ('Microsoft Azure', 'Azure'), ('Continuous Integration', 'CI/CD'),
  ('User Experience', 'UX'), ('User Interface', 'UI'),
  ('Product Management', 'PM'), ('SQL', 'Structured Query Language')
ON CONFLICT (canonical, synonym) DO NOTHING;
```

**Step 2 — Use synonyms in search-jobs:**

After the v6 rewrite, add a helper function in `search-jobs/index.ts`:

```typescript
async function expandWithSynonyms(supabase: any, term: string): Promise<string[]> {
  const { data } = await supabase
    .from('skill_synonyms')
    .select('canonical, synonym')
    .or(`canonical.ilike.%${term}%,synonym.ilike.%${term}%`)
  if (!data || data.length === 0) return [term]
  const expanded = new Set<string>([term])
  for (const row of data) {
    expanded.add(row.canonical)
    expanded.add(row.synonym)
  }
  return Array.from(expanded)
}
```

Call this in `queryJobPostings` before building the `ilike` filter when the search term looks like a skill name (single word, no spaces).

🛑 **PAUSE 3.1** — Confirm migration applied. Run:
```sql
SELECT COUNT(*) FROM public.skill_synonyms;
```
Expected: 29+ rows.

---

### Task 3.2 — Behavioral Signal Tracking

**GitHub Issue:** `"feat: track job save/dismiss/apply signals to improve future matching"`  
**Branch:** `feat/behavioral-signal-tracking`

**Step 1 — Create interaction table (if it doesn't already exist):**
```sql
CREATE TABLE IF NOT EXISTS public.job_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.job_postings(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('viewed', 'saved', 'dismissed', 'applied', 'interview', 'offer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, job_id, action)
);

ALTER TABLE public.job_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own interactions"
  ON public.job_interactions FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_job_interactions_user
  ON public.job_interactions (user_id, action, created_at DESC);
```

**Step 2 — Wire save/dismiss in Lovable:**

Open a Lovable prompt on branch `feature/job-interaction-tracking`:

```
On every job card across the platform (Opportunity Radar, Pipeline, Autopilot results):

1. Add a Save button (bookmark icon). When clicked:
   - Insert into job_interactions: { user_id (from auth session), job_id, action: 'saved' }
   - Show filled bookmark icon to confirm
   - Toast: "Job saved"

2. Add a Dismiss button (X icon). When clicked:
   - Insert into job_interactions: { user_id, job_id, action: 'dismissed' }
   - Fade out and remove the job card from current results
   - No toast (dismissals should feel frictionless)

3. When user clicks "Apply" or "Apply Now":
   - Insert into job_interactions: { user_id, job_id, action: 'applied' }
   - This is in addition to any existing application tracking

Table: public.job_interactions
Columns: user_id (auth session), job_id (job card props), action (string).
```

**Step 3 — Apply behavioral signals in search results:**

In `search-jobs/index.ts`, after `attachFitScores`, add:

```typescript
async function applyBehavioralSignals(supabase: any, userId: string, jobs: JobResult[]): Promise<JobResult[]> {
  if (!jobs.length) return jobs
  const { data: interactions } = await supabase
    .from('job_interactions')
    .select('job_id, action')
    .eq('user_id', userId)
    .in('job_id', jobs.map(j => j.id))
  if (!interactions?.length) return jobs
  const dismissed = new Set(interactions.filter((i: any) => i.action === 'dismissed').map((i: any) => i.job_id))
  return jobs.filter(j => !dismissed.has(j.id))  // Never show dismissed jobs again
}
```

🛑 **PAUSE 3.2** — Confirm `job_interactions` table created and Lovable PR is open for review.

---

## Final Verification Checklist

Run these before Amir merges dev→main:

**Backend (Supabase SQL Editor):**
```sql
-- 1. Job supply by source (target: 3+ sources, 1000+ total)
SELECT source, COUNT(*) FROM job_postings GROUP BY source ORDER BY COUNT(*) DESC;

-- 2. Confirm no public tables have RLS disabled
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
-- Expected: 0 rows

-- 3. discovery-agent pipeline healthy
SELECT source_board, COUNT(*) FROM discovery_jobs GROUP BY source_board;

-- 4. skill_synonyms seeded
SELECT COUNT(*) FROM skill_synonyms;

-- 5. cron jobs active
SELECT jobname, active FROM cron.job ORDER BY jobname;

-- 6. search performance (should be < 500ms)
EXPLAIN ANALYZE
SELECT * FROM job_postings
WHERE title ILIKE '%software engineer%'
  AND is_remote = true
  AND expires_at > now()
ORDER BY scraped_at DESC
LIMIT 50;
```

**Frontend (manual test):**

| Scenario | Expected Result |
|---|---|
| New user, no profile, no search, click Search Jobs | 20+ diverse jobs, mode = `pure_discovery` |
| New user, type "software engineer", click Search Jobs | Filtered results, no fit scores, nudge banner visible |
| Test account (full profile), no search | Profile-biased results with fit scores, mode = `profile_discovery` |
| Test account, type "python remote" | Filtered results with fit scores |
| Any user, save a job | Bookmark fills, row in `job_interactions` |
| Any user, dismiss a job | Card fades, row in `job_interactions`, job never reappears |
| Autopilot "Find & Queue Jobs" click | Row in `agent_runs` within 5 seconds |
| Flight Plan "Generate Roadmap" click | Network call fires to `career-path-analysis` |
| No raw fetch in Network tab for any edge function | All calls go through `/rest/v1/functions` SDK path |

---

## Task Order Summary

| # | Task | Phase | Status |
|---|---|---|---|
| 0.1 | Run production diagnostics | Phase 0 | 🟡 Open |
| 1.1 | Rewrite search-jobs (four-mode) | Phase 1 | 🟡 Open |
| 1.2 | Fix remaining raw-fetch files | Phase 1 | 🟡 Open |
| N1 | Verify discovery results surface in search | Phase 1 | 🟡 Verify |
| 2.1 | Enable Adzuna + USAJobs (set secrets + flip flags) | Phase 2 | 🔑 Needs API keys |
| 2.2 | Add expired row cleanup cron | Phase 2 | 🟡 Open |
| 2.3 | Admin job ingestion health panel | Phase 2 | 🟡 Open |
| 3.1 | Skill synonym normalization | Phase 3 | 🟡 Open |
| 3.2 | Behavioral signal tracking | Phase 3 | 🟡 Open |

---

*Package manager: `bun` only. Never npm.*  
*Lovable: UI changes only. Never backend/SQL/edge functions.*  
*Branch policy: All work → `dev`. Amir merges dev→main personally.*  
*Supabase production ref: `bryoehuhhhjqcueomgev` — do NOT use stale ref `gberhsbddthwkjimsqig`*

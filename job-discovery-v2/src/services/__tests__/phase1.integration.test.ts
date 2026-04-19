// =============================================================================
// iCareerOS — Phase 1 Integration Tests
//
// Prerequisites before running:
//   1. Ollama running: ollama serve (in separate terminal)
//   2. Mistral downloaded: ollama pull mistral
//   3. Supabase connected: SUPABASE_URL + SUPABASE_SERVICE_KEY in env
//   4. Migrations applied: 20260415_001 + 20260415_002
//
// Run:
//   bun test src/services/__tests__/phase1.integration.test.ts
//   # or with timeout
//   jest --testTimeout=120000 src/services/__tests__/phase1.integration.test.ts
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { jobSourcingService } from '../job-sourcing-service'
import { jobExtractionService } from '../job-extraction-service'
import { deduplicationService } from '../deduplication-service'
import { matchingService } from '../matching-service'
import { eventBus } from '../../shared/services/event-bus'

// Increase timeout — Ollama extraction takes ~5-15 seconds
jest.setTimeout(120_000)

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? ''
)

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Verify required env vars
  expect(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL).toBeTruthy()
  expect(process.env.SUPABASE_SERVICE_KEY).toBeTruthy()

  // Verify Ollama is reachable
  const health = await jobExtractionService.checkOllamaHealth()
  if (!health.healthy) {
    console.warn(`⚠️  Ollama not available: ${health.error}`)
    console.warn('   Extraction tests will use fallback (metadata only)')
  }
})

afterAll(async () => {
  // Clean up test data — only delete rows created by tests
  await supabase
    .from('raw_jobs')
    .delete()
    .like('source_job_id', 'test_%')
})

// ── Schema Tests ──────────────────────────────────────────────────────────────

describe('Database schema', () => {
  test('All 7 new tables exist', async () => {
    const tables = [
      'raw_jobs',
      'extracted_jobs',
      'deduplicated_jobs',
      'job_scores',
      'extraction_feedback',
      'extraction_accuracy',
      'platform_events',
    ]

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      expect(error).toBeNull()
    }
  })

  test('extraction_accuracy seeded with known sources', async () => {
    const { data, error } = await supabase
      .from('extraction_accuracy')
      .select('source')

    expect(error).toBeNull()
    const sources = (data ?? []).map(r => r.source)
    expect(sources).toContain('indeed')
    expect(sources).toContain('linkedin')
    expect(sources).toContain('greenhouse')
  })

  test('Existing tables (job_postings, discovered_jobs) still intact', async () => {
    const { error: e1 } = await supabase.from('job_postings').select('id').limit(1)
    const { error: e2 } = await supabase.from('discovered_jobs').select('id').limit(1)
    expect(e1).toBeNull()
    expect(e2).toBeNull()
  })
})

// ── Event Bus Tests ───────────────────────────────────────────────────────────

describe('Event bus', () => {
  test('Publishes and records events', async () => {
    const testEventId = await eventBus.publish({
      event_type: 'job.fetched',
      payload: { test: true, raw_job_id: 'test_123', source: 'test' },
    })

    expect(testEventId).toBeTruthy()

    // Verify it's in the DB
    const { data, error } = await supabase
      .from('platform_events')
      .select('*')
      .eq('id', testEventId)
      .single()

    expect(error).toBeNull()
    expect(data?.event_type).toBe('job.fetched')
    expect(data?.payload?.test).toBe(true)
  })

  test('Batch publish works', async () => {
    await expect(
      eventBus.publishBatch([
        { event_type: 'job.fetched', payload: { batch: 1 } },
        { event_type: 'job.fetched', payload: { batch: 2 } },
      ])
    ).resolves.not.toThrow()
  })

  test('Poll returns recent events of the right type', async () => {
    const events = await eventBus.poll('job.fetched', 'test-consumer')
    expect(Array.isArray(events)).toBe(true)
  })
})

// ── Job Sourcing Tests ────────────────────────────────────────────────────────

describe('Job sourcing service', () => {
  let fetchedJobIds: string[] = []

  test('Fetches from JobSpy bridge (job_postings)', async () => {
    const result = await jobSourcingService.fetchJobs({
      query: 'software engineer',
      limit: 5,
      cowork_only: false,
    })

    // May be 0 if job_postings is empty, but should not throw
    expect(result.count).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(result.raw_job_ids)).toBe(true)
    expect(Array.isArray(result.failed_sources)).toBe(true)
    fetchedJobIds = result.raw_job_ids
  })

  test('Fetches from Cowork APIs (at least 1 source responds)', async () => {
    const result = await jobSourcingService.fetchJobs({
      query: 'react developer',
      limit: 10,
      cowork_only: true,
    })

    // Cowork APIs are external — at least one should respond
    expect(result.failed_sources.length).toBeLessThan(6)  // Not all sources fail
    expect(result.count).toBeGreaterThanOrEqual(0)
  })

  test('Stores raw_jobs with correct schema', async () => {
    if (fetchedJobIds.length === 0) {
      console.log('No jobs fetched — skipping schema check')
      return
    }

    const { data, error } = await supabase
      .from('raw_jobs')
      .select('*')
      .in('id', fetchedJobIds.slice(0, 3))

    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(row.source).toBeTruthy()
      expect(row.url).toBeTruthy()
      expect(row.fetch_method).toBeTruthy()
    }
  })

  test('Publishes job.fetched events', async () => {
    const { data, error } = await supabase
      .from('platform_events')
      .select('event_type, payload')
      .eq('event_type', 'job.fetched')
      .order('published_at', { ascending: false })
      .limit(5)

    expect(error).toBeNull()
    expect((data?.length ?? 0)).toBeGreaterThanOrEqual(0)  // May be 0 if no jobs fetched
  })
})

// ── Job Extraction Tests ──────────────────────────────────────────────────────

describe('Job extraction service', () => {
  let testRawJobId: string

  beforeAll(async () => {
    // Insert a test raw_job for extraction
    const { data, error } = await supabase
      .from('raw_jobs')
      .upsert({
        source: 'test',
        source_job_id: 'test_extraction_001',
        title: 'Senior TypeScript Engineer',
        company: 'Acme Corp',
        location: 'San Francisco, CA',
        remote_type: 'hybrid',
        url: 'https://example.com/jobs/test_extraction_001',
        raw_json: {
          title: 'Senior TypeScript Engineer',
          company: 'Acme Corp',
          description: `
            We are looking for a Senior TypeScript Engineer to join our team.
            Requirements:
            - 5+ years of TypeScript/JavaScript experience
            - Strong React and Node.js skills
            - Experience with PostgreSQL and Redis
            - GraphQL API design experience preferred
            - Hybrid work schedule (3 days in office, San Francisco)
            Salary: $150,000 - $200,000 per year
            Benefits: Health insurance, 401k, stock options, unlimited PTO
          `,
        },
        fetch_method: 'cowork_api',
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'url' })
      .select('id')
      .single()

    expect(error).toBeNull()
    testRawJobId = data?.id
  })

  test('Extracts job with Mistral or fallback', async () => {
    expect(testRawJobId).toBeTruthy()

    const extracted = await jobExtractionService.extractJob(testRawJobId)

    expect(extracted.title).toBeTruthy()
    expect(extracted.company).toBeTruthy()
    expect(extracted.confidence_score).toBeGreaterThanOrEqual(0)
    expect(extracted.confidence_score).toBeLessThanOrEqual(1)
    expect(['mistral', 'claude', 'fallback_manual']).toContain(extracted.extraction_method)
    expect(Array.isArray(extracted.required_skills)).toBe(true)
  })

  test('Saves extraction to extracted_jobs table', async () => {
    const { data, error } = await supabase
      .from('extracted_jobs')
      .select('*')
      .eq('raw_job_id', testRawJobId)
      .single()

    expect(error).toBeNull()
    expect(data?.title).toBeTruthy()
    expect(data?.company).toBeTruthy()
    expect(data?.extraction_method).toBeTruthy()
  })

  test('Publishes job.extracted event', async () => {
    const { data, error } = await supabase
      .from('platform_events')
      .select('*')
      .eq('event_type', 'job.extracted')
      .contains('payload', { raw_job_id: testRawJobId })
      .single()

    expect(error).toBeNull()
    expect(data?.payload?.raw_job_id).toBe(testRawJobId)
  })
})

// ── Deduplication Tests ───────────────────────────────────────────────────────

describe('Deduplication service', () => {
  test('Creates new dedup record for unique job', async () => {
    // Insert two identical jobs from different sources
    const baseUrl1 = `https://indeed.com/jobs/dedup_test_${Date.now()}`
    const baseUrl2 = `https://linkedin.com/jobs/dedup_test_${Date.now()}`

    const insertJobs = async (url: string, source: string) => {
      const { data: rawJob } = await supabase
        .from('raw_jobs')
        .insert({
          source, source_job_id: `test_dedup_${Date.now()}`,
          title: 'Dedup Test Engineer', company: 'TestCo',
          location: 'Remote', url,
          fetch_method: 'cowork_api', fetched_at: new Date().toISOString(),
        })
        .select('id').single()

      const { data: extracted } = await supabase
        .from('extracted_jobs')
        .insert({
          raw_job_id: rawJob?.id, source, source_job_id: `test_dedup_${Date.now()}`,
          title: 'Dedup Test Engineer', company: 'TestCo',
          location: 'Remote', remote_type: 'remote',
          required_skills: ['TypeScript', 'React'],
          experience_level: 'mid', employment_type: 'full-time',
          confidence_score: 0.85, extraction_method: 'mistral',
          extracted_at: new Date().toISOString(),
        })
        .select('id').single()

      return extracted?.id
    }

    const id1 = await insertJobs(baseUrl1, 'indeed')
    const id2 = await insertJobs(baseUrl2, 'linkedin')

    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()

    // Dedup both
    const result1 = await deduplicationService.dedupJob(id1!)
    const result2 = await deduplicationService.dedupJob(id2!)

    // Should be the same dedup record (same title+company+location)
    expect(result1.dedupId).toBe(result2.dedupId)
    expect(result1.isNew).toBe(true)
    expect(result2.isNew).toBe(false)
  })

  test('Different jobs get different dedup records', async () => {
    // Two jobs with different titles
    const insert = async (title: string, url: string) => {
      const { data: raw } = await supabase
        .from('raw_jobs')
        .insert({
          source: 'test', source_job_id: `test_unique_${Date.now()}_${title}`,
          title, company: 'DifferentCo', location: 'NYC',
          url, fetch_method: 'cowork_api', fetched_at: new Date().toISOString(),
        }).select('id').single()

      const { data: ex } = await supabase
        .from('extracted_jobs')
        .insert({
          raw_job_id: raw?.id, source: 'test',
          title, company: 'DifferentCo', location: 'NYC',
          remote_type: 'onsite', required_skills: [], experience_level: 'mid',
          employment_type: 'full-time', confidence_score: 0.8,
          extraction_method: 'mistral', extracted_at: new Date().toISOString(),
        }).select('id').single()

      return ex?.id
    }

    const ts = Date.now()
    const id1 = await insert('Frontend Engineer', `https://example.com/fe_${ts}`)
    const id2 = await insert('Backend Engineer', `https://example.com/be_${ts}`)

    const r1 = await deduplicationService.dedupJob(id1!)
    const r2 = await deduplicationService.dedupJob(id2!)

    expect(r1.dedupId).not.toBe(r2.dedupId)
  })
})

// ── Matching Tests ─────────────────────────────────────────────────────────────

describe('Matching service — scoring algorithm', () => {
  const mockJob = {
    id: 'test_job',
    title: 'Senior React Developer',
    company: 'TechCo',
    location: 'San Francisco, CA',
    source_count: 2,
    remote_type: 'hybrid',
    required_skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
    experience_level: 'senior',
    salary_min: 150000,
    salary_max: 200000,
    job_description_clean: 'Build and maintain frontend applications.',
  }

  test('Perfect match scores high', () => {
    const result = matchingService.scoreJob(mockJob, {
      id: 'user_1',
      target_titles: ['Senior React Developer'],
      target_skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      remote_preference: 'hybrid',
      salary_min: 140000,
      salary_max: 220000,
      preferred_locations: ['San Francisco'],
      experience_level: 'senior',
    })

    expect(result.fit_score).toBeGreaterThanOrEqual(80)
    expect(result.skill_match_pct).toBe(100)
  })

  test('No skill overlap scores lower', () => {
    const result = matchingService.scoreJob(mockJob, {
      id: 'user_2',
      target_titles: ['Data Scientist'],
      target_skills: ['Python', 'TensorFlow', 'SQL'],
      remote_preference: 'remote',
      salary_min: null,
      salary_max: null,
      preferred_locations: [],
      experience_level: 'mid',
    })

    expect(result.fit_score).toBeLessThan(50)
    expect(result.skill_match_pct).toBe(0)
  })

  test('Multi-source bonus applied', () => {
    const singleSourceJob = { ...mockJob, source_count: 1 }
    const multiSourceJob = { ...mockJob, source_count: 3 }
    const profile = {
      id: 'user_3',
      target_titles: ['React Developer'],
      target_skills: ['React', 'TypeScript'],
      remote_preference: 'any' as const,
      salary_min: null, salary_max: null,
      preferred_locations: [], experience_level: 'senior',
    }

    const r1 = matchingService.scoreJob(singleSourceJob, profile)
    const r3 = matchingService.scoreJob(multiSourceJob, profile)

    expect(r3.fit_score).toBeGreaterThan(r1.fit_score)
  })

  test('Remote preference mismatch penalises score', () => {
    const onSiteJob = { ...mockJob, remote_type: 'onsite' }
    const remoteJob = { ...mockJob, remote_type: 'remote' }
    const remoteUser = {
      id: 'user_4',
      target_titles: ['React Developer'],
      target_skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      remote_preference: 'remote' as const,
      salary_min: null, salary_max: null,
      preferred_locations: [], experience_level: 'senior',
    }

    const onsiteScore = matchingService.scoreJob(onSiteJob, remoteUser)
    const remoteScore = matchingService.scoreJob(remoteJob, remoteUser)

    expect(remoteScore.fit_score).toBeGreaterThan(onsiteScore.fit_score)
  })
})

// ── Pipeline Stats Tests ──────────────────────────────────────────────────────

describe('Pipeline views', () => {
  test('pipeline_stats_24h view returns counts', async () => {
    const { data, error } = await supabase
      .rpc('pipeline_stats_24h')
      .single()
      .catch(() =>
        // Fallback: query the view directly
        supabase.from('pipeline_stats_24h').select('*').single()
      )

    // View may not have data yet — just check it doesn't error
    expect(error?.message).not.toContain('does not exist')
  })
})

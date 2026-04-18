#!/usr/bin/env bun
// =============================================================================
// iCareerOS — Extraction Batch Runner
// Repo path: src/job-discovery-v2/scripts/run-extraction.ts
//
// Called by: .github/workflows/job-extractor.yml (nightly 03:00 UTC)
// Also callable manually: bun run scripts/run-extraction.ts
//
// Flow:
//   1. Pull unextracted raw_jobs from Supabase (last 48h)
//   2. Try Ollama/Mistral first (free, works locally)
//   3. Fall back to Claude Haiku for any that fail (GitHub Actions)
//   4. Write structured data to extracted_jobs
//   5. Publish job.extracted events
//   6. Exit 0 on success, 1 if >20% of jobs failed
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import { createHash } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const OLLAMA_URL = process.env.OLLAMA_API_URL ?? ''
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'mistral'
const LIMIT = parseInt(process.env.EXTRACTION_LIMIT ?? '500', 10)

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Extractor] Starting — limit: ${LIMIT}`)
  console.log(`[Extractor] Ollama: ${OLLAMA_URL || 'disabled'}`)
  console.log(`[Extractor] Claude: ${ANTHROPIC_KEY ? 'enabled' : 'disabled'}`)

  // 1. Fetch unextracted raw_jobs from last 48 hours
  const { data: rawJobs, error } = await supabase
    .from('raw_jobs')
    .select('id, source, source_job_id, title, company, location, remote_type, salary_min, salary_max, raw_html, raw_json')
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(LIMIT)

  if (error) {
    console.error('❌ Failed to fetch raw_jobs:', error.message)
    process.exit(1)
  }

  // Filter out already-extracted jobs
  const unextracted = await filterUnextracted(rawJobs ?? [])
  console.log(`[Extractor] ${unextracted.length} unextracted jobs found (from ${rawJobs?.length ?? 0} total)`)

  if (unextracted.length === 0) {
    console.log('[Extractor] Nothing to do — all jobs already extracted')
    process.exit(0)
  }

  // 2. Extract in batches of 10 (concurrency limit)
  let processed = 0, failed = 0
  const batchSize = 10
  const startTime = Date.now()

  for (let i = 0; i < unextracted.length; i += batchSize) {
    const batch = unextracted.slice(i, i + batchSize)
    const results = await Promise.allSettled(batch.map(job => extractAndSave(job)))

    for (const result of results) {
      if (result.status === 'fulfilled') processed++
      else { failed++; console.error('  ↳ Failed:', result.reason?.message) }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const rate = Math.round(processed / (elapsed || 1))
    console.log(`[Extractor] Progress: ${processed + failed}/${unextracted.length} | ${rate} jobs/sec | ${failed} failed`)
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n[Extractor] ✅ Done in ${elapsed}s`)
  console.log(`  Processed: ${processed}`)
  console.log(`  Failed:    ${failed}`)
  console.log(`  Cost est.: ~$${(processed * 0.00025).toFixed(2)} (Claude Haiku @ $0.25/1M tokens)`)

  // Fail the workflow if >20% error rate
  const errorRate = failed / (processed + failed)
  if (errorRate > 0.20) {
    console.error(`❌ Error rate ${Math.round(errorRate * 100)}% exceeds 20% threshold`)
    process.exit(1)
  }
}

// ── Filter already-extracted ──────────────────────────────────────────────────

async function filterUnextracted(jobs: any[]): Promise<any[]> {
  if (jobs.length === 0) return []

  const ids = jobs.map(j => j.id)
  const { data: extracted } = await supabase
    .from('extracted_jobs')
    .select('raw_job_id')
    .in('raw_job_id', ids)

  const extractedSet = new Set((extracted ?? []).map((e: any) => e.raw_job_id))
  return jobs.filter(j => !extractedSet.has(j.id))
}

// ── Extract a single job ──────────────────────────────────────────────────────

async function extractAndSave(job: any): Promise<void> {
  const jobText = buildJobText(job)
  let extracted: any = null

  // Try Ollama first (free, works locally or on self-hosted server)
  if (OLLAMA_URL) {
    try {
      extracted = await extractWithOllama(jobText, job.source)
    } catch {
      // Fall through to Claude
    }
  }

  // Claude fallback (GitHub Actions, or when Ollama confidence < 0.70)
  if ((!extracted || extracted.confidence_score < 0.70) && ANTHROPIC_KEY) {
    extracted = await extractWithClaude(jobText)
  }

  // Last resort: metadata fallback (no LLM)
  if (!extracted) {
    extracted = {
      title: job.title ?? 'Unknown Title',
      company: job.company ?? 'Unknown Company',
      location: job.location ?? '',
      remote_type: job.remote_type ?? 'unknown',
      required_skills: [],
      experience_level: 'unknown',
      employment_type: 'unknown',
      job_description_clean: '',
      salary_min: job.salary_min ?? null,
      salary_max: job.salary_max ?? null,
      currency: 'USD',
      confidence_score: 0.3,
      extraction_method: 'fallback_manual',
    }
  }

  // Save to extracted_jobs
  const { error } = await supabase.from('extracted_jobs').upsert({
    raw_job_id: job.id,
    source: job.source,
    source_job_id: job.source_job_id,
    ...extracted,
    extracted_at: new Date().toISOString(),
  }, { onConflict: 'raw_job_id' })

  if (error) throw new Error(`DB upsert failed: ${error.message}`)

  // Publish event
  await supabase.from('platform_events').insert({
    event_type: 'job.extracted',
    payload: {
      raw_job_id: job.id,
      source: job.source,
      confidence_score: extracted.confidence_score,
      extraction_method: extracted.extraction_method,
    },
  })
}

// ── Ollama extraction ─────────────────────────────────────────────────────────

async function extractWithOllama(jobText: string, source: string): Promise<any> {
  const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_MODEL,
    prompt: buildExtractionPrompt(jobText),
    stream: false,
    options: { temperature: 0.1, num_predict: 800 },
  }, { timeout: 45_000 })

  return parseJsonResponse(response.data.response, 'mistral')
}

// ── Claude Haiku extraction ───────────────────────────────────────────────────

async function extractWithClaude(jobText: string): Promise<any> {
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildExtractionPrompt(jobText) }],
  }, {
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  })

  return parseJsonResponse(response.data.content?.[0]?.text ?? '', 'claude')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildJobText(job: any): string {
  if (job.raw_html?.length > 200) {
    return job.raw_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000)
  }
  const j = job.raw_json ?? {}
  return [job.title, job.company, job.location, j.description ?? ''].filter(Boolean).join('\n').slice(0, 5000)
}

function buildExtractionPrompt(text: string): string {
  return `Extract job details. Return ONLY valid JSON, no markdown, no explanation.

Job posting:
---
${text.slice(0, 4000)}
---

Return exactly:
{"title":"...","company":"...","location":"...","remote_type":"remote|hybrid|onsite|unknown","required_skills":["skill1"],"experience_level":"entry|mid|senior|executive|unknown","employment_type":"full-time|contract|part-time|intern|unknown","job_description_clean":"core duties only max 300 chars","salary_min":null,"salary_max":null,"currency":"USD","confidence_score":0.0}`
}

function parseJsonResponse(text: string, method: string): any {
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  if (!match) throw new Error('No JSON in response')
  const parsed = JSON.parse(match[1] ?? match[0])
  const VALID_REMOTE = ['remote', 'hybrid', 'onsite', 'unknown']
  const VALID_EXP = ['entry', 'mid', 'senior', 'executive', 'unknown']
  const VALID_EMP = ['full-time', 'contract', 'part-time', 'intern', 'unknown']
  return {
    title: String(parsed.title ?? 'Unknown'),
    company: String(parsed.company ?? 'Unknown'),
    location: String(parsed.location ?? ''),
    remote_type: VALID_REMOTE.includes(parsed.remote_type) ? parsed.remote_type : 'unknown',
    required_skills: Array.isArray(parsed.required_skills) ? parsed.required_skills.map(String).slice(0, 20) : [],
    experience_level: VALID_EXP.includes(parsed.experience_level) ? parsed.experience_level : 'unknown',
    employment_type: VALID_EMP.includes(parsed.employment_type) ? parsed.employment_type : 'unknown',
    job_description_clean: String(parsed.job_description_clean ?? '').slice(0, 2000),
    salary_min: typeof parsed.salary_min === 'number' ? parsed.salary_min : null,
    salary_max: typeof parsed.salary_max === 'number' ? parsed.salary_max : null,
    currency: 'USD',
    confidence_score: Math.min(1, Math.max(0, Number(parsed.confidence_score ?? 0.75))),
    extraction_method: method,
  }
}

main().catch(err => {
  console.error('❌ Extraction runner crashed:', err)
  process.exit(1)
})

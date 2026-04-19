// =============================================================================
// iCareerOS — Job Extraction Service
// Layer 2 of the Job Discovery pipeline.
//
// Responsibility: Parse raw job HTML/JSON into structured data using LLMs.
// Primary:  Mistral 7B via Ollama (self-hosted, $0/month)
// Fallback: Claude Haiku via Anthropic API (~$5/month for edge cases)
//
// Strategy:
//   1. Try Mistral (free) — handles ~90% of extractions
//   2. If confidence < 0.70 → publish extraction.low_confidence event
//   3. Claude handles low-confidence jobs (~10% of volume)
//   4. Track accuracy per source → feeds Learning Service
//
// Listens to: job.fetched events (via poll)
// Publishes:  job.extracted, extraction.low_confidence events
// =============================================================================

import axios from 'axios'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { eventBus } from '../../shared/services/event-bus'

// ── Types ────────────────────────────────────────────────────────────────────

export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'executive' | 'unknown'
export type EmploymentType = 'full-time' | 'contract' | 'part-time' | 'intern' | 'unknown'
export type ExtractionMethod = 'mistral' | 'claude' | 'fallback_manual'

export interface ExtractedJob {
  title: string
  company: string
  location: string
  remote_type: RemoteType
  required_skills: string[]
  experience_level: ExperienceLevel
  employment_type: EmploymentType
  job_description_clean: string
  salary_min: number | null
  salary_max: number | null
  currency: string
  confidence_score: number  // 0.0–1.0
  extraction_method: ExtractionMethod
}

interface RawJob {
  id: string
  source: string
  source_job_id: string | null
  title: string | null
  company: string | null
  location: string | null
  remote_type: string | null
  salary_min: number | null
  salary_max: number | null
  raw_html: string | null
  raw_json: Record<string, unknown> | null
}

// ── Extraction Prompts (tuned per source) ───────────────────────────────────

const BASE_EXTRACTION_PROMPT = (jobText: string) => `Extract job details from the following job posting. Return ONLY valid JSON — no markdown, no code fences, no explanation.

Job posting:
---
${jobText.slice(0, 4000)}
---

Return this exact JSON structure (use null for missing fields):
{
  "title": "exact job title from posting",
  "company": "company name",
  "location": "city, state/country or 'Remote'",
  "remote_type": "remote|hybrid|onsite|unknown",
  "required_skills": ["skill1", "skill2", "skill3"],
  "experience_level": "entry|mid|senior|executive|unknown",
  "employment_type": "full-time|contract|part-time|intern|unknown",
  "job_description_clean": "core responsibilities and requirements only, no benefits or marketing, max 500 chars",
  "salary_min": null or integer (annual USD),
  "salary_max": null or integer (annual USD),
  "currency": "USD",
  "confidence_score": 0.0 to 1.0
}`

// Source-specific prompt overrides — updated by Learning Service when accuracy < 80%
const SOURCE_PROMPT_OVERRIDES: Record<string, ((text: string) => string) | undefined> = {
  remotive: (text: string) => `${BASE_EXTRACTION_PROMPT(text)}

NOTE: This is a remote-only job board. Set remote_type to "remote" unless clearly stated otherwise.`,

  weworkremotely: (text: string) => `${BASE_EXTRACTION_PROMPT(text)}

NOTE: All We Work Remotely jobs are remote. Set remote_type to "remote".`,
}

// ── Main Service ─────────────────────────────────────────────────────────────

export class JobExtractionService {
  private supabase: SupabaseClient
  private ollamaUrl: string
  private ollamaModel: string
  private anthropicKey: string | undefined

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[Extraction] Missing Supabase credentials')

    this.supabase = createClient(url, key)
    this.ollamaUrl = process.env.OLLAMA_API_URL ?? 'http://localhost:11434'
    this.ollamaModel = process.env.OLLAMA_MODEL ?? 'mistral'
    this.anthropicKey = process.env.ANTHROPIC_API_KEY
  }

  // ---------------------------------------------------------------------------
  // Extract a single raw job by ID
  // ---------------------------------------------------------------------------
  async extractJob(rawJobId: string): Promise<ExtractedJob> {
    const { data: rawJob, error } = await this.supabase
      .from('raw_jobs')
      .select('*')
      .eq('id', rawJobId)
      .single()

    if (error || !rawJob) {
      throw new Error(`[Extraction] Raw job not found: ${rawJobId}`)
    }

    const job = rawJob as RawJob
    return this.extractFromRaw(job)
  }

  // ---------------------------------------------------------------------------
  // Batch: extract all unprocessed raw_jobs
  // Called by pg_cron → Edge Function → this method
  // ---------------------------------------------------------------------------
  async extractBatch(limit = 500): Promise<{ processed: number; failed: number }> {
    console.log(`[Extraction] Starting batch (limit: ${limit})`)

    // Get unextracted raw_jobs from last 48 hours
    const { data: rawJobs, error } = await this.supabase
      .from('raw_jobs')
      .select('id, source, source_job_id, title, company, location, remote_type, salary_min, salary_max, raw_html, raw_json')
      .not('id', 'in',
        `(SELECT raw_job_id FROM extracted_jobs WHERE raw_job_id IS NOT NULL)`
      )
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error(`[Extraction] Batch query failed:`, error.message)
      throw error
    }

    const jobs = (rawJobs ?? []) as RawJob[]
    console.log(`[Extraction] Processing ${jobs.length} unextracted jobs`)

    let processed = 0
    let failed = 0

    // Process in parallel batches of 10 (Ollama concurrency limit)
    const batches = chunk(jobs, 10)

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(job => this.extractFromRaw(job).then(extracted => ({
          rawJobId: job.id,
          source: job.source,
          extracted,
        })))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          processed++
        } else {
          failed++
          console.error(`[Extraction] Job failed:`, result.reason?.message)
        }
      }
    }

    console.log(`[Extraction] Batch done: ${processed} ok, ${failed} failed`)
    return { processed, failed }
  }

  // ---------------------------------------------------------------------------
  // Core extraction logic
  // ---------------------------------------------------------------------------
  private async extractFromRaw(job: RawJob): Promise<ExtractedJob> {
    const jobText = buildJobText(job)
    const source = job.source ?? 'unknown'

    // Try Mistral first (free)
    let extracted: ExtractedJob | null = null

    try {
      extracted = await this.extractWithMistral(jobText, source)
    } catch (err) {
      console.warn(`[Extraction] Mistral failed for ${job.id}:`, (err as Error).message)
    }

    // If Mistral confidence is low, try Claude (paid fallback)
    if (!extracted || extracted.confidence_score < 0.70) {
      if (extracted) {
        // Publish low-confidence event for monitoring
        await eventBus.publish({
          event_type: 'extraction.low_confidence',
          payload: {
            raw_job_id: job.id,
            source,
            confidence: extracted.confidence_score,
            will_use_claude: !!this.anthropicKey,
          },
        })
      }

      if (this.anthropicKey) {
        try {
          console.log(`[Extraction] Claude fallback: ${job.title} (${source})`)
          extracted = await this.extractWithClaude(jobText)
        } catch (err) {
          console.error(`[Extraction] Claude failed:`, (err as Error).message)
        }
      }
    }

    // If both fail, use metadata we already have from raw_jobs as fallback
    if (!extracted) {
      extracted = buildFallbackExtraction(job)
      console.warn(`[Extraction] Using metadata fallback for ${job.id}`)
    }

    // Persist to extracted_jobs
    await this.saveExtraction(job.id, source, extracted)

    return extracted
  }

  // ---------------------------------------------------------------------------
  // Mistral extraction via Ollama
  // ---------------------------------------------------------------------------
  private async extractWithMistral(jobText: string, source: string): Promise<ExtractedJob> {
    const promptFn = SOURCE_PROMPT_OVERRIDES[source] ?? BASE_EXTRACTION_PROMPT
    const prompt = promptFn(jobText)

    const response = await axios.post(
      `${this.ollamaUrl}/api/generate`,
      {
        model: this.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Low temp for deterministic extraction
          num_predict: 800,
        },
      },
      { timeout: 45_000 }
    )

    const text: string = response.data.response ?? ''
    return parseExtractionResponse(text, 'mistral')
  }

  // ---------------------------------------------------------------------------
  // Claude Haiku fallback
  // ---------------------------------------------------------------------------
  private async extractWithClaude(jobText: string): Promise<ExtractedJob> {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `${BASE_EXTRACTION_PROMPT(jobText)}\n\nReturn ONLY the JSON object, nothing else.`,
          },
        ],
      },
      {
        headers: {
          'x-api-key': this.anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      }
    )

    const text: string = response.data.content?.[0]?.text ?? ''
    return parseExtractionResponse(text, 'claude')
  }

  // ---------------------------------------------------------------------------
  // Persist extraction + publish event
  // ---------------------------------------------------------------------------
  private async saveExtraction(
    rawJobId: string,
    source: string,
    extracted: ExtractedJob
  ): Promise<void> {
    const { error } = await this.supabase.from('extracted_jobs').upsert(
      {
        raw_job_id: rawJobId,
        source,
        title: extracted.title,
        company: extracted.company,
        location: extracted.location,
        remote_type: extracted.remote_type,
        required_skills: extracted.required_skills,
        experience_level: extracted.experience_level,
        employment_type: extracted.employment_type,
        job_description_clean: extracted.job_description_clean,
        salary_min: extracted.salary_min,
        salary_max: extracted.salary_max,
        currency: extracted.currency,
        confidence_score: extracted.confidence_score,
        extraction_method: extracted.extraction_method,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: 'raw_job_id' }
    )

    if (error) {
      console.error(`[Extraction] Save failed for raw_job ${rawJobId}:`, error.message)
      throw error
    }

    await eventBus.publish({
      event_type: 'job.extracted',
      payload: {
        raw_job_id: rawJobId,
        source,
        confidence_score: extracted.confidence_score,
        extraction_method: extracted.extraction_method,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Health check — verify Ollama is reachable
  // ---------------------------------------------------------------------------
  async checkOllamaHealth(): Promise<{ healthy: boolean; model: string; error?: string }> {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 })
      const models: string[] = (response.data.models ?? []).map((m: { name: string }) => m.name)
      const modelAvailable = models.some(m => m.startsWith(this.ollamaModel))

      return {
        healthy: modelAvailable,
        model: this.ollamaModel,
        error: modelAvailable ? undefined : `Model ${this.ollamaModel} not found. Available: ${models.join(', ')}`,
      }
    } catch (err) {
      return {
        healthy: false,
        model: this.ollamaModel,
        error: `Ollama not reachable at ${this.ollamaUrl}: ${(err as Error).message}`,
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildJobText(job: RawJob): string {
  // Prefer HTML content; fall back to JSON fields
  if (job.raw_html && job.raw_html.length > 200) {
    // Strip HTML tags for cleaner extraction
    return job.raw_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000)
  }

  const json = job.raw_json ?? {}
  const parts = [
    job.title ?? (json.title as string),
    job.company ?? (json.company as string),
    job.location ?? (json.location as string),
    (json.description as string) ?? (json.job_description as string) ?? '',
  ].filter(Boolean)

  return parts.join('\n').slice(0, 5000)
}

function parseExtractionResponse(text: string, method: ExtractionMethod): ExtractedJob {
  // Find JSON in response (handle cases where model wraps it in markdown)
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) ??
    text.match(/```\s*([\s\S]*?)```/) ??
    text.match(/(\{[\s\S]*\})/)

  if (!jsonMatch) throw new Error(`No JSON found in ${method} response`)

  const jsonStr = jsonMatch[1] ?? jsonMatch[0]
  const parsed = JSON.parse(jsonStr)

  return {
    title: String(parsed.title ?? 'Unknown Title'),
    company: String(parsed.company ?? 'Unknown Company'),
    location: String(parsed.location ?? ''),
    remote_type: validateRemoteType(parsed.remote_type),
    required_skills: Array.isArray(parsed.required_skills)
      ? parsed.required_skills.map(String).slice(0, 20)
      : [],
    experience_level: validateExperienceLevel(parsed.experience_level),
    employment_type: validateEmploymentType(parsed.employment_type),
    job_description_clean: String(parsed.job_description_clean ?? '').slice(0, 2000),
    salary_min: typeof parsed.salary_min === 'number' ? parsed.salary_min : null,
    salary_max: typeof parsed.salary_max === 'number' ? parsed.salary_max : null,
    currency: String(parsed.currency ?? 'USD'),
    confidence_score: Math.min(1, Math.max(0, Number(parsed.confidence_score ?? 0.75))),
    extraction_method: method,
  }
}

function buildFallbackExtraction(job: RawJob): ExtractedJob {
  return {
    title: job.title ?? 'Unknown Title',
    company: job.company ?? 'Unknown Company',
    location: job.location ?? '',
    remote_type: (job.remote_type as RemoteType) ?? 'unknown',
    required_skills: [],
    experience_level: 'unknown',
    employment_type: 'unknown',
    job_description_clean: '',
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    currency: 'USD',
    confidence_score: 0.3,
    extraction_method: 'fallback_manual',
  }
}

function validateRemoteType(val: unknown): RemoteType {
  const valid: RemoteType[] = ['remote', 'hybrid', 'onsite', 'unknown']
  return valid.includes(val as RemoteType) ? (val as RemoteType) : 'unknown'
}

function validateExperienceLevel(val: unknown): ExperienceLevel {
  const valid: ExperienceLevel[] = ['entry', 'mid', 'senior', 'executive', 'unknown']
  return valid.includes(val as ExperienceLevel) ? (val as ExperienceLevel) : 'unknown'
}

function validateEmploymentType(val: unknown): EmploymentType {
  const valid: EmploymentType[] = ['full-time', 'contract', 'part-time', 'intern', 'unknown']
  return valid.includes(val as EmploymentType) ? (val as EmploymentType) : 'unknown'
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// Singleton
export const jobExtractionService = new JobExtractionService()

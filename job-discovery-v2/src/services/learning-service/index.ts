// =============================================================================
// iCareerOS — Learning Service
// Layer 4 of the Job Discovery pipeline.
//
// Responsibility: Track extraction accuracy per source and automatically
// improve extraction prompts when accuracy degrades below 80%.
//
// How the feedback loop works:
//   1. User sees an extracted job and clicks "wrong skills" / "wrong level"
//   2. Frontend calls POST /api/feedback with their corrections
//   3. This service records it in extraction_feedback
//   4. Every 6 hours, it recalculates accuracy per source
//   5. If source accuracy < 80% for 10+ samples → auto-update prompt_override
//   6. Next extraction run uses the improved prompt
//
// Self-improving behavior:
//   - Prompts evolve based on real correction data
//   - Each source can have its own tuned extraction prompt
//   - Accuracy trend is tracked (7d vs 30d)
//
// Listens to: accuracy.degraded events
// Publishes:  (none — internal service)
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import axios from 'axios'

interface FeedbackInput {
  extractedJobId: string
  profileId: string
  isCorrect: boolean
  corrections?: {
    title?: string
    company?: string
    required_skills?: string[]
    experience_level?: string
    employment_type?: string
    remote_type?: string
    salary_min?: number | null
    salary_max?: number | null
  }
}

interface SourceAccuracyRow {
  id: string
  source: string
  accuracy_7d: number
  accuracy_30d: number
  total_extractions: number
  total_corrections: number
  last_retrain: string | null
  prompt_version: number
  prompt_override: string | null
}

export class LearningService {
  private supabase: SupabaseClient
  private ollamaUrl: string
  private ollamaModel: string

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[Learning] Missing Supabase credentials')

    this.supabase = createClient(url, key)
    this.ollamaUrl = process.env.OLLAMA_API_URL ?? 'http://localhost:11434'
    this.ollamaModel = process.env.OLLAMA_MODEL ?? 'mistral'
  }

  // ---------------------------------------------------------------------------
  // Record user feedback on an extraction
  // ---------------------------------------------------------------------------
  async recordFeedback(input: FeedbackInput): Promise<void> {
    const { data: extracted } = await this.supabase
      .from('extracted_jobs')
      .select('confidence_score, source')
      .eq('id', input.extractedJobId)
      .single()

    const { error } = await this.supabase.from('extraction_feedback').insert({
      extracted_job_id: input.extractedJobId,
      profile_id: input.profileId,
      is_correct: input.isCorrect,
      corrections: input.corrections ?? null,
      confidence_before: extracted?.confidence_score ?? null,
      feedback_at: new Date().toISOString(),
    })

    if (error) {
      console.error(`[Learning] recordFeedback failed:`, error.message)
      throw error
    }

    console.log(`[Learning] Feedback recorded for ${input.extractedJobId}: ${input.isCorrect ? '✓ correct' : '✗ wrong'}`)

    // If wrong, check if this source needs retraining
    if (!input.isCorrect && extracted?.source) {
      await this.checkAccuracyTrigger(extracted.source)
    }
  }

  // ---------------------------------------------------------------------------
  // Recalculate accuracy for all sources
  // Called by pg_cron at 06:00 UTC daily
  // ---------------------------------------------------------------------------
  async updateAllAccuracy(): Promise<void> {
    console.log(`[Learning] Recalculating accuracy for all sources`)

    const { data: sources } = await this.supabase
      .from('extraction_accuracy')
      .select('source')

    for (const { source } of sources ?? []) {
      await this.updateSourceAccuracy(source)
    }

    console.log(`[Learning] Accuracy update complete`)
  }

  // ---------------------------------------------------------------------------
  // Update accuracy for a single source
  // ---------------------------------------------------------------------------
  async updateSourceAccuracy(source: string): Promise<SourceAccuracyRow | null> {
    // Count feedback in last 7 days
    const { data: feedback7d } = await this.supabase
      .from('extraction_feedback')
      .select('is_correct')
      .gte('feedback_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .in('extracted_job_id',
        this.supabase.from('extracted_jobs').select('id').eq('source', source)
      )

    // Count feedback in last 30 days
    const { data: feedback30d } = await this.supabase
      .from('extraction_feedback')
      .select('is_correct')
      .gte('feedback_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .in('extracted_job_id',
        this.supabase.from('extracted_jobs').select('id').eq('source', source)
      )

    const calc7d = calcAccuracy(feedback7d ?? [])
    const calc30d = calcAccuracy(feedback30d ?? [])

    // Total extraction count
    const { count: totalExtractions } = await this.supabase
      .from('extracted_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('source', source)

    const { count: totalCorrections } = await this.supabase
      .from('extraction_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('is_correct', false)
      .in('extracted_job_id',
        this.supabase.from('extracted_jobs').select('id').eq('source', source)
      )

    const { data: updated, error } = await this.supabase
      .from('extraction_accuracy')
      .update({
        accuracy_7d: calc7d.accuracy,
        accuracy_30d: calc30d.accuracy,
        total_extractions: totalExtractions ?? 0,
        total_corrections: totalCorrections ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('source', source)
      .select('*')
      .single()

    if (error) {
      console.error(`[Learning] updateSourceAccuracy failed for ${source}:`, error.message)
      return null
    }

    const row = updated as SourceAccuracyRow

    // Auto-retrain if accuracy < 80% and we have enough samples
    if (row.accuracy_7d < 0.80 && (totalExtractions ?? 0) > 10) {
      console.warn(`[Learning] ⚠️ ${source} accuracy = ${(row.accuracy_7d * 100).toFixed(0)}% — triggering retrain`)
      await this.retrainPrompt(row)
    }

    return row
  }

  // ---------------------------------------------------------------------------
  // Auto-retrain: use Mistral to analyze errors and improve the prompt
  // ---------------------------------------------------------------------------
  private async retrainPrompt(sourceRow: SourceAccuracyRow): Promise<void> {
    const source = sourceRow.source

    // Get recent wrong extractions with corrections
    const { data: wrongExtractions } = await this.supabase
      .from('extraction_feedback')
      .select(`
        corrections,
        extracted_jobs!inner(source, title, company, required_skills, experience_level)
      `)
      .eq('is_correct', false)
      .gte('feedback_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(20)

    if (!wrongExtractions || wrongExtractions.length === 0) {
      console.log(`[Learning] No wrong extractions found for ${source} — skipping retrain`)
      return
    }

    // Ask Mistral to analyze the errors and suggest a prompt improvement
    const analysisPrompt = `You are improving a job extraction prompt for the "${source}" job board.

Here are recent extraction errors (model output vs correct values):
${wrongExtractions
  .slice(0, 10)
  .map((e, i) => `
Error ${i + 1}:
  Model extracted: ${JSON.stringify((e as any).extracted_jobs)}
  User corrected: ${JSON.stringify(e.corrections)}
`)
  .join('\n')}

Based on these errors, write a ONE PARAGRAPH instruction addition to fix these patterns.
Be specific about what the model is getting wrong for this source.
Return ONLY the instruction text, nothing else. Max 200 words.`

    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.ollamaModel,
          prompt: analysisPrompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 300 },
        },
        { timeout: 45_000 }
      )

      const promptAddition: string = response.data.response?.trim() ?? ''

      if (promptAddition.length > 20) {
        // Save the improved prompt as an override
        const newVersion = (sourceRow.prompt_version ?? 1) + 1

        await this.supabase
          .from('extraction_accuracy')
          .update({
            prompt_override: promptAddition,
            prompt_version: newVersion,
            last_retrain: new Date().toISOString(),
          })
          .eq('source', source)

        console.log(`[Learning] ✓ ${source} prompt updated to v${newVersion}`)
      }
    } catch (err) {
      console.error(`[Learning] Prompt retrain failed for ${source}:`, (err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Get prompt override for a source (called by Extraction Service)
  // ---------------------------------------------------------------------------
  async getPromptOverride(source: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('extraction_accuracy')
      .select('prompt_override')
      .eq('source', source)
      .single()

    return data?.prompt_override ?? null
  }

  // ---------------------------------------------------------------------------
  // Check if a source needs immediate retraining after new feedback
  // ---------------------------------------------------------------------------
  private async checkAccuracyTrigger(source: string): Promise<void> {
    // Only trigger if we have at least 5 recent feedbacks
    const { count } = await this.supabase
      .from('extraction_feedback')
      .select('*', { count: 'exact', head: true })
      .gte('feedback_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .in('extracted_job_id',
        this.supabase.from('extracted_jobs').select('id').eq('source', source)
      )

    if ((count ?? 0) >= 5) {
      await this.updateSourceAccuracy(source)
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard: accuracy report for all sources
  // ---------------------------------------------------------------------------
  async getAccuracyReport(): Promise<SourceAccuracyRow[]> {
    const { data, error } = await this.supabase
      .from('extraction_accuracy')
      .select('*')
      .order('accuracy_7d', { ascending: true })

    if (error) throw error
    return (data ?? []) as SourceAccuracyRow[]
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAccuracy(feedback: Array<{ is_correct: boolean }>): { accuracy: number; total: number } {
  if (feedback.length === 0) return { accuracy: 0.75, total: 0 }  // Assume 75% if no data
  const correct = feedback.filter(f => f.is_correct).length
  return { accuracy: correct / feedback.length, total: feedback.length }
}

// Singleton
export const learningService = new LearningService()

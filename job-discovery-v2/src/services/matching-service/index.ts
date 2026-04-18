// =============================================================================
// iCareerOS — Matching Service
// Layer 5 of the Job Discovery pipeline.
//
// Responsibility: Score every deduplicated job against every user profile.
// Builds on the existing relevance-scorer.ts logic (extended for the new schema).
//
// Scoring formula (0–100):
//   Skill match        30 pts  — required_skills ∩ profile.skills / required_skills.length
//   Experience match   25 pts  — entry/mid/senior/exec alignment
//   Remote preference  20 pts  — exact match on remote_type
//   Salary alignment   15 pts  — overlap between job range and user range
//   Location match     10 pts  — city/region match or remote willing
//
// Batch mode (overnight):
//   Score all deduplicated_jobs × all user_search_preferences
//   Saves to job_scores table
//   Triggers: batch.score_started event (pg_cron at 05:00 UTC)
//
// On-demand mode:
//   Score one job for one user (triggered by search or new job alert)
//
// Publishes: job.scored events
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { eventBus } from '../../shared/services/event-bus'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  target_titles: string[]
  target_skills: string[]
  remote_preference: 'remote' | 'hybrid' | 'onsite' | 'any'
  salary_min: number | null
  salary_max: number | null
  preferred_locations: string[]
  experience_level: string | null
}

interface DeduplicatedJobWithExtraction {
  id: string
  title: string
  company: string
  location: string | null
  source_count: number
  // From extracted_jobs via join
  remote_type: string | null
  required_skills: string[]
  experience_level: string | null
  salary_min: number | null
  salary_max: number | null
  job_description_clean: string | null
}

export interface ScoreResult {
  fit_score: number
  skill_match_pct: number
  experience_match_pct: number
  location_match_pct: number
  salary_match_pct: number
  fit_reasoning: string
}

// ── Main Service ──────────────────────────────────────────────────────────────

export class MatchingService {
  private supabase: SupabaseClient

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[Matching] Missing Supabase credentials')
    this.supabase = createClient(url, key)
  }

  // ---------------------------------------------------------------------------
  // Batch: score all unscored deduplicated_jobs for all users
  // ---------------------------------------------------------------------------
  async scoreBatch(limit = 500): Promise<{ scored: number; skipped: number; failed: number }> {
    console.log(`[Matching] Starting batch scoring (limit: ${limit})`)

    // Get all active user profiles
    const { data: profiles, error: profileError } = await this.supabase
      .from('user_search_preferences')
      .select('user_id, target_titles, target_skills, remote_preference, salary_min, salary_max, preferred_locations, experience_level')

    if (profileError) throw profileError
    const userProfiles = (profiles ?? []) as Array<{
      user_id: string;
      target_titles: string[];
      target_skills: string[];
      remote_preference: string;
      salary_min: number | null;
      salary_max: number | null;
      preferred_locations: string[];
      experience_level: string | null;
    }>

    if (userProfiles.length === 0) {
      console.log(`[Matching] No user profiles found — skipping`)
      return { scored: 0, skipped: 0, failed: 0 }
    }

    // Get recent deduplicated jobs not yet scored for any user
    const { data: jobs, error: jobError } = await this.supabase
      .from('deduplicated_jobs')
      .select(`
        id, title, company, location, source_count,
        extracted_jobs!inner(remote_type, required_skills, experience_level, salary_min, salary_max, job_description_clean)
      `)
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)

    if (jobError) throw jobError

    const jobRows = (jobs ?? []).map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      source_count: j.source_count,
      remote_type: (j as any).extracted_jobs?.remote_type ?? null,
      required_skills: (j as any).extracted_jobs?.required_skills ?? [],
      experience_level: (j as any).extracted_jobs?.experience_level ?? null,
      salary_min: (j as any).extracted_jobs?.salary_min ?? null,
      salary_max: (j as any).extracted_jobs?.salary_max ?? null,
      job_description_clean: (j as any).extracted_jobs?.job_description_clean ?? null,
    })) as DeduplicatedJobWithExtraction[]

    console.log(`[Matching] Scoring ${jobRows.length} jobs × ${userProfiles.length} profiles`)

    let scored = 0, skipped = 0, failed = 0
    const eventsToPublish: Array<{ event_type: string; payload: Record<string, unknown> }> = []

    for (const profile of userProfiles) {
      const userProfile: UserProfile = {
        id: profile.user_id,
        target_titles: profile.target_titles ?? [],
        target_skills: profile.target_skills ?? [],
        remote_preference: (profile.remote_preference ?? 'any') as UserProfile['remote_preference'],
        salary_min: profile.salary_min,
        salary_max: profile.salary_max,
        preferred_locations: profile.preferred_locations ?? [],
        experience_level: profile.experience_level,
      }

      const scoreBatch: Array<{
        deduplicated_job_id: string
        profile_id: string
        skill_match_pct: number
        experience_match_pct: number
        location_match_pct: number
        salary_match_pct: number
        fit_score: number
        fit_reasoning: string
        scored_at: string
      }> = []

      for (const job of jobRows) {
        try {
          const result = this.scoreJob(job, userProfile)

          // Skip very low scores to save storage
          if (result.fit_score < 20) { skipped++; continue }

          scoreBatch.push({
            deduplicated_job_id: job.id,
            profile_id: profile.user_id,
            skill_match_pct: result.skill_match_pct,
            experience_match_pct: result.experience_match_pct,
            location_match_pct: result.location_match_pct,
            salary_match_pct: result.salary_match_pct,
            fit_score: result.fit_score,
            fit_reasoning: result.fit_reasoning,
            scored_at: new Date().toISOString(),
          })
        } catch (err) {
          failed++
        }
      }

      // Upsert scores for this user in one batch
      if (scoreBatch.length > 0) {
        const { error: upsertError } = await this.supabase
          .from('job_scores')
          .upsert(scoreBatch, { onConflict: 'deduplicated_job_id,profile_id' })

        if (upsertError) {
          console.error(`[Matching] Upsert failed for user ${profile.user_id}:`, upsertError.message)
          failed += scoreBatch.length
        } else {
          scored += scoreBatch.length
          eventsToPublish.push({
            event_type: 'job.scored',
            payload: {
              profile_id: profile.user_id,
              jobs_scored: scoreBatch.length,
              top_score: Math.max(...scoreBatch.map(s => s.fit_score)),
            },
          })
        }
      }
    }

    if (eventsToPublish.length > 0) {
      await eventBus.publishBatch(eventsToPublish)
    }

    console.log(`[Matching] Done: ${scored} scored, ${skipped} skipped, ${failed} failed`)
    return { scored, skipped, failed }
  }

  // ---------------------------------------------------------------------------
  // Score a single job for a single user (on-demand)
  // ---------------------------------------------------------------------------
  async scoreJobForUser(dedupJobId: string, userId: string): Promise<ScoreResult> {
    const [jobResult, profileResult] = await Promise.all([
      this.supabase
        .from('deduplicated_jobs')
        .select(`id, title, company, location, source_count, extracted_jobs!inner(remote_type, required_skills, experience_level, salary_min, salary_max, job_description_clean)`)
        .eq('id', dedupJobId)
        .single(),
      this.supabase
        .from('user_search_preferences')
        .select('user_id, target_titles, target_skills, remote_preference, salary_min, salary_max, preferred_locations, experience_level')
        .eq('user_id', userId)
        .single(),
    ])

    if (jobResult.error || !jobResult.data) throw new Error(`Job not found: ${dedupJobId}`)
    if (profileResult.error || !profileResult.data) throw new Error(`Profile not found: ${userId}`)

    const j = jobResult.data as any
    const job: DeduplicatedJobWithExtraction = {
      id: j.id, title: j.title, company: j.company, location: j.location,
      source_count: j.source_count,
      remote_type: j.extracted_jobs?.remote_type,
      required_skills: j.extracted_jobs?.required_skills ?? [],
      experience_level: j.extracted_jobs?.experience_level,
      salary_min: j.extracted_jobs?.salary_min,
      salary_max: j.extracted_jobs?.salary_max,
      job_description_clean: j.extracted_jobs?.job_description_clean,
    }

    const p = profileResult.data as any
    const profile: UserProfile = {
      id: userId,
      target_titles: p.target_titles ?? [],
      target_skills: p.target_skills ?? [],
      remote_preference: p.remote_preference ?? 'any',
      salary_min: p.salary_min,
      salary_max: p.salary_max,
      preferred_locations: p.preferred_locations ?? [],
      experience_level: p.experience_level,
    }

    return this.scoreJob(job, profile)
  }

  // ---------------------------------------------------------------------------
  // Core scoring algorithm
  // ---------------------------------------------------------------------------
  scoreJob(job: DeduplicatedJobWithExtraction, profile: UserProfile): ScoreResult {
    const reasons: string[] = []

    // ── 1. Skill match (30 pts) ─────────────────────────────────────────────
    const skillMatch = calcSkillMatch(job.required_skills, profile.target_skills)
    const skillPts = Math.round(30 * skillMatch)
    if (skillPts >= 20) reasons.push(`strong skills match (${Math.round(skillMatch * 100)}%)`)
    else if (skillPts > 0) reasons.push(`partial skills match (${Math.round(skillMatch * 100)}%)`)
    else reasons.push('skills gap')

    // ── 2. Experience match (25 pts) ────────────────────────────────────────
    const expMatch = calcExperienceMatch(job.experience_level, profile.experience_level)
    const expPts = Math.round(25 * expMatch)
    if (expPts >= 20) reasons.push('experience level aligned')
    else if (expPts > 0) reasons.push('experience partially aligned')

    // ── 3. Remote preference (20 pts) ──────────────────────────────────────
    const remoteMatch = calcRemoteMatch(job.remote_type, profile.remote_preference)
    const remotePts = Math.round(20 * remoteMatch)
    if (remotePts >= 15) reasons.push(`${job.remote_type ?? 'unknown'} matches preference`)

    // ── 4. Salary alignment (15 pts) ────────────────────────────────────────
    const salaryMatch = calcSalaryMatch(job.salary_min, job.salary_max, profile.salary_min, profile.salary_max)
    const salaryPts = Math.round(15 * salaryMatch)
    if (salaryPts >= 10) reasons.push('salary in range')
    else if (salaryPts === 0 && (profile.salary_min || profile.salary_max)) reasons.push('salary unknown/out of range')

    // ── 5. Location match (10 pts) ──────────────────────────────────────────
    const locationMatch = calcLocationMatch(job.location, profile.preferred_locations, job.remote_type)
    const locationPts = Math.round(10 * locationMatch)
    if (locationPts >= 8) reasons.push('preferred location')

    // ── Multi-source bonus (+5 if seen on 3+ platforms) ─────────────────────
    const multiSourceBonus = job.source_count >= 3 ? 5 : job.source_count >= 2 ? 2 : 0
    if (multiSourceBonus > 0) reasons.push(`verified across ${job.source_count} platforms`)

    const fitScore = Math.min(100, skillPts + expPts + remotePts + salaryPts + locationPts + multiSourceBonus)

    return {
      fit_score: fitScore,
      skill_match_pct: Math.round(skillMatch * 100),
      experience_match_pct: Math.round(expMatch * 100),
      location_match_pct: Math.round(locationMatch * 100),
      salary_match_pct: Math.round(salaryMatch * 100),
      fit_reasoning: `${fitScore}/100 — ${reasons.join(', ')}`,
    }
  }
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function calcSkillMatch(jobSkills: string[], userSkills: string[]): number {
  if (!jobSkills?.length || !userSkills?.length) return 0.5  // Neutral when no data
  const userSet = new Set(userSkills.map(s => s.toLowerCase()))
  const matched = jobSkills.filter(s => userSet.has(s.toLowerCase())).length
  return matched / jobSkills.length
}

function calcExperienceMatch(jobLevel: string | null, userLevel: string | null): number {
  if (!jobLevel || jobLevel === 'unknown' || !userLevel) return 0.7  // Neutral

  const levels: Record<string, number> = { entry: 1, mid: 2, senior: 3, executive: 4 }
  const jobNum = levels[jobLevel] ?? 2
  const userNum = levels[userLevel] ?? 2
  const diff = Math.abs(jobNum - userNum)

  if (diff === 0) return 1.0   // Exact match
  if (diff === 1) return 0.6   // One level off
  return 0.2                   // Two+ levels off
}

function calcRemoteMatch(jobRemote: string | null, userPref: string): number {
  if (userPref === 'any') return 0.8
  if (!jobRemote || jobRemote === 'unknown') return 0.5

  if (jobRemote === userPref) return 1.0
  if (jobRemote === 'hybrid' && userPref === 'remote') return 0.6
  if (jobRemote === 'hybrid' && userPref === 'onsite') return 0.6
  return 0.1  // Mismatch
}

function calcSalaryMatch(
  jobMin: number | null, jobMax: number | null,
  userMin: number | null, userMax: number | null
): number {
  if ((!jobMin && !jobMax) || (!userMin && !userMax)) return 0.6  // Neutral when unknown

  const jMin = jobMin ?? 0
  const jMax = jobMax ?? jMin * 1.3
  const uMin = userMin ?? 0
  const uMax = userMax ?? uMin * 1.3

  // Full overlap
  if (jMin <= uMax && jMax >= uMin) {
    const overlapMin = Math.max(jMin, uMin)
    const overlapMax = Math.min(jMax, uMax)
    const overlap = overlapMax - overlapMin
    const userRange = uMax - uMin || uMin
    return Math.min(1, overlap / (userRange || 1))
  }

  // Job pays more than user wants — still ok
  if (jMin > uMax) return 0.8

  // Job pays less than user minimum
  return 0.1
}

function calcLocationMatch(
  jobLocation: string | null,
  preferredLocations: string[],
  remoteType: string | null
): number {
  if (remoteType === 'remote') return 1.0  // Remote jobs match any location preference
  if (!jobLocation || !preferredLocations?.length) return 0.5

  const jobLoc = jobLocation.toLowerCase()
  for (const pref of preferredLocations) {
    if (jobLoc.includes(pref.toLowerCase()) || pref.toLowerCase().includes(jobLoc)) {
      return 1.0
    }
  }
  return 0.1
}

// Singleton
export const matchingService = new MatchingService()

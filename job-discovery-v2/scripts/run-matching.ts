#!/usr/bin/env bun
// =============================================================================
// iCareerOS — Matching Batch Runner
// Repo path: src/job-discovery-v2/scripts/run-matching.ts
//
// Called by: .github/workflows/job-matcher.yml (nightly 05:00 UTC)
// Also callable manually: bun run scripts/run-matching.ts
//
// Flow:
//   1. Fetch all active user_search_preferences
//   2. Fetch recent deduplicated_jobs (last 48h) with extracted data
//   3. Score each job × each user (5-factor formula)
//   4. Upsert results to job_scores table (skip scores < 20)
//   5. Publish job.scored events per user
//   6. Report total scored, top scores
// =============================================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const LIMIT = parseInt(process.env.MATCHING_LIMIT ?? '1000', 10)

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  user_id: string
  target_titles: string[]
  target_skills: string[]
  remote_preference: string
  salary_min: number | null
  salary_max: number | null
  preferred_locations: string[]
  experience_level: string | null
}

interface JobRow {
  id: string
  title: string
  company: string
  location: string | null
  source_count: number
  remote_type: string | null
  required_skills: string[]
  experience_level: string | null
  salary_min: number | null
  salary_max: number | null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Matcher] Starting — job limit: ${LIMIT}`)

  // 1. Fetch user profiles
  const { data: profiles, error: pErr } = await supabase
    .from('user_search_preferences')
    .select('user_id, target_titles, target_skills, remote_preference, salary_min, salary_max, preferred_locations, experience_level')

  if (pErr) { console.error('❌ Failed to fetch profiles:', pErr.message); process.exit(1) }

  const userProfiles = (profiles ?? []) as UserProfile[]
  if (userProfiles.length === 0) {
    console.log('[Matcher] No user profiles found — nothing to score')
    process.exit(0)
  }
  console.log(`[Matcher] ${userProfiles.length} user profiles`)

  // 2. Fetch recent deduplicated jobs with extraction data
  const { data: jobs, error: jErr } = await supabase
    .from('deduplicated_jobs')
    .select(`
      id, title, company, location, source_count,
      extracted_jobs!inner(remote_type, required_skills, experience_level, salary_min, salary_max)
    `)
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (jErr) { console.error('❌ Failed to fetch jobs:', jErr.message); process.exit(1) }

  const jobRows: JobRow[] = (jobs ?? []).map((j: any) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    source_count: j.source_count,
    remote_type: j.extracted_jobs?.remote_type ?? null,
    required_skills: j.extracted_jobs?.required_skills ?? [],
    experience_level: j.extracted_jobs?.experience_level ?? null,
    salary_min: j.extracted_jobs?.salary_min ?? null,
    salary_max: j.extracted_jobs?.salary_max ?? null,
  }))

  console.log(`[Matcher] ${jobRows.length} jobs × ${userProfiles.length} users = ${jobRows.length * userProfiles.length} pairs`)

  // 3. Score all combinations
  let totalScored = 0, totalSkipped = 0, totalFailed = 0
  const startTime = Date.now()

  for (const profile of userProfiles) {
    const scoreBatch: any[] = []

    for (const job of jobRows) {
      const result = scoreJob(job, profile)
      if (result.fit_score < 20) { totalSkipped++; continue }

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
    }

    if (scoreBatch.length === 0) continue

    // Upsert in chunks of 200
    for (const chunk of chunks(scoreBatch, 200)) {
      const { error } = await supabase
        .from('job_scores')
        .upsert(chunk, { onConflict: 'deduplicated_job_id,profile_id' })

      if (error) { totalFailed += chunk.length; console.error(`  Upsert error:`, error.message) }
      else totalScored += chunk.length
    }

    // Publish event for this user
    const topScore = Math.max(...scoreBatch.map(s => s.fit_score))
    await supabase.from('platform_events').insert({
      event_type: 'job.scored',
      payload: { profile_id: profile.user_id, jobs_scored: scoreBatch.length, top_score: topScore },
    })
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n[Matcher] ✅ Done in ${elapsed}s`)
  console.log(`  Scored:   ${totalScored}`)
  console.log(`  Skipped:  ${totalSkipped} (score < 20)`)
  console.log(`  Failed:   ${totalFailed}`)
}

// ── Scoring algorithm (mirrors matching-service/index.ts) ─────────────────────

function scoreJob(job: JobRow, profile: UserProfile): {
  fit_score: number; skill_match_pct: number; experience_match_pct: number;
  location_match_pct: number; salary_match_pct: number; fit_reasoning: string
} {
  const reasons: string[] = []

  // Skills (30 pts)
  const skillMatch = calcSkillMatch(job.required_skills, profile.target_skills)
  const skillPts = Math.round(30 * skillMatch)
  if (skillPts >= 20) reasons.push(`strong skills (${Math.round(skillMatch * 100)}%)`)
  else if (skillPts > 0) reasons.push(`partial skills (${Math.round(skillMatch * 100)}%)`)

  // Experience (25 pts)
  const expMatch = calcExpMatch(job.experience_level, profile.experience_level)
  const expPts = Math.round(25 * expMatch)
  if (expPts >= 20) reasons.push('exp aligned')

  // Remote (20 pts)
  const remoteMatch = calcRemoteMatch(job.remote_type, profile.remote_preference)
  const remotePts = Math.round(20 * remoteMatch)
  if (remotePts >= 15) reasons.push(`${job.remote_type ?? 'unknown'}`)

  // Salary (15 pts)
  const salaryMatch = calcSalaryMatch(job.salary_min, job.salary_max, profile.salary_min, profile.salary_max)
  const salaryPts = Math.round(15 * salaryMatch)
  if (salaryPts >= 10) reasons.push('salary ok')

  // Location (10 pts)
  const locMatch = calcLocMatch(job.location, profile.preferred_locations, job.remote_type)
  const locPts = Math.round(10 * locMatch)
  if (locPts >= 8) reasons.push('location match')

  // Multi-source bonus
  const bonus = job.source_count >= 3 ? 5 : job.source_count >= 2 ? 2 : 0
  if (bonus) reasons.push(`${job.source_count} sources`)

  const fit_score = Math.min(100, skillPts + expPts + remotePts + salaryPts + locPts + bonus)

  return {
    fit_score,
    skill_match_pct: Math.round(skillMatch * 100),
    experience_match_pct: Math.round(expMatch * 100),
    location_match_pct: Math.round(locMatch * 100),
    salary_match_pct: Math.round(salaryMatch * 100),
    fit_reasoning: `${fit_score}/100 — ${reasons.join(', ')}`,
  }
}

function calcSkillMatch(jobSkills: string[], userSkills: string[]): number {
  if (!jobSkills?.length || !userSkills?.length) return 0.5
  const s = new Set(userSkills.map(x => x.toLowerCase()))
  return jobSkills.filter(x => s.has(x.toLowerCase())).length / jobSkills.length
}

function calcExpMatch(jobLevel: string | null, userLevel: string | null): number {
  if (!jobLevel || jobLevel === 'unknown' || !userLevel) return 0.7
  const l: Record<string, number> = { entry: 1, mid: 2, senior: 3, executive: 4 }
  const diff = Math.abs((l[jobLevel] ?? 2) - (l[userLevel] ?? 2))
  return diff === 0 ? 1 : diff === 1 ? 0.6 : 0.2
}

function calcRemoteMatch(jobRemote: string | null, userPref: string): number {
  if (userPref === 'any') return 0.8
  if (!jobRemote || jobRemote === 'unknown') return 0.5
  if (jobRemote === userPref) return 1
  if (jobRemote === 'hybrid') return 0.6
  return 0.1
}

function calcSalaryMatch(jMin: number | null, jMax: number | null, uMin: number | null, uMax: number | null): number {
  if ((!jMin && !jMax) || (!uMin && !uMax)) return 0.6
  const jLo = jMin ?? 0, jHi = jMax ?? (jMin! * 1.3)
  const uLo = uMin ?? 0, uHi = uMax ?? (uMin! * 1.3)
  if (jLo <= uHi && jHi >= uLo) {
    const overlap = Math.min(jHi, uHi) - Math.max(jLo, uLo)
    return Math.min(1, overlap / ((uHi - uLo) || uLo))
  }
  return jLo > uHi ? 0.8 : 0.1
}

function calcLocMatch(loc: string | null, prefs: string[], remote: string | null): number {
  if (remote === 'remote') return 1
  if (!loc || !prefs?.length) return 0.5
  return prefs.some(p => loc.toLowerCase().includes(p.toLowerCase())) ? 1 : 0.1
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

main().catch(err => {
  console.error('❌ Matching runner crashed:', err)
  process.exit(1)
})



# Build Plan: Complete the AI Career OS (Remaining Gaps)

Your platform is ~85% complete. Here are the 4 remaining phases, ordered by impact and complexity.

---

## Phase 1 — Core Polish (No backend changes)

**Application Timeline View**
- Add a "Timeline" tab to `/applications` showing a vertical chronological view of all application events (applied, status changes, follow-ups)
- Uses existing `job_applications` data — no new tables

**Before/After Resume Comparison**
- New `ResumeComparison` component using existing `diffUtils.ts` to show side-by-side original vs. optimized resume
- Add to JobSeeker page after AI resume generation with an "improvement score" (% changes)

**Skill Gap Action Steps**
- Enhance `CareerPathIntelligence` to convert each gap into a specific action step, resource type (course/cert/project), and estimated timeline
- Extend the `career-path-analysis` edge function prompt — no new function needed

**Effort**: 2 components, 2 modified components, 0 migrations

---

## Phase 2 — Salary & Career Intelligence

**Salary Projection System**
- New `SalaryProjection` component on Career Dashboard with a line chart (recharts) showing 1/3/5-year salary projections
- New `salary-projection` edge function using Lovable AI to generate market-realistic projections based on user profile

**Progress Metrics Dashboard**
- New `ProgressMetrics` component showing: applications this month vs last, average fit score trend, interview conversion rate
- Pulls from existing `job_applications` and `analysis_history` tables

**Effort**: 2 components, 1 edge function, 0 migrations

---

## Phase 3 — Export & Personal Brand

**Profile PDF Export**
- Add "Download as PDF" button on Profile and PublicProfile pages using jsPDF
- Exports name, summary, skills, experience, and portfolio items

**Shareable Score Reports**
- New `/report/:analysisId` public route rendering a read-only score card (fit score, matched skills, improvements)
- Migration: Add public SELECT RLS policy on `analysis_history` for limited fields only (no resume text)
- "Share Report" button with copy-to-clipboard

**Combined Resume + Portfolio View**
- Merge resume summary with portfolio on PublicProfile into a unified professional view

**Effort**: 2 components, 1 route, 1 migration (RLS policy)

---

## Phase 4 — Growth & Acquisition Engine

**Referral System**
- New `referrals` table with RLS, unique referral codes per user, tracking dashboard on Profile page
- Reward: unlock features after 3 successful referrals

**Onboarding Funnel**
- Modify homepage demo to capture email after showing score → "Get your full report" → signup → profile setup → first match

**Email Alert System**
- New `email_preferences` table, settings UI for daily job alerts and weekly insights
- Two edge functions: `send-job-alerts` (matches new jobs to profile) and `send-weekly-insights` (improvement tips)

**Re-engagement System**
- Add `last_active_at` column to `job_seeker_profiles`
- Edge function `re-engagement` to email users inactive >7 days

**Effort**: 3 components, 3 edge functions, 3 migrations (2 new tables + 1 alter)

---

## Summary

| Phase | Components | Edge Functions | Migrations | Sessions |
|-------|-----------|---------------|------------|----------|
| 1 — Polish | 2 new, 2 modified | 0 | 0 | 1–2 |
| 2 — Intelligence | 2 new | 1 | 0 | 1–2 |
| 3 — Export | 2 new + 1 route | 0 | 1 | 1–2 |
| 4 — Growth | 3 new | 3 | 3 | 2–3 |

**Total remaining**: 9 components, 4 edge functions, 1 route, 4 migrations


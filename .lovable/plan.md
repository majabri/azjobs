
# MASTER ROADMAP — From Tool → AI Career OS

## Competitive Analysis Summary

| Feature | FitCheck (Current) | Indeed | LinkedIn | ZipRecruiter | Glassdoor | Hired |
|---|---|---|---|---|---|---|
| AI Job Matching | ✅ | ❌ | ❌ | Partial | ❌ | ✅ |
| Resume Optimization per Job | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Fit Score + Interview Probability | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Auto-Apply Agent | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Application Tracker (Kanban) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Career Roadmap AI | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mock Interview Simulation | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Outreach Generator + Tracker | ✅ | ❌ | Partial | ❌ | ❌ | ❌ |
| Public Profile + Portfolio | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Decision Engine (composite score) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Learning Feedback Loop | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Salary Projection System | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Timeline View for Applications | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Before/After Resume Comparison | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Resume Export as PDF | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Referral / Growth Engine | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Email Alerts System | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Skill Gap → Action Steps | Partial | ❌ | ✅ | ❌ | ❌ | ❌ |

## What Already Exists (DO NOT REBUILD)

- ✅ **Application Tracking**: Kanban board with drag-and-drop, status columns (Applied/Interview/Offer/Rejected), follow-up reminders, follow-up email generator
- ✅ **Feedback & Learning Loop**: FeedbackCollector with outcome tracking (outcome_detail, interview_stage, response_days), LearningInsights edge function correlating scores with outcomes
- ✅ **Job Decision Engine**: Composite Decision Score (fit 40% + probability 30% + effort 30%), smart tags (High Chance, Apply Fast, Low ROI, Improve Resume First), sorting by decision score
- ✅ **Interview Probability Model**: calculateResponseProbability() using quality score, job age, skills match, remote factor
- ✅ **Career Dashboard**: /career page with goals, salary targets, AI roadmap generator, score trend charts
- ✅ **Mock Interview System**: /interview-prep with streaming chat simulation, answer feedback, readiness scoring, session saving
- ✅ **Outreach Generator + Tracker**: AI outreach messages (cold/warm/informational), contact tracking with response status
- ✅ **Recruiter Assistant**: Draft replies to recruiter messages
- ✅ **Portfolio + Public Profile**: /profile portfolio editor, /p/:userId public page with shareable link
- ✅ **Job Scraping Engine**: ATS scraping (Greenhouse/Lever), Firecrawl integration, quality scoring, fake job flagging
- ✅ **Auto-Apply Agent**: Automated review → analyze → generate → track pipeline
- ✅ **Resume Versioning**: Multiple resume versions, save optimized resumes
- ✅ **Homepage**: Social proof stats, interactive demo (paste JD → get score), comparison table, feature showcase

---

## What Needs to Be Built (Gaps)

### PHASE 1 — CORE COMPLETION (Polish & Missing Pieces)
**Goal**: Fill small gaps in existing systems to reach production-grade quality

**1a. Application Timeline View**
- Add a "Timeline" tab to /applications alongside existing Kanban/List views
- Chronological visualization: vertical timeline showing application events (applied, status changes, follow-ups) with timestamps
- Pull from job_applications table using applied_at, updated_at, follow_up_date fields
- No new tables needed

**1b. Before/After Resume Comparison**
- New component `ResumeComparison` showing side-by-side diff of original vs. optimized resume
- Use existing `diffUtils.ts` library already in codebase
- Add to JobSeeker page after AI resume generation
- Include "improvement score" showing % of changes made

**1c. Skill Gap Action System Enhancement**
- Extend existing CareerPathIntelligence component to convert each gap into:
  - Specific action step (e.g., "Complete AWS Solutions Architect cert")
  - Suggested learning resource type (course, project, certification)
  - Estimated timeline (weeks/months)
- Use existing career-path-analysis edge function, just enhance the prompt to return structured action items

**Migration**: None needed
**New components**: 2 (TimelineView, ResumeComparison)
**Modified components**: 2 (Applications.tsx, CareerPathIntelligence)

---

### PHASE 2 — SALARY & CAREER INTELLIGENCE
**Goal**: Add salary projection to compete with Glassdoor/LinkedIn salary insights

**2a. Salary Projection System**
- New component `SalaryProjection` on Career Dashboard
- Create edge function `salary-projection` that analyzes:
  - User's current career level, skills, location
  - Target roles and their typical salary ranges
  - Projected salary growth over 1, 3, 5 years with milestones
- Visualize as a line chart using recharts (already installed)
- Use Lovable AI to generate market-realistic projections

**2b. Progress Tracking Dashboard**
- Add metrics cards to Career Dashboard showing:
  - Applications this month vs. last month
  - Average fit score trend
  - Interview conversion rate (interviews / applications)
  - Score improvement over time
- Pull from existing job_applications and analysis_history tables

**Migration**: None needed
**New edge functions**: 1 (salary-projection)
**New components**: 2 (SalaryProjection, ProgressMetrics)

---

### PHASE 3 — EXPORT & PERSONAL BRAND
**Goal**: Enable shareable/downloadable outputs for viral distribution

**3a. Profile Export as PDF**
- Generate downloadable PDF from public profile data (name, summary, skills, experience, portfolio)
- Use existing jsPDF library (already installed)
- Add "Download as PDF" button on Profile and PublicProfile pages

**3b. Shareable Score Reports**
- After analysis, generate a shareable report card (fit score, matched skills, top improvements)
- Create a public route `/report/:analysisId` that renders a read-only score card
- Add "Share Report" button with copy-to-clipboard link
- Add RLS policy for public SELECT on specific analysis_history fields (score, skills, job_title — NOT resume text)

**3c. Resume + Portfolio Combined View**
- On PublicProfile, merge resume summary with portfolio items into a single professional view
- Add "Download Full Profile" button that exports everything as PDF

**Migration**: 1 (add public read policy for analysis_history limited fields)
**New components**: 2 (ScoreReport page, ProfilePDFExport)
**New routes**: 1 (/report/:analysisId)

---

### PHASE 4 — GROWTH & ACQUISITION ENGINE
**Goal**: Build viral loops and re-engagement to steal users from other platforms

**4a. Referral System**
- Migration: Create `referrals` table (id, referrer_id, referred_email, referred_user_id, status, reward_claimed, created_at)
- Generate unique referral codes per user
- Track signups from referral links
- Display referral dashboard on Profile page showing invites sent, signups, rewards
- Reward: unlock premium features or badge after 3 successful referrals

**4b. Onboarding Funnel Optimization**
- Modify homepage interactive demo to capture email after showing score
- Add "Get your full report" CTA that leads to signup
- Post-signup: immediately redirect to profile setup → job search → first match

**4c. Email Alert System (Database + Edge Function)**
- Migration: Create `email_preferences` table (id, user_id, daily_job_alerts boolean, weekly_insights boolean, created_at)
- Edge function `send-job-alerts` that:
  - Queries user preferences
  - Finds new scraped_jobs matching user profile
  - Sends digest email via Supabase Auth email or a transactional email service
- Edge function `send-weekly-insights` for improvement tips based on learning-insights data
- Settings page for email preferences

**4d. Re-engagement System**
- Track last_active_at on job_seeker_profiles (add column via migration)
- Edge function `re-engagement` that identifies users inactive >7 days
- Send "You have X new job matches" email to bring them back

**Migration**: 3 (referrals table, email_preferences table, add last_active_at column)
**New edge functions**: 3 (send-job-alerts, send-weekly-insights, re-engagement)
**New components**: 3 (ReferralDashboard, EmailPreferences, OnboardingCapture)

---

## Technical Summary

| Phase | New Tables | New Edge Functions | New Components | New Routes |
|-------|-----------|-------------------|----------------|------------|
| 1 | 0 | 0 | 2 | 0 |
| 2 | 0 | 1 | 2 | 0 |
| 3 | 0 (1 RLS change) | 0 | 2 | 1 |
| 4 | 2 + 1 alter | 3 | 3 | 0 |

**Total new work**: 2 new tables, 4 new edge functions, 9 new components, 1 new route, 4 migrations

## Build Priority Order

1. **Phase 1** (1-2 sessions) — Highest ROI: polishes existing features, no backend changes
2. **Phase 2** (1-2 sessions) — Adds unique differentiator (salary projection), uses existing data
3. **Phase 3** (1-2 sessions) — Enables virality through shareable outputs
4. **Phase 4** (2-3 sessions) — Growth engine, requires email infrastructure setup

## What's Already Complete (From Previous Builds)

These map to the user's original 8-phase plan:
- Phase 1 (Core Tracking) → ✅ 90% done (timeline view missing)
- Phase 2 (Intelligence) → ✅ 85% done (before/after comparison, skill gap actions missing)
- Phase 3 (Network + Recruiter) → ✅ 100% done
- Phase 4 (Interview System) → ✅ 100% done
- Phase 5 (Career OS) → ✅ 80% done (salary projection missing)
- Phase 6 (Portfolio + Brand) → ✅ 85% done (PDF export, shareable reports missing)
- Phase 7 (Trust + Quality) → ✅ 100% done
- Phase 8 (Growth Engine) → ❌ 0% done (referrals, emails, re-engagement all missing)

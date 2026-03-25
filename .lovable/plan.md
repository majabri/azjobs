
# Build Plan: Remaining AI Career OS Features

Everything below was requested in the "Finalize and optimize" message but not yet implemented.

---

## Phase 1 — UX Trust Layer: Before/After Quantification

**Application Timeline with Impact Metrics**
- Refine `ApplicationTimeline` to show before/after improvement data per application: original score → optimized score, interview probability delta
- Pull from `analysis_history` matched by job title/company to correlate with `job_applications`

**Resume Comparison with Quantified Impact**
- Enhance `ResumeComparison` to display an "Improvement Score" banner showing: keywords added, ATS compatibility increase, and estimated interview probability change
- Already uses `diffUtils.ts` — add a summary metrics header

**Effort**: 2 component updates, 0 migrations

---

## Phase 2 — Distribution Engine: Viral Sharing

**Enhanced PDF Career Report Card**
- Upgrade `ProfilePdfExport` to include Career ROI Score, fit score history chart, top skills, salary delta, and improvement plan
- Brand it as "FitCheck Career Report Card" with consistent styling

**Public Profile OG Enhancements**
- Add dynamic OG meta tags to `/p/:userId` (PublicProfile) with user's headline, skill count, and portfolio summary
- Add JSON-LD structured data (Person schema) for SEO

**Share-to-LinkedIn / Twitter CTAs**
- Add social share buttons to ScoreReport and PublicProfile with pre-filled share text

**Effort**: 2 component updates, 1 new utility, 0 migrations

---

## Phase 3 — Integration Points Across Pages

**Job Match Screen: Salary Competitiveness**
- ✅ Already done — salary badges on `/job-search`

**Interview Stage: Expected Offer Range**
- Add an "Expected Offer Range" card to `/interview-prep` that uses the user's target role + location to show estimated salary range from the benchmarking engine
- Calls existing `negotiation-strategy` edge function with `action: "benchmark"`

**Offer Stage: Auto-Activate Negotiation**
- When a `job_application` status changes to "offer", auto-prompt the user to save it as an offer and launch the negotiation engine
- Add a banner in `/applications` for apps in "offer" status linking to `/offers`

**Effort**: 2 component updates, 0 new edge functions

---

## Phase 4 — Agent System Hardening

**Already Complete:**
- ✅ Retry logic with exponential backoff
- ✅ Per-agent timing metrics (`agent_timings`)
- ✅ Background scheduling via pg_cron
- ✅ Agent phase separation (discovery → matching → optimization → application → learning)

**Remaining:**
- Add agent health dashboard: show success/failure rates per agent over last 30 days (query `agent_runs` + `agent_timings`)
- Add circuit breaker pattern: if an agent fails 3x consecutively, skip it and notify user
- Add agent run cost estimation: estimate API token usage per run

**Effort**: 1 new component, 1 edge function update

---

## Phase 5 — Data & Schema Finalization

**Notification Priority Field**
- Add `priority` column to `notifications` table (values: `low`, `normal`, `urgent`)
- Update SmartNotificationEngine to set priority based on type
- Update NotificationCenter UI to sort by priority and show urgent items first

**Computed ROI Fields**
- Add `roi_score` and `roi_computed_at` columns to `job_seeker_profiles`
- Periodically compute and cache the Career ROI Score server-side via the agent orchestrator
- Enables showing ROI in public profiles and reports without client-side recalculation

**Effort**: 2 migrations, 2 component updates

---

## Phase 6 — Performance & Scalability

**API Payload Optimization**
- Audit all Supabase queries to use `.select()` with specific columns instead of `select("*")`
- Reduce over-fetching on Dashboard, JobSearch, and Applications pages

**Realtime Memory Safety**
- Add cleanup to all Supabase Realtime subscriptions (agent_runs, notifications)
- Ensure channels are properly removed on unmount to prevent memory leaks
- Already partially done in `useAgentSystem.ts` — audit remaining components

**Parallel Agent Execution**
- ✅ Already using `Promise.allSettled` for phased parallel execution
- Add request deduplication: if agent orchestrator is already running for a user, reject duplicate invocations

**Query Caching**
- Add `staleTime` to React Query where applicable (job search results, profile data)
- Reduce redundant API calls on page navigation

**Effort**: Code-only changes, 0 migrations

---

## Implementation Priority

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 1 — Before/After Quantification | High | Low | 🔴 Do First |
| 2 — Viral Sharing | High | Medium | 🔴 Do First |
| 3 — Integration Points | Medium | Low | 🟡 Do Second |
| 5 — Schema Finalization | Medium | Low | 🟡 Do Second |
| 6 — Performance | Medium | Medium | 🟡 Do Second |
| 4 — Agent Hardening | Low | Medium | 🟢 Do Third |

**Total remaining**: ~6 component updates, 1 new component, 2 migrations, 1 edge function update

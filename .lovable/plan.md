

## Comprehensive Platform Enhancement Plan (8 Phases)

This plan extends the existing SOA architecture with data normalization, benefits standardization, support expansion, observability, and security hardening. Items already implemented (support service, rate limiting on search-jobs, RLS hardening) are noted and skipped.

---

### Current State — Additional Gaps Identified

- No centralized data normalization layer (jobs, benefits, salary not standardized)
- No observability/logging pipeline (difficult to debug ingestion + scoring)
- No user feedback loop from support into product improvements
- Edge functions beyond `search-jobs` lack rate limiting
- No Settings sidebar link

---

### Phase 1: Fix Critical Security Findings

**1A. Drop anon SELECT on `analysis_history`** — migration to remove `Anyone can view score reports` policy (exposes resume text + PII)

**1B. Realtime channel scoping** — scope client-side subscriptions to `notifications:${user.id}` (cannot modify reserved `realtime` schema)

**1C. API & Edge Function Protection** (NEW)
- Add `checkRateLimit` to these edge functions (already present in `search-jobs`):
  - `rewrite-resume` — 10 req/min per user
  - `generate-cover-letter` — 10 req/min per user
  - `generate-outreach` — 10 req/min per user
  - `parse-document` — 15 req/min per user
  - `scrape-url` — 10 req/min per user
- Zod validation already added to `rewrite-resume`, `generate-cover-letter`, `generate-outreach` — extend to `parse-document`, `scrape-url`, `mock-interview`
- All edge functions already use `getUser()` auth — verified

**Files modified:** 5-6 edge functions, 1 migration

---

### Phase 2: Authentication — Signup + Account Settings + Identity Hardening

**2A. Signup page** — `src/pages/auth/Signup.tsx`, calls `supabase.auth.signUp()` with email verification required

**2B. Account Settings page** — `src/pages/AccountSettings.tsx`
- Profile info display, change password, link/unlink Google
- **MFA**: TOTP (Authenticator App) fully functional via `supabase.auth.mfa.enroll({ factorType: 'totp' })`
- Email MFA and SMS MFA grayed out as "Coming soon"
- Delete account via existing `delete-own-account` edge function

**2C. Auth helpers** — add `signup()`, `enrollTOTP()`, `verifyTOTP()`, `unenrollFactor()` to `src/services/user/auth.ts`

**2D. Session & Token Security** (NEW)
- Enable refresh token rotation via `cloud--configure_auth` tool
- Set shorter JWT expiry (1 hour default is fine; document)
- Add login attempt logging to `admin_logs` for suspicious pattern detection

**2E. User Profile Data Model** — already exists as `job_seeker_profiles` table with `preferred_job_types`, `target_job_titles`, `salary_min`, `salary_max`, `remote_only`, `career_level`. No new table needed — this data already feeds into job matching and query generation.

**Files created:** `src/pages/auth/Signup.tsx`, `src/pages/AccountSettings.tsx`
**Files modified:** `src/services/user/auth.ts`, `src/shell/routes.tsx`, `src/shell/navigation.ts`, `src/pages/auth/Login.tsx`

---

### Phase 3: Job Search, Ingestion & Matching Optimization

**3A. Improve search query construction** — expand `buildSearchQueries` from max 2 to max 5 queries (one per target title + skill fallbacks)

**3B. Broaden Firecrawl search** — increase `limit: 10` → `limit: 30` per query, add 45s `AbortController` timeout

**3C. Scoring relevance improvements**
- Exact title match: +30 (currently +20)
- Recency bonus: jobs < 7 days get +15
- Benefits match scoring: +10 if job includes user's preferred benefits
- Salary normalization scoring: +10 if within user's range
- Remote preference scoring: +15 if matches user's `remote_only` preference

**3D. Salary range filtering** — add server-side salary filtering in edge function when user has `salary_min`/`salary_max`

**3E. Job Ingestion Pipeline** (NEW CORE LAYER)
- Create `src/services/job/normalization.ts`:

```text
Raw Ingestion → Normalization → Deduplication → Enrichment → Scoring Input
```

  1. **Normalization**: standardize title casing, company name, location format, salary parsing (e.g., "$80k-100k" → `{min: 80000, max: 100000}`)
  2. **Deduplication**: hash-based dedup using `md5(title + company + location)` — skip inserts on collision
  3. **Enrichment**: infer seniority level, remote classification, standardized tags from description
  4. The edge function already does much of this inline — refactor into reusable functions

**3F. Benefits Normalization System** (NEW)
- Create `benefits_catalog` table (master reference, ~24 rows):
  - `id`, `category` (enum matching existing `BenefitCategory` type), `label`, `keywords` (text array for matching)
- Create `job_benefits` junction table: `job_id` (FK → `scraped_jobs`), `benefit_id` (FK → `benefits_catalog`)
- Build `src/services/job/benefits.ts`:
  - Extract benefits from description using regex + keyword matching against catalog
  - Map to catalog entries and store in `job_benefits`
- Integrate with scoring: jobs matching user's preferred benefits get +X points

**Database migrations:** `benefits_catalog`, `job_benefits` tables + seed data
**Files created:** `src/services/job/normalization.ts`, `src/services/job/benefits.ts`
**Files modified:** `supabase/functions/search-jobs/index.ts`, `src/services/matching/service.ts`

---

### Phase 4: Cleanup & Link Verification

**4A. Remove duplicate legacy files** — audit `src/components/` root for files that are re-exported from service subdirectories; remove unused originals

**4B. Sidebar links** — all 10 job seeker + 4 hiring manager links verified correct. Add `/settings` (Phase 2)

**4C. Application action links** — verified: `handleAnalyzeFit` → `/job-seeker`, `handleSaveJob` → `saveJobToApplications`, external URLs → `window.open`

**4D. SOA Boundary Enforcement** (NEW)
- Run `scripts/check-cross-service-imports.ts` to detect violations
- Ensure no service imports from another service except via `/shared`
- Document public interfaces per service in each `api.ts`

---

### Phase 5: Support Service Enhancement

The support service already exists with `support_tickets`, `support_faq`, `ticket_responses` tables, admin ticket management at `/admin/tickets`, and user-facing `/support` page.

**5A. Expand request types** — add `data_issue` and `account_issue` to `RequestType` enum in `src/services/support/types.ts`:
```
"data_issue" (wrong job info, salary, etc.)
"account_issue" (login problems, profile data)
```

**5B. User feedback loop** — tag tickets by category for analytics; admin dashboard shows ticket volume by type to identify product improvement areas

**5C. SLA tracking** (future) — add `sla_deadline` column to `support_tickets`, compute based on priority (high: 24h, medium: 48h, low: 72h)

**Files modified:** `src/services/support/types.ts`, `src/services/support/service.ts`
**Migration:** add `data_issue`, `account_issue` to request type validation (or keep flexible since it's a text column)

---

### Phase 6: Leaked Password Protection

- Enable HIBP check via Cloud → Users → Auth Settings → Email → Password HIBP Check (manual configuration)

---

### Phase 7: Observability & Monitoring (NEW)

**7A. Edge function logging standardization**
- Create `supabase/functions/_shared/logger.ts` with structured JSON logging:
  ```typescript
  log("info", "search_completed", { userId, jobCount: 15, duration: 2300 })
  ```
- Integrate into all edge functions

**7B. Client-side error tracking**
- Enhance existing `ErrorBoundary` to log errors to `admin_logs` table via edge function
- Track: failed searches, scoring errors, auth failures

**7C. Metrics dashboard** — add to admin panel:
- Jobs ingested (daily/weekly)
- Jobs matched per search (average)
- Failed searches count
- Edge function error rates

**Files created:** `supabase/functions/_shared/logger.ts`
**Files modified:** key edge functions, `src/components/ErrorBoundary.tsx`, admin dashboard

---

### Phase 8: Performance & Scalability (NEW)

**8A. Formalize queue-based ingestion** — the `processing_jobs` queue already exists; add scheduled cleanup (trigger already exists for 1-hour cleanup)

**8B. Caching layer**
- Cache recent search results in `processing_jobs` — if identical query exists < 5 min old, return cached result
- Client-side: use React Query with 2-min stale time for job search results

**8C. Pagination & lazy loading**
- Add cursor-based pagination to `scraped_jobs` queries (currently limited to 500)
- Lazy load job cards on scroll in `JobSearch.tsx`

**Files modified:** `src/services/job/service.ts`, `supabase/functions/search-jobs/index.ts`, `src/pages/JobSearch.tsx`

---

### Technical Summary

| Category | Files Created | Files Modified | Migrations |
|----------|:---:|:---:|:---:|
| Security (Phase 1) | 0 | 5-6 edge functions | 1 |
| Auth (Phase 2) | 2 pages | 4 | 0 |
| Search/Ingestion (Phase 3) | 2 modules | 2 | 2 |
| Cleanup (Phase 4) | 0 | varies | 0 |
| Support (Phase 5) | 0 | 2 | 0-1 |
| Observability (Phase 7) | 1 shared module | 5+ | 0 |
| Performance (Phase 8) | 0 | 3 | 0 |
| **Total** | **~6-8** | **~12-18** | **3-4** |

### Implementation Order

Phase 1 (security) → Phase 2 (auth) → Phase 3 (search/ingestion) → Phase 5 (support) → Phase 4 (cleanup) → Phase 7 (observability) → Phase 8 (performance) → Phase 6 (manual HIBP)


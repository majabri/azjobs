

## Fix Build Errors + Realistic Architecture Enhancement Plan

### Reality Check

This project runs on **Lovable (React + Supabase)** — a client-side SPA with serverless edge functions. True microservices (independently deployed containers with separate databases, event buses, service meshes) are **not possible** in this environment. However, we can achieve the **spirit** of the architecture using:

- **Edge Functions** as independent service endpoints (already partially done)
- **Supabase tables** with strict RLS as service-owned data layers
- **Client-side service modules** with strict import boundaries (already partially done via SOA)
- **Database-backed event log** for event-driven patterns
- **Feature flags table** for admin service controls

### Critical Issue: Build Is Broken

`src/services/job/service.ts` was overwritten and lost the `searchJobs`, `searchDatabaseJobs`, and `searchAIJobs` functions. Only `normalizeJobUrl` remains. The `api.ts` re-exports are broken, causing a cascading build failure.

---

### Phase 1 — Fix Build (Immediate)

**Restore `src/services/job/service.ts`** with the missing functions:
- `searchJobs(filters)` — calls the `search-jobs` edge function, handles polling, returns `{ jobs, citations }`
- `searchDatabaseJobs(filters)` — queries `scraped_jobs` table directly
- `searchAIJobs(filters)` — calls edge function for AI-powered search only
- Keep existing `normalizeJobUrl`

This alone will unbreak the build since all other files import from `api.ts` which re-exports from `service.ts`.

### Phase 2 — Service Architecture Hardening

Enhance the existing 11-service SOA to match the requested architecture:

| Requested Service | Implementation | Status |
|---|---|---|
| auth-service | `src/services/user/auth.ts` + Supabase Auth | Exists |
| profile-service | `src/services/user/service.ts` | Exists |
| search-service | `src/services/job/service.ts` | Fix in Phase 1 |
| matching-service | `src/services/matching/service.ts` | Exists |
| recommendation-service | Merge into matching service | New logic |
| auto-apply-service | `src/services/career/` + orchestrator | Exists |
| career-path-service | Edge function `career-path-analysis` | Exists |
| learning-service | `src/services/learning/service.ts` | Exists |
| gig-service | New service module + tables | **New** |
| notification-service | `notifications` table + edge function | Exists |
| analytics-service | `src/services/analytics/service.ts` | Exists |
| billing-service | Stripe integration | **New** (Phase 4) |
| admin-service | `src/services/admin/` | Exists |
| ai-recovery-service | New edge function | **New** |
| localization-service | i18n config | **New** (deferred) |

### Phase 3 — Feature Flags & Admin Controls

1. **Migration**: Create `feature_flags` table with columns: `key`, `enabled`, `updated_by`, `updated_at`
2. **Seed flags**: `auto_apply`, `autopilot_mode`, `career_path`, `learning`, `gig_marketplace`, `notifications`, `analytics`
3. **Admin UI**: Add feature flags panel to Admin Dashboard
4. **Client hook**: `useFeatureFlag(key)` that checks the table and gates UI sections
5. **Edge function guard**: Check flags before executing service logic

### Phase 4 — Event System (Database-Backed)

1. **Migration**: Create `service_events` table: `id`, `event_name`, `payload`, `emitted_by`, `created_at`, `processed`
2. Events like `user.created`, `profile.updated`, `job.fetched`, `match.calculated`, `application.submitted`, `error.detected`
3. Edge function `event-processor` listens via pg_cron and dispatches to handlers
4. Self-healing: `error.detected` triggers retry logic in `ai-recovery-service`

### Phase 5 — Failure Isolation & Self-Healing

1. **Fallback responses**: Each service module already has try/catch with graceful degradation (verified in orchestrator and JobSearch page)
2. **Service health table**: `service_health` with `service_name`, `status`, `last_check`, `error_count`, `circuit_breaker_open`
3. **ai-recovery edge function**: Listens for `error.detected` events, classifies errors, applies retry/fallback/circuit-breaker
4. **Admin emergency mode**: Toggle in admin dashboard to instantly disable any service via feature flags

### Phase 6 — Gig Marketplace (New Feature)

1. **Tables**: `gigs`, `gig_bids`, `gig_contracts`, `gig_milestones`, `gig_reviews`
2. **Pages**: `/gigs` (browse), `/gigs/create`, `/gigs/:id` (detail + bid)
3. **Service module**: `src/services/gig/`
4. **RLS**: Owner manages gigs, authenticated users can bid, reviews after contract completion

### What Will NOT Be Built (Out of Scope for Lovable)

- Kubernetes/Docker container orchestration
- True independent deployments per service
- Message queues (RabbitMQ, Kafka)
- Service mesh / API gateway
- Separate databases per service (Supabase is one DB with RLS isolation)

---

### Technical Details

**Files modified (Phase 1 — build fix):**
- `src/services/job/service.ts` — restore `searchJobs`, `searchDatabaseJobs`, `searchAIJobs`

**Files created (Phase 3–6):**
- 1 migration for `feature_flags` + `service_events` + `service_health` tables
- 1 migration for gig marketplace tables
- `src/services/gig/` (types, service, api, routes, pages)
- `src/hooks/useFeatureFlag.ts`
- `supabase/functions/ai-recovery/index.ts`
- Admin dashboard additions for feature flags and service health

**Estimated scope:** ~15–20 files modified/created, 2–3 migrations

### Implementation Order

1. **Phase 1** — Fix build (restore job service functions)
2. **Phase 3** — Feature flags + admin controls
3. **Phase 4** — Event system
4. **Phase 5** — Self-healing hooks
5. **Phase 6** — Gig marketplace
6. **Phase 2** — Service hardening (ongoing)


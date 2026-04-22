# iCareerOS - V2 Codebase Remediation & Refactor Plan

This document outlines the findings of a comprehensive full-platform codebase review. It itemizes the core structural, architectural, and safety issues identified within the platform, mapped directly into a phased execution roadmap. 

**Instruction for AI Agents / CoWork:** 
Execute these phases sequentially. Mark heavily coupled dependencies and ensure the build operates safely (`bunx tsc --noEmit`) before progressing to the next phase.

---

## 🛑 Architectural Findings & Issues

### 1. Massive Component Monoliths
- **Finding:** Files like `JobSearch.tsx` (820+ lines) and `AutoApply.tsx` (827+ lines) act as monolithic dumping grounds, mixing highly reactive UI definitions, complex networking states, layout configurations, and business domain logic.
- **Problem:** Impossible to unit test, highly prone to merge conflicts, impossible to maintain.

### 2. Leaky Data Access & Uncached Network Sprawl 
- **Finding:** Across the platform, there are **106 instances** of `useEffect` directly executing raw `supabase.from()` calls. 
- **Problem:** This leads to significant UI thrashing, layout-shifting loading spinners, cache misses, and massive performance degradation as components waterfall-fetch independently.

### 3. Destruction of Type Safety (`any` abuse)
- **Finding:** The codebase flagrantly bypasses TypeScript compilers using `as any` overrides—amounting to **529 instances**. 
- **Problem:** Database schema updates will silently break the UI, causing critical runtime crashes in production. Typescript is effectively disabled for the platform's core data conduits.

### 4. Fragile UI Input Validations
- **Finding:** **54 user forms** across the system rely on fragile scalar variable webs (e.g. `useState("");`) instead of structured validation schemas. 
- **Problem:** Leaves endpoints vulnerable to data corruption, missing fields, and silent failures while severely degrading UX regarding error surfacing.

### 5. Backend Edge Function Sprawl
- **Finding:** The backend contains **56 disjointed Deno Edge Functions** (`supabase/functions/`). Analytical domains (like matching scores) frequently inline mathematical logic rather than importing a shared module.
- **Problem:** Fixing a bug in one heuristic requires fixing it across 5 disjointed Deno files.

---

## 🚀 The Execution Roadmap (V2)

### Phase 1: Pure Type Safety Enforcement (The Compiler Purge)
_Goal: Eliminate silent compile masking to reveal actual structural bugs._
- [ ] Regenerate strict Supabase DB schemas: `bunx supabase gen types typescript --local > src/types/supabase.ts`
- [ ] Search and replace all `as any` escape hatches across `/src`.
- [ ] Formally define interfaces for Deno Edge Function payloads and Frontend Data Stores.
- [ ] Target Goal: `bunx tsc --noEmit` must return 0 explicit casts.

### Phase 2: Data Access Abstraction (React Query Expansion)
_Goal: Centralize caching and instantly resolve data waterfalling._
- [ ] Migrate the `JobSearch.tsx` and `AutoApply.tsx` data queries into heavily cached `@tanstack/react-query` hooks located inside `src/hooks/queries/`.
- [ ] Migrate candidate workflow endpoints: Build `useJobApplications`, `useOffers`, and `useInterviews` data hooks.
- [ ] Strip out all fragmented `loading` and `error` `useStates` throughout local components.

### Phase 3: Monolith Dismantling
_Goal: Isolate Domain Logic from UX Presentation._
- [ ] Break `src/pages/JobSearch.tsx` into `/src/components/job-search/` modules (`FilterSidebar.tsx`, `JobResultsMatrix.tsx`, `AISmartBadges.tsx`).
- [ ] Break `src/pages/AutoApply.tsx` into atomic components routing to a standard automation configuration panel.
- [ ] Break `src/pages/AccountSettings.tsx` into isolated nested-view tabs.

### Phase 4: Zod Form Standardization
_Goal: Secure our input boundaries._
- [ ] Audit all input boundaries and convert them to `react-hook-form` driven by strictly inferred `zod` schemas.
- [ ] Prioritize: JobSeeker Intake Wizard, Offers Tracking Module, and Admin System Config arrays.

### Phase 5: Backend Domain Consolidation
_Goal: Dry out the Edge layer._
- [ ] Establish `supabase/functions/_shared/` domain folders.
- [ ] Lift all mathematical match formulas (e.g. inline scoring mechanisms inside `search-jobs`, `discover-jobs`) down into a consolidated `matchingEngine.ts` shared file.
- [ ] Ensure all 56 functions implement exhaustive execution-duration logging by importing the global `logger.ts`.

### Phase 6: Expanded Component Matrix Testing
_Goal: Protect the React layer._
- [ ] Install and configure `@testing-library/react`.
- [ ] Hook React Query matrices into pure mocked Vitest servers.
- [ ] Write integration test assertions mapping exactly to complex user-flows (such as triggering an AutoApply batch, or saving a sequence of target roles).

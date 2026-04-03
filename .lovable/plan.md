

## Fix Plan: Sidebar Links, Routing, and Job Search

### Problem Summary

1. **Runtime crash (React.lazy double-wrap)**: Shell routes wrap already-lazy named exports from service routes in another `React.lazy()`. For example, `JobSeeker` is already `lazy(() => import(...))` in `src/services/job/routes.tsx`, but shell re-wraps it with `lazy(() => import(...).then(m => ({ default: m.JobSeeker })))`. This causes the "Element type is invalid... Lazy element type must resolve to a class or function" error that crashes pages.

2. **Affected components** (all double-lazy-wrapped in `src/shell/routes.tsx`):
   - `JobSeeker`, `Offers`, `UserAuth`, `UserPublicProfile`, `AdminUsernameLogin`, `AdminSetPassword`, `InterviewPrep`, `AutoApply`, `ScoreReport`, `CandidatesDatabase`, `JobPostings`, `InterviewScheduling`

3. **Sidebar links** are correctly defined in `src/shell/navigation.ts` and point to the right paths. The issue is that routes crash when loaded due to the double-lazy bug above.

4. **Job search pipeline** was already refactored to use `searchJobsService` from the job service API and `scoreJobs` from matching — this is working correctly per edge function logs (returning 10 results, no WORKER_LIMIT errors).

---

### Step 1: Fix Double-Lazy Named Exports in Shell Routes

**File**: `src/shell/routes.tsx`

Replace all double-lazy named export patterns. Instead of:
```typescript
const JobSeeker = lazy(() => import("@/services/job/routes").then(m => ({ default: m.JobSeeker })));
```

Use direct lazy import of the page file:
```typescript
const JobSeeker = lazy(() => import("@/services/job/pages/JobSeeker"));
```

Apply this fix to all 12 affected lazy imports:
- `JobSeeker` → `@/services/job/pages/JobSeeker`
- `Offers` → `@/services/application/pages/Offers`
- `UserAuth` → `@/services/user/pages/Auth`
- `UserPublicProfile` → `@/services/user/pages/PublicProfile`
- `InterviewPrep` → `@/services/career/pages/InterviewPrep`
- `AutoApply` → `@/services/career/pages/AutoApply`
- `ScoreReport` → `@/services/matching/pages/ScoreReport`
- `AdminUsernameLogin` → `@/services/admin/pages/AdminUsernameLogin`
- `AdminSetPassword` → `@/services/admin/pages/AdminSetPassword`
- `CandidatesDatabase` → `@/services/hiring/pages/CandidatesDatabase`
- `JobPostings` → `@/services/hiring/pages/JobPostings`
- `InterviewScheduling` → `@/services/hiring/pages/InterviewScheduling`

Keep the default-export route modules (`AnalyticsRoutes`, `JobRoutes`, etc.) as-is since they correctly lazy-import a default export.

### Step 2: Fix Dashboard StatCard Ref Warning

**File**: `src/pages/Dashboard.tsx`

The console warns that `StatCard` is a function component receiving refs. Wrap `StatCard` in `React.forwardRef` or remove the ref from the caller.

### Step 3: Verify Job Search Pipeline

No code changes needed — edge function logs confirm searches complete successfully (10 results returned, no WORKER_LIMIT). The refactored `JobSearch.tsx` already uses `searchJobsService` and `scoreJobs`. Will verify the UI renders results after the routing fix.

---

### Technical Details

The root cause is a subtle React anti-pattern: `React.lazy()` expects a module with a `default` export that is a **component function or class**. When you do `.then(m => ({ default: m.JobSeeker }))` and `m.JobSeeker` is itself a lazy object (a special React element type, not a plain function), React throws because it sees a Promise-resolving-to-object instead of a component.

The fix imports the page files directly (which have `export { default }` re-exports), so `lazy()` receives a proper default-exported component function.


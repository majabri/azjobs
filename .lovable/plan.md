
Goal: make job search reliably return visible results again, and automatically send admins to the admin area immediately after login.

What I found
- The live app uses `src/main.tsx` -> `src/shell/App.tsx` -> `src/shell/routes.tsx`. The older `src/App.tsx` is not the active router, so fixes must go into the shell-based flow.
- `src/pages/auth/Login.tsx` currently redirects every authenticated user to `/dashboard`; it never checks whether the user is an admin.
- `src/pages/admin/AdminUsernameLogin.tsx` already redirects admins, but only on the dedicated admin login page.
- Job search is partially working server-side, but the current pipeline is still weak:
  - Firecrawl is returning results in logs.
  - Database search is returning `0 rows`.
  - Search queries are being polluted by bad location values like company text.
  - Firecrawl requests are timing out/aborting.
- `JobSearch.tsx` loads `search_mode` from the profile, but never stores or sends it.
- `JobSearchFilters` does not include `search_mode`, so the edge function always falls back to `"balanced"`.
- The client applies `minFitScore` after scoring, which can hide all fetched jobs and make the search look broken even when the backend found results.

Plan

1. Fix admin auto-redirect after login
- Update the main login page to wait for both auth readiness and admin role loading.
- Redirect admins to `/admin` and regular users to `/dashboard`.
- Keep the dedicated `/admin/login` page, but make post-login routing consistent with the main login flow.
- Use a shared post-login route resolver so email/password and OAuth behave the same way.
- Show a loading state while role data is resolving to avoid redirect races.

Files:
- `src/pages/auth/Login.tsx`
- `src/hooks/useAdminRole.ts` or a small new redirect helper
- `src/pages/admin/AdminUsernameLogin.tsx` if needed for consistency

2. Fix the job search request contract
- Add `search_mode` to `JobSearchFilters`.
- Track `search_mode` in `JobSearch.tsx` state and initialize it from the profile.
- Pass `search_mode` from the page -> job service -> edge function.
- Align the frontend fit filtering with the selected search mode so “volume” is not canceled by a stricter local threshold.

Files:
- `src/services/job/types.ts`
- `src/services/job/service.ts`
- `src/pages/JobSearch.tsx`

3. Repair search query construction
- Sanitize the location input before generating queries.
- Ignore suspicious “location” values that look like company names or quoted text.
- Stop appending location twice in Firecrawl queries.
- Add title normalization for executive/security titles so searches use cleaner ATS-style titles and synonyms.

Files:
- `supabase/functions/search-jobs/index.ts`

4. Improve result yield and fallback behavior
- Rework DB search so it contributes useful matches instead of acting like a broad top-300 fetch that currently returns nothing useful.
- Relax overly strict assumptions around stored job quality where appropriate.
- Keep backend ranking, but improve client visibility when results are hidden by filters.
- If jobs were fetched but then filtered out, show a specific message and a quick way to lower the threshold/reset filters.

Files:
- `supabase/functions/search-jobs/index.ts`
- `src/pages/JobSearch.tsx`
- `src/services/matching/service.ts` only if score alignment needs adjustment

5. Final routing cleanup review
- Verify the active shell routes handle `/`, `/auth`, `/auth/login`, `/admin/login`, and `/admin/*` correctly.
- Make sure no legacy route file is masking or duplicating behavior.
- Keep redirects role-aware and `replace: true` so history stays clean.

Files:
- `src/shell/routes.tsx`
- `src/main.tsx`
- `src/shell/App.tsx`
- review `src/App.tsx` only to avoid confusion

Technical details

```text
Current job-search failure chain
Profile loads search_mode + min_match_score
  -> only min_match_score is actually used on the page
  -> search request omits search_mode
  -> edge function defaults to "balanced"
  -> client may still filter harder than backend
  -> user sees too few/no jobs even when backend found some
```

```text
Current admin-login failure chain
/auth/login
  -> auth succeeds
  -> useEffect sees authenticated user
  -> always navigate("/dashboard")
  -> admin never gets auto-sent to /admin
```

Validation checklist
- Normal user logs in on `/auth/login` -> lands on `/dashboard`.
- Admin logs in on `/auth/login` -> lands on `/admin` without refresh.
- Already-authenticated admin visiting `/` or `/auth/login` is redirected correctly.
- Search works with blank location, remote, and non-US/global locations.
- Bad profile/location strings no longer pollute Firecrawl queries.
- “Volume” mode shows more visible results than “quality”.
- If backend finds jobs but filters hide them, the UI explains why.

Estimated scope
- Modified: ~5–8 files
- Created: 0–1 small helper
- Migrations: 0

Implementation order
1. Admin redirect fix
2. Search-mode wiring
3. Query sanitization and Firecrawl fix
4. Result visibility / fallback improvements
5. Route cleanup verification

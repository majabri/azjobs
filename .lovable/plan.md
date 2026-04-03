

## Profile Search Criteria & Job Search/Matching Enhancement Plan

### What This Plan Covers

Comparing the user's improvement requirements against the current codebase, here is what **already exists** vs **what needs to be built**:

| Requirement | Status | Action |
|---|---|---|
| Target job titles with tags | Already exists | No change |
| Career level multi-select | Already exists | No change |
| Location & work mode | Partial (remote toggle, text input) | Enhance: split into city/state/country fields |
| Salary range inputs | Already exists (text fields) | Enhance: add market guidance |
| Min fit score slider | Already exists | Enhance: add tooltip explanation |
| Job type badges | Already exists | No change |
| Quality vs Volume toggle | Missing | Add |
| Saved Search Presets | Missing | Add |
| AI title suggestions | Missing | Add |
| Separate location fields | Missing (single text field) | Add |
| "Search & Match Criteria" as distinct profile section | Missing (mixed into "Job Preferences") | Reorganize |
| Job title normalization in edge function | Missing | Add |
| Salary guidance/market rate display | Missing | Add |
| Smart Alerts integration | Partial (email prefs exist) | Wire to search criteria |
| Top Skills Missing insight | Missing from profile | Add |
| Parallel Firecrawl queries | Missing (sequential) | Add |
| DB fetch limit 100 | Too low | Increase to 300 |
| Filter threshold 50 | Too strict | Lower to 35 |
| Global search support | Missing (US-centric location) | Add |

---

### Phase 1: Reorganize Profile Page — Clear "Search & Match Criteria" Section

**Problem**: Search preferences are buried inside "Job Preferences" alongside auto-apply settings. Users cannot clearly see what drives their job matches.

**Changes to `src/components/profile/ProfileForm.tsx`**:

1. Create a new visually distinct **"Search & Match Criteria"** card section (collapsible via Collapsible component) with its own icon (Target) and header, placed after Skills and before Work Experience

2. Move into this section:
   - Target Job Titles (with AI suggestion button — calls existing `extract-profile-fields` edge function with current skills/experience to suggest titles)
   - Career Level multi-select (already exists)
   - **Location fields**: Replace single "Location" text input with structured fields: City, State/Province, Country — stored as comma-separated in the existing `location` column
   - Work Mode toggle group: Remote / Hybrid / On-site (replaces the `remote_only` boolean — map to `preferred_job_types`)
   - Salary Range with market guidance: show "Suggested: $X–$Y based on your level and titles" using the same `MARKET_BENCHMARKS` map from JobSearch.tsx
   - Minimum Fit Score slider (move from Job Preferences) with tooltip: "Lower score = more opportunities; higher score = better fit"
   - **Quality vs Volume toggle**: new field stored in profile — `search_mode: "quality" | "balanced" | "volume"` (maps to fit score thresholds: 70/50/35)
   - Job Type badges (full-time, contract, part-time)

3. Add a **"Top Missing Skills"** insight card below the criteria: query `analysis_history` for the user's most recent analysis, extract top 3 gaps, display as actionable badges with "Add to Profile" buttons

4. Add **Saved Search Presets** (new feature):
   - "Save Current Criteria" button saves a named preset
   - Dropdown to load a saved preset
   - Requires new DB table `search_presets`

**Database migration**: 
```sql
ALTER TABLE job_seeker_profiles ADD COLUMN search_mode text DEFAULT 'balanced';

CREATE TABLE public.search_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  criteria jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.search_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own presets" ON public.search_presets 
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

### Phase 2: Enhance Job Search Edge Function

**Changes to `supabase/functions/search-jobs/index.ts`**:

1. **Global location support**: Update `extractLocation()` to recognize international patterns (City, Country; City, UK; etc.) instead of only US state codes

2. **Title normalization**: Add `normalizeSearchTitle()` function mapping common variations (e.g., "V.P. Business Information Security Officer" → "VP IT Security BISO") using a synonym map for common abbreviations

3. **Parallel Firecrawl execution**: Run queries in batches of 2 via `Promise.allSettled` instead of sequential loop

4. **Relaxed filtering**: Lower threshold from `finalScore >= 50` to `finalScore >= 35` on line 523

5. **Increase limits**: DB fetch from 100 → 300, final result cap from 100 → 200

6. **Remove US-centric "hiring" suffix** from `buildSearchQueries()` — generate location-aware queries instead

7. **Accept `search_mode` parameter**: When "volume", use threshold 30; "quality" uses 60; "balanced" uses 35

---

### Phase 3: Client-Side Search & Matching Updates

**Changes to `src/pages/JobSearch.tsx`**:
- Update location placeholder to indicate global support
- Pass `search_mode` from profile to search request
- Load profile's `search_mode` as default behavior

**Changes to `src/services/job/service.ts`**:
- Increase DB search limit from 500 → 800
- Support structured location matching

**Changes to `src/services/matching/service.ts`**:
- Add salary range matching: +10 score if job salary falls within user's min/max
- Add remote preference bonus: +15 if job matches user's work mode preference

---

### Phase 4: Smart Alerts Integration

**Changes to `src/components/EmailPreferences.tsx`**:
- Display which search criteria are connected to alerts
- Show "Alerts use your Search & Match Criteria" with link to profile section

---

### Estimated Scope

| Area | Files Created | Files Modified | Migrations |
|---|---|---|---|
| Profile reorganization | 0 | 2 (`ProfileForm.tsx`, `Profile.tsx`) | 1 |
| Search presets | 0 | 1 (`ProfileForm.tsx`) | included above |
| Edge function enhancement | 0 | 1 (`search-jobs/index.ts`) | 0 |
| Client search/matching | 0 | 3 (`JobSearch.tsx`, `service.ts`, matching `service.ts`) | 0 |
| Alerts integration | 0 | 1 (`EmailPreferences.tsx`) | 0 |
| **Total** | **0** | **~8** | **1** |

### Implementation Order

Phase 1 (Profile UI) → Phase 2 (Edge function) → Phase 3 (Client search) → Phase 4 (Alerts)


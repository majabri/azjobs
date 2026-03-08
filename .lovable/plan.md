

## Multi-Feature Enhancement Plan

This plan covers 7 features across the profile, job seeker, and new job search pages.

---

### 1. Profile Completeness Indicator

Add a visual progress bar at the top of the Profile page showing percentage of fields filled.

**Logic**: Calculate completeness from 8 weighted fields (name, email, phone, location, summary, skills, work experience, education). Each filled field contributes ~12.5%. Display using the existing `Progress` component with a percentage label.

**File**: `src/pages/Profile.tsx` — add `computeCompleteness()` function and render a progress card below the header.

---

### 2. Add Missing Skills to Profile from Analysis

On the Job Seeker results page, the "Skills to Develop" section already has an "I have this" button. Enhance this by adding an **"Add to Profile"** button next to missing skills that saves them directly to the user's `job_seeker_profiles.skills` array in the database.

**File**: `src/pages/JobSeeker.tsx` — add `handleAddSkillToProfile(skill)` function that fetches profile, appends skill, and upserts.

---

### 3. Resume Versions for Different Job Types

**Database**: Add a new table `resume_versions` with columns: `id`, `user_id`, `version_name` (e.g. "Technical", "Management"), `job_type` (e.g. "remote", "full-time"), `resume_text`, `created_at`, `updated_at`. RLS: user can only access own rows.

**Profile Page**: Add a "Resume Versions" section at the bottom of the profile page where users can create, name, edit, and delete different resume versions. Each version has a name, optional job type tag, and the resume text content.

**Job Seeker Page**: Update the "Load from Profile" button to show a dropdown/dialog letting users choose which version to load, or the default profile.

**Files**: New migration, edit `src/pages/Profile.tsx`, edit `src/pages/JobSeeker.tsx`.

---

### 4. Job Type Preferences on Profile

**Database**: Add `preferred_job_types` (text[], nullable) column to `job_seeker_profiles`. Values like "remote", "hybrid", "in-office", "full-time", "part-time", "contract", "short-term".

**Profile Page**: Add a "Job Preferences" section with toggle chips/badges for each job type. Users can select multiple.

**Files**: Migration to alter table, edit `src/pages/Profile.tsx`.

---

### 5. Load Profile into Comparison Tool (Hiring Manager)

Add a "Load from Profile" option in the Hiring Manager's candidate input section, allowing the hiring manager to load their own profile as one of the candidates for comparison (useful for self-assessment).

**File**: `src/pages/HiringManager.tsx` — add a small button that fetches the logged-in user's profile and formats it as resume text into one of the candidate slots.

---

### 6. Web Job Search Matching Skills

Create a new **Job Search** page (`/job-search`) that uses the Perplexity API (already connected via connector) to search for jobs matching the user's profile skills and job type preferences.

**New edge function**: `search-jobs` — accepts skills array and job preferences, queries Perplexity's sonar model with a structured prompt like "Find job openings for [skills] that are [remote/full-time/etc] in [location]", returns results with titles, companies, URLs, and descriptions.

**New page**: `src/pages/JobSearch.tsx` — loads user's profile skills/preferences, lets them refine search query, displays results as cards with "Analyze Fit" buttons that navigate to `/job-seeker` with pre-filled job description.

**Routing**: Add `/job-search` to `App.tsx`, add nav link in `UserMenu.tsx`.

**Files**: New edge function `supabase/functions/search-jobs/index.ts`, new page `src/pages/JobSearch.tsx`, edit `src/App.tsx`, edit `src/components/UserMenu.tsx`.

---

### 7. Navigation Updates

Add "Job Search" link to `UserMenu.tsx` alongside the existing Profile link.

---

### Database Changes Summary

**Migration 1** — Resume versions table + job type preferences:
```sql
-- Resume versions table
CREATE TABLE public.resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  version_name text NOT NULL DEFAULT 'Default',
  job_type text,
  resume_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
-- RLS policies (user owns their rows)

-- Add job type preferences to profiles
ALTER TABLE public.job_seeker_profiles 
  ADD COLUMN preferred_job_types text[];
```

### Files to Create/Edit

| Action | File |
|--------|------|
| Create | `supabase/functions/search-jobs/index.ts` |
| Create | `src/pages/JobSearch.tsx` |
| Create | Migration SQL |
| Edit | `src/pages/Profile.tsx` (completeness indicator, job preferences, resume versions) |
| Edit | `src/pages/JobSeeker.tsx` (add skill to profile, load resume version) |
| Edit | `src/pages/HiringManager.tsx` (load profile as candidate) |
| Edit | `src/App.tsx` (add /job-search route) |
| Edit | `src/components/UserMenu.tsx` (add Job Search link) |

